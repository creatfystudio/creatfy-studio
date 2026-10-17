import React, { useMemo, useState } from 'react';
import {
  ArrowLeft,
  Clock,
  Download,
  FolderOpen,
  PlayCircle,
  AlertTriangle,
  Image as ImageIcon,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../lib/useOrders';
import { startProduction } from '../../lib/orders';
import { formatDate, getSlaInfo, normalizeSearch } from '../../lib/utils';
import { triggerBrowserDownload } from '../../lib/storage';
import type { Order } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import FolderContentsModal from '../../components/FolderContentsModal';
import ProductionOrderModal from '../../components/ProductionOrderModal';

type SubView = 'waiting' | 'production' | 'alerts' | null;
type MainTab = 'home' | 'allVideos' | 'finalized';

/** Miniatura do Drive (funciona com arquivos compartilhados por link). */
function driveThumbnailUrl(fileId: string, size = 400): string {
  return `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w${size}`;
}

/** Player oficial do Drive, para usar dentro de um iframe. */
function drivePreviewUrl(fileId: string): string {
  return `https://drive.google.com/file/d/${encodeURIComponent(fileId)}/preview`;
}

/** Extrai o ID do arquivo a partir de um link do Drive. */
function extractFileId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function Placeholder() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
      }}
    >
      <ImageIcon size={22} className="text-muted" />
    </div>
  );
}

/** Miniatura de imagem do Drive. Se não carregar, mostra o ícone de placeholder. */
function DriveImage({ url, alt }: { url?: string; alt: string }) {
  const fileId = extractFileId(url);
  const [failed, setFailed] = useState(false);

  if (!fileId || failed) return <Placeholder />;

  return (
    <img
      src={driveThumbnailUrl(fileId, 800)}
      alt={alt}
      referrerPolicy="no-referrer"
      loading="lazy"
      onError={() => setFailed(true)}
      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
    />
  );
}

/**
 * Vídeo do Drive. Mostra a miniatura com botão de play.
 * Só carrega o player oficial do Drive quando o usuário clica.
 */
function DriveVideo({ url }: { url?: string }) {
  const fileId = extractFileId(url);
  const [playing, setPlaying] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);

  if (!fileId) return <Placeholder />;

  if (playing) {
    return (
      <iframe
        src={drivePreviewUrl(fileId)}
        title="Vídeo do pedido"
        allow="autoplay; fullscreen"
        allowFullScreen
        style={{ width: '100%', height: '100%', border: 0, background: '#000', display: 'block' }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      aria-label="Reproduzir vídeo"
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        border: 0,
        padding: 0,
        background: '#000',
        cursor: 'pointer',
        display: 'block',
      }}
    >
      {!thumbFailed && (
        <img
          src={driveThumbnailUrl(fileId, 800)}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setThumbFailed(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      )}
      <span
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <PlayCircle size={44} color="#fff" />
      </span>
    </button>
  );
}

function handleDownloadFromDrive(url: string, fileName: string) {
  const fileId = extractFileId(url);
  const downloadUrl = fileId
    ? `https://drive.google.com/uc?export=download&id=${fileId}`
    : url;
  triggerBrowserDownload(downloadUrl, fileName);
}

export default function CreatorArea() {
  const { profile } = useAuth();
  const { orders, loading, error, retry } = useOrders();
  const [mainTab, setMainTab] = useState<MainTab>('home');
  const [subView, setSubView] = useState<SubView>(null);
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [openProduction, setOpenProduction] = useState<Order | null>(null);

  const pending = useMemo(
    () => orders.filter((o) => o.status === 'pending').sort((a, b) => a.createdAtISO.localeCompare(b.createdAtISO)),
    [orders]
  );
  const production = useMemo(() => orders.filter((o) => o.status === 'production'), [orders]);
  const finalized = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'ready' || o.status === 'delivered')
        .sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || '')),
    [orders]
  );

  const todayDoneCount = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    return finalized.filter((o) => (o.finishedAt || '').slice(0, 10) === todayStr).length;
  }, [finalized]);

  const overdue = useMemo(
    () =>
      [...pending, ...production]
        .map((o) => ({ order: o, sla: getSlaInfo(new Date(o.createdAtISO)) }))
        .filter((x) => x.sla.overdue)
        .sort((a, b) => b.sla.businessDaysLate - a.sla.businessDaysLate),
    [pending, production]
  );

  async function handleStart(order: Order) {
    if (!profile) return;
    await startProduction(order, profile.uid, profile.name);
    const updatedOrder: Order = {
      ...order,
      status: 'production',
      startedBy: profile.name,
      startedByUid: profile.uid,
      startedAt: new Date().toISOString(),
    };
    setSubView(null);
    setOpenOrder(null);
    setOpenProduction(updatedOrder);
  }

  function openOrderDetail(order: Order) {
    if (order.status === 'pending') setOpenOrder(order);
    else if (order.status === 'production') setOpenProduction(order);
    else setOpenOrder(order);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <span className="spinner" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="banner banner-error">
        {error} <button className="btn btn-sm btn-secondary" onClick={retry}>Tentar novamente</button>
      </div>
    );
  }

  return (
    <div className="stack gap-lg">
      <div className="row space-between wrap gap-sm">
        <div>
          <h2>Área do Criador de Vídeos</h2>
          <p className="text-sm">Acompanhe a fila de produção, prazos e histórico de entregas.</p>
        </div>
        <div className="navbar-tabs" style={{ padding: 0 }}>
          <button
            className={`navbar-tab ${mainTab === 'home' ? 'active' : ''}`}
            onClick={() => {
              setMainTab('home');
              setSubView(null);
            }}
          >
            Início
          </button>
          <button
            className={`navbar-tab ${mainTab === 'allVideos' ? 'active' : ''}`}
            onClick={() => setMainTab('allVideos')}
          >
            Todos os Vídeos
          </button>
          <button
            className={`navbar-tab ${mainTab === 'finalized' ? 'active' : ''}`}
            onClick={() => setMainTab('finalized')}
          >
            Finalizados ({finalized.length})
          </button>
        </div>
      </div>

      {mainTab === 'allVideos' && <AllVideosTab orders={orders} />}
      {mainTab === 'finalized' && <FinalizedTab orders={finalized} onOpenOrder={openOrderDetail} />}

      {mainTab === 'home' && subView === null && (
        <div className="stack gap-lg">
          <div className="grid-cards">
            <button className="stat-card" onClick={() => setSubView('waiting')}>
              <span className="stat-label"><Clock size={14} /> Aguardando Início</span>
              <span className="stat-value">{pending.length}</span>
            </button>
            <button className="stat-card" onClick={() => setSubView('production')}>
              <span className="stat-label"><PlayCircle size={14} /> Em Produção 3D</span>
              <span className="stat-value">{production.length}</span>
            </button>
            <button className={`stat-card ${overdue.length > 0 ? 'emergency' : ''}`} onClick={() => setSubView('alerts')}>
              <span className="stat-label"><AlertTriangle size={14} /> Alertas (Emergência)</span>
              <span className="stat-value">{overdue.length}</span>
            </button>
            <button className="stat-card" onClick={() => setMainTab('finalized')}>
              <span className="stat-label"><CheckCircle2 size={14} /> Concluídos (Hoje: {todayDoneCount})</span>
              <span className="stat-value">{finalized.length}</span>
            </button>
          </div>

          {overdue.length > 0 && (
            <div className="stack gap-sm">
              <div className="row gap-xs text-danger text-bold">
                <AlertTriangle size={18} />
                <h3 style={{ margin: 0, color: 'var(--danger)' }}>Prioridade Máxima — Em Atraso ({overdue.length})</h3>
              </div>
              <OverdueList items={overdue} onOpen={openOrderDetail} />
            </div>
          )}

          <div className="stack gap-sm">
            <div className="row space-between">
              <h3 style={{ margin: 0 }}>⏳ Aguardando Início ({pending.length})</h3>
              {pending.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSubView('waiting')}>
                  Focar só nestes
                </button>
              )}
            </div>
            {pending.length === 0 ? (
              <EmptyState text="Nenhum pedido aguardando início 🎉" />
            ) : (
              <CompactCardsGrid orders={pending} onOpen={openOrderDetail} />
            )}
          </div>

          <div className="stack gap-sm">
            <div className="row space-between">
              <h3 style={{ margin: 0 }}>🎬 Em Produção 3D ({production.length})</h3>
              {production.length > 0 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setSubView('production')}>
                  Focar só nestes
                </button>
              )}
            </div>
            {production.length === 0 ? (
              <EmptyState text="Nenhum pedido em produção no momento." />
            ) : (
              <CompactCardsGrid orders={production} onOpen={openOrderDetail} showVideoProgress />
            )}
          </div>

          <div className="stack gap-sm" style={{ paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="row space-between">
              <h3 style={{ margin: 0 }}>✅ Últimos Finalizados ({finalized.length})</h3>
              {finalized.length > 8 && (
                <button className="btn btn-ghost btn-sm" onClick={() => setMainTab('finalized')}>
                  Ver histórico completo ({finalized.length})
                </button>
              )}
            </div>
            {finalized.length === 0 ? (
              <EmptyState text="Nenhum pedido finalizado ainda." />
            ) : (
              <CompactCardsGrid orders={finalized.slice(0, 8)} onOpen={openOrderDetail} isFinalized />
            )}
          </div>
        </div>
      )}

      {mainTab === 'home' && subView === 'waiting' && (
        <SubViewWrapper title="Aguardando Início" onBack={() => setSubView(null)}>
          {pending.length === 0 ? (
            <EmptyState text="Nenhum pedido aguardando início 🎉" />
          ) : (
            <CompactCardsGrid orders={pending} onOpen={openOrderDetail} />
          )}
        </SubViewWrapper>
      )}

      {mainTab === 'home' && subView === 'production' && (
        <SubViewWrapper title="Em Produção 3D" onBack={() => setSubView(null)}>
          {production.length === 0 ? (
            <EmptyState text="Nenhum pedido em produção no momento." />
          ) : (
            <CompactCardsGrid orders={production} onOpen={openOrderDetail} showVideoProgress />
          )}
        </SubViewWrapper>
      )}

      {mainTab === 'home' && subView === 'alerts' && (
        <SubViewWrapper title="Alertas (Emergência)" onBack={() => setSubView(null)}>
          {overdue.length === 0 ? (
            <EmptyState text="Nenhum pedido em atraso. Tudo em dia! ✅" />
          ) : (
            <OverdueList items={overdue} onOpen={openOrderDetail} />
          )}
        </SubViewWrapper>
      )}

      {openOrder && (
        <FolderContentsModal
          order={openOrder}
          hidePhone
          onClose={() => setOpenOrder(null)}
          footer={
            openOrder.status === 'pending' ? (
              <button className="btn btn-primary btn-block" onClick={() => handleStart(openOrder)}>
                Iniciar produção
              </button>
            ) : undefined
          }
        />
      )}
      {openProduction && (
        <ProductionOrderModal
          order={openProduction}
          onClose={() => setOpenProduction(null)}
          onFinalized={() => {
            setOpenProduction(null);
            setMainTab('home');
            setSubView(null);
          }}
        />
      )}
    </div>
  );
}

function OverdueList({
  items,
  onOpen,
}: {
  items: { order: Order; sla: ReturnType<typeof getSlaInfo> }[];
  onOpen: (o: Order) => void;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
      {items.map(({ order, sla }) => (
        <div
          key={order.id}
          className="card"
          style={{ borderColor: 'var(--danger)', cursor: 'pointer', padding: 14 }}
          onClick={() => onOpen(order)}
        >
          <div className="row space-between wrap gap-sm">
            <div>
              <span className="mono-number text-bold">#{order.orderNumber}</span>{' '}
              <strong>{order.clientName}</strong>
              <div className="text-sm text-muted" style={{ marginTop: 4 }}>
                {order.category} · {order.videoCount} vídeo(s)
              </div>
            </div>
            <span className="text-danger text-bold text-sm">{sla.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function SubViewWrapper({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} /> Voltar à visão geral
      </button>
      <h3 style={{ marginBottom: 14 }}>{title}</h3>
      {children}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="empty-state">
      <span className="emoji">🎬</span>
      {text}
    </div>
  );
}

function CompactCardsGrid({
  orders,
  onOpen,
  showVideoProgress,
  isFinalized,
}: {
  orders: Order[];
  onOpen: (o: Order) => void;
  showVideoProgress?: boolean;
  isFinalized?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
      {orders.map((order) => {
        const uploaded = order.videos.filter((v) => v.videoUrl).length;
        const firstImg = order.images && order.images.length > 0 ? order.images[0].url : undefined;
        const firstScript = order.videos?.[0]?.script?.trim();
        const sla = !isFinalized ? getSlaInfo(new Date(order.createdAtISO)) : null;
        const revisionNote = order.revisionNote;

        return (
          <div
            key={order.id}
            className="card"
            style={{
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              cursor: 'pointer',
              opacity: isFinalized ? 0.9 : 1,
              borderColor: revisionNote ? 'var(--danger)' : undefined,
            }}
            onClick={() => onOpen(order)}
          >
            <div>
              <div className="row space-between" style={{ marginBottom: 8 }}>
                <span className="mono-number text-bold">#{order.orderNumber}</span>
                <StatusBadge status={order.status} />
              </div>

              <div
                style={{
                  width: '100%',
                  height: '120px',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  marginBottom: 10,
                  background: 'var(--bg-secondary)',
                }}
              >
                <DriveImage url={firstImg} alt={`Mascote do pedido #${order.orderNumber}`} />
              </div>

              <strong style={{ fontSize: '1rem', display: 'block' }}>{order.clientName}</strong>
              <div className="row gap-xs wrap" style={{ marginTop: 4 }}>
                <span className="badge badge-category" style={{ fontSize: '0.75rem' }}>{order.category}</span>
                <span className="text-sm text-muted">{order.videoCount} vídeo(s)</span>
              </div>

              {revisionNote && (
                <div
                  style={{
                    marginTop: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    background: 'rgba(239, 68, 68, 0.14)',
                    border: '1px solid var(--danger)',
                    color: 'var(--danger)',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  🔄 Ajuste solicitado: {revisionNote}
                </div>
              )}

              {firstScript && !revisionNote && (
                <p
                  className="text-sm text-muted"
                  style={{
                    marginTop: 8,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                    fontSize: '0.8rem',
                    background: 'var(--bg-secondary)',
                    padding: '6px 8px',
                    borderRadius: 6,
                  }}
                >
                  "{firstScript}"
                </p>
              )}
            </div>

            <div
              style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }}
              className="row space-between"
            >
              {isFinalized ? (
                <span className="text-sm text-muted">Concluído em {formatDate(order.finishedAt || order.createdAtISO)}</span>
              ) : showVideoProgress ? (
                <span className="text-sm text-muted">{uploaded}/{order.videos.length} enviados</span>
              ) : (
                <span className={`text-sm ${sla?.overdue ? 'text-danger text-bold' : 'text-muted'}`}>
                  {sla ? sla.label : formatDate(order.createdAtISO)}
                </span>
              )}
              <button
                className="btn btn-secondary btn-sm"
                style={{ whiteSpace: 'nowrap' }}
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen(order);
                }}
              >
                <FolderOpen size={13} />{' '}
                {order.status === 'production' ? 'Subir vídeos' : isFinalized ? 'Ver' : 'Abrir'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AllVideosTab({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  const items = useMemo(() => {
    const flat: { order: Order; video: Order['videos'][number] }[] = [];
    orders.forEach((o) =>
      o.videos.filter((v) => v.videoUrl).forEach((v) => flat.push({ order: o, video: v }))
    );
    const term = normalizeSearch(search);
    return flat
      .filter((x) => !term || normalizeSearch(x.order.clientName).includes(term) || x.order.orderNumber.includes(term))
      .filter((x) => !category || x.order.category === category)
      .sort((a, b) => (b.video.uploadedAt || '').localeCompare(a.video.uploadedAt || ''));
  }, [orders, search, category]);

  const categories = useMemo(() => Array.from(new Set(orders.map((o) => o.category))), [orders]);

  return (
    <div className="stack gap-md">
      <div className="row gap-sm wrap">
        <input
          className="input flex-1"
          placeholder="Buscar por Nº ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="select" style={{ maxWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {items.length === 0 ? (
        <EmptyState text="Nenhum vídeo enviado ainda." />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
          {items.map(({ order, video }) => (
            <div key={`${order.id}-${video.index}`} className="card" style={{ padding: 12 }}>
              <div
                style={{
                  width: '100%',
                  height: '150px',
                  borderRadius: 8,
                  overflow: 'hidden',
                  background: '#000',
                  marginBottom: 10,
                }}
              >
                <DriveVideo url={video.videoUrl} />
              </div>

              <div className="text-sm text-bold">#{order.orderNumber} · {order.clientName}</div>
              <div className="text-sm text-muted">
                Vídeo {video.index} de {order.videoCount} · {formatDate(video.uploadedAt)}
              </div>

              <div className="row wrap" style={{ marginTop: 8, gap: 10, alignItems: 'center' }}>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                  onClick={() => handleDownloadFromDrive(video.videoUrl!, video.fileName || `video-${video.index}.mp4`)}
                >
                  <Download size={13} /> Baixar
                </button>
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  style={{ whiteSpace: 'nowrap' }}
                  title="Abrir no Google Drive"
                >
                  <ExternalLink size={13} /> Drive
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FinalizedTab({ orders, onOpenOrder }: { orders: Order[]; onOpenOrder: (o: Order) => void }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ready' | 'delivered'>('');

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return orders
      .filter((o) => !statusFilter || o.status === statusFilter)
      .filter((o) => !term || normalizeSearch(o.clientName).includes(term) || o.orderNumber.includes(term))
      .sort((a, b) => (b.finishedAt || '').localeCompare(a.finishedAt || ''));
  }, [orders, search, statusFilter]);

  return (
    <div className="stack gap-md">
      <div className="row gap-sm wrap">
        <input
          className="input flex-1"
          placeholder="Buscar por Nº ou nome…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="select"
          style={{ maxWidth: 200 }}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as '' | 'ready' | 'delivered')}
        >
          <option value="">Pronto e Entregue</option>
          <option value="ready">Só Prontos</option>
          <option value="delivered">Só Entregues</option>
        </select>
      </div>
      {filtered.length === 0 ? (
        <EmptyState text="Nenhum pedido finalizado ainda." />
      ) : (
        <CompactCardsGrid orders={filtered} onOpen={onOpenOrder} isFinalized />
      )}
    </div>
  );
}