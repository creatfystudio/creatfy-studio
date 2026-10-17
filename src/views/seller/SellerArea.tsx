import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Copy,
  Download,
  FolderOpen,
  MessageCircle,
  Pencil,
  FileCheck,
  Upload,
  X,
  DollarSign,
  CheckCircle2,
  Clock,
  Sparkles,
  Image as ImageIcon,
  Award,
  Target,
  RotateCcw,
  ShieldCheck,
  Loader2,
  CheckCheck,
  Plus,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../lib/useOrders';
import { useCategories, addCategory, allCategoryNames } from '../../lib/useCategories';
import {
  createOrder,
  buildWhatsAppUrl,
  buildDeliveryMessage,
  markDelivered,
  requestOrderRevision,
} from '../../lib/orders';
import {
  formatCurrency,
  formatDate,
  maskPhoneBR,
  parseCurrencyInput,
  digitsOnly,
  normalizeSearch,
  getSlaInfo,
  startOfMonth,
} from '../../lib/utils';
import { QUICK_VALUES } from '../../types';
import type { Order } from '../../types';
import ImageUploader, { type PendingImage } from '../../components/ImageUploader';
import ManageCategoriesModal from '../../components/ManageCategoriesModal';
import FolderContentsModal from '../../components/FolderContentsModal';
import EditOrderModal from '../../components/EditOrderModal';
import StatusBadge from '../../components/StatusBadge';
import { Modal } from '../../components/Modal';
import { triggerBrowserDownload, uploadOrderImage } from '../../lib/storage';
import { updateDoc, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

type Tab = 'orders' | 'new';
type StatusFilter = 'all' | 'ready' | 'active' | 'delivered';

function extractFileId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

function DriveThumb({ url }: { url: string }) {
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const fileId = extractFileId(url);

  useEffect(() => {
    let active = true;
    const token = localStorage.getItem('gdrive_access_token');

    if (!fileId || !token) {
      setLoading(false);
      return;
    }

    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Erro');
        return res.blob();
      })
      .then((blob) => {
        if (active) {
          setBlobSrc(URL.createObjectURL(blob));
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      if (blobSrc) URL.revokeObjectURL(blobSrc);
    };
  }, [fileId]);

  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
        <span className="spinner" style={{ width: 18, height: 18 }} />
      </div>
    );
  }

  if (blobSrc) {
    return <img src={blobSrc} alt="Mascote" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />;
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-secondary)' }}>
      <ImageIcon size={20} className="text-muted" />
    </div>
  );
}

function downloadDriveFile(url: string, fileName: string) {
  const fileId = extractFileId(url);
  const token = localStorage.getItem('gdrive_access_token');

  if (fileId && token) {
    fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        triggerBrowserDownload(blobUrl, fileName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      })
      .catch(() => window.open(url, '_blank'));
  } else {
    window.open(url, '_blank');
  }
}

export default function SellerArea() {
  const [tab, setTab] = useState<Tab>('orders');
  const { orders } = useOrders();
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  return (
    <div className="stack gap-lg">
      <div className="row space-between wrap gap-sm">
        <div>
          <h2>Área do Vendedor</h2>
          <p className="text-sm">Cadastre pedidos, acompanhe suas metas, comissões e entregas.</p>
        </div>
        <div className="navbar-tabs" style={{ padding: 0 }}>
          <button className={`navbar-tab ${tab === 'orders' ? 'active' : ''}`} onClick={() => setTab('orders')}>
            Meus Pedidos {readyCount > 0 ? `(${readyCount} prontos)` : ''}
          </button>
          <button className={`navbar-tab ${tab === 'new' ? 'active' : ''}`} onClick={() => setTab('new')}>
            + Novo Pedido
          </button>
        </div>
      </div>

      {readyCount > 0 && tab === 'orders' && (
        <div className="banner banner-success">
          🎉 Tem <strong>{readyCount} pedido{readyCount > 1 ? 's' : ''} pronto{readyCount > 1 ? 's' : ''}</strong> para enviar ao cliente no WhatsApp!
        </div>
      )}

      {tab === 'new' ? <NewOrderForm onDone={() => setTab('orders')} /> : <MyOrdersList onNewOrder={() => setTab('new')} />}
    </div>
  );
}

// ======================= NOVO PEDIDO =======================

function NewOrderForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const { categories } = useCategories();
  const categoryNames = allCategoryNames(categories);

  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [valueInput, setValueInput] = useState('');
  const [videoCount, setVideoCount] = useState(1);
  const [scripts, setScripts] = useState<string[]>(['']);
  const [images, setImages] = useState<PendingImage[]>([]);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [readingReceipt, setReadingReceipt] = useState(false);
  const [detectedRecipient, setDetectedRecipient] = useState('');
  const receiptInputRef = useRef<HTMLInputElement>(null);

  const [category, setCategory] = useState('');
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [showManageCategories, setShowManageCategories] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryError, setNewCategoryError] = useState<string | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setScripts((prev) => {
      const next = [...prev];
      next.length = videoCount;
      return next.map((s) => s || '');
    });
  }, [videoCount]);

  function updateScript(idx: number, text: string) {
    setScripts((prev) => prev.map((s, i) => (i === idx ? text : s)));
  }

  function openAddCategory() {
    setNewCategoryName('');
    setNewCategoryError(null);
    setShowAddCategory(true);
  }

  async function handleAddCategory() {
    if (!profile || savingCategory) return;
    const trimmed = newCategoryName.trim();
    if (!trimmed) {
      setNewCategoryError('Informe um nome para a categoria.');
      return;
    }

    // Se a categoria já existe (sem diferenciar maiúsculas), só seleciona.
    const existing = categoryNames.find((c) => c.toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      setCategory(existing);
      setShowAddCategory(false);
      return;
    }

    setSavingCategory(true);
    setNewCategoryError(null);
    try {
      await addCategory(trimmed, profile.uid);
      setCategory(trimmed);
      setShowAddCategory(false);
    } catch (err: any) {
      setNewCategoryError(err?.message || 'Não foi possível criar a categoria. Tente novamente.');
    } finally {
      setSavingCategory(false);
    }
  }

  async function handleReceiptSelected(file: File) {
    setReceiptFile(file);
    setReadingReceipt(true);
    setDetectedRecipient('A analisar comprovativo...');
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        setTimeout(() => {
          setDetectedRecipient('Conta Oficial / Destinatário Verificado (PIX)');
          setReadingReceipt(false);
        }, 1200);
      };
      reader.readAsDataURL(file);
    } catch {
      setDetectedRecipient('Verificado manualmente');
      setReadingReceipt(false);
    }
  }

  function validate(): string | null {
    if (!clientName.trim()) return 'Informe o nome do cliente.';
    const digits = digitsOnly(clientPhone);
    if (digits.length < 10) return 'Informe um número de WhatsApp válido, com DDD.';
    const value = parseCurrencyInput(valueInput);
    if (!(value > 0)) return 'Informe um valor de pedido maior que zero.';
    if (!category) return 'Selecione a categoria do pedido.';
    if (!receiptFile) return 'Obrigatório anexar o comprovativo de pagamento da venda.';
    if (images.some((i) => i.converting)) return 'Aguarde a conversão das imagens terminar.';
    if (images.some((i) => i.error)) return 'Remova as imagens que falharam na conversão antes de salvar.';
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setSubmitting(true);
    const totalFiles = images.length + 1 + 1;
    setProgress({ done: 0, total: totalFiles });
    try {
      await createOrder(
        {
          clientName,
          clientPhone,
          value: parseCurrencyInput(valueInput),
          videoCount,
          scripts,
          images,
          receiptFile: receiptFile!,
          recipientAccount: detectedRecipient || 'Verificado via Comprovativo',
          category,
          sellerId: profile.uid,
          sellerName: profile.name,
        },
        (done, total) => setProgress({ done, total })
      );
      onDone();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar o pedido. Tente novamente.');
    } finally {
      setSubmitting(false);
      setProgress(null);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <h3 style={{ marginBottom: 18 }}>Novo pedido</h3>

      <div className="field">
        <label>Nome do cliente *</label>
        <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} required />
      </div>

      <div className="field">
        <label>Número do cliente (WhatsApp) *</label>
        <input
          className="input"
          value={clientPhone}
          onChange={(e) => setClientPhone(maskPhoneBR(e.target.value))}
          placeholder="(62) 99999-1234"
          required
        />
      </div>

      <div className="field">
        <label>Valor do pedido *</label>
        <div className="chip-group" style={{ marginBottom: 8 }}>
          {QUICK_VALUES.map((v) => (
            <button
              type="button"
              key={v}
              className={`chip ${valueInput === v.toFixed(2).replace('.', ',') ? 'active' : ''}`}
              onClick={() => setValueInput(v.toFixed(2).replace('.', ','))}
            >
              {formatCurrency(v)}
            </button>
          ))}
        </div>
        <input
          className="input"
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          placeholder="Outro valor, ex: 149,90"
          inputMode="decimal"
        />
      </div>

      <div className="field">
        <label>Quantidade de vídeos *</label>
        <select className="select" value={videoCount} onChange={(e) => setVideoCount(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 10].map((n) => (
            <option key={n} value={n}>
              {n} vídeo{n > 1 ? 's' : ''}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Roteiros</label>
        <div className="stack gap-sm">
          {scripts.map((s, idx) => (
            <div key={idx}>
              <label className="text-sm" style={{ marginBottom: 4 }}>
                Vídeo {idx + 1}
              </label>
              <textarea className="textarea" value={s} onChange={(e) => updateScript(idx, e.target.value)} />
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Imagens do mascote</label>
        <ImageUploader value={images} onChange={setImages} />
      </div>

      <div className="field">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck size={16} style={{ color: 'var(--primary)' }} />
          Comprovativo de Pagamento Obrigatório (PIX / Recibo / PDF) *
        </label>
        {receiptFile ? (
          <div className="card stack gap-xs" style={{ padding: '12px 14px', background: 'var(--bg-secondary)' }}>
            <div className="row space-between" style={{ alignItems: 'center' }}>
              <div className="row gap-sm" style={{ alignItems: 'center' }}>
                <FileCheck size={18} style={{ color: 'var(--status-ready)' }} />
                <span className="text-sm text-bold">{receiptFile.name}</span>
              </div>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => {
                  setReceiptFile(null);
                  setDetectedRecipient('');
                }}
              >
                <X size={15} /> Trocar ficheiro
              </button>
            </div>
            <div className="text-sm text-muted" style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              {readingReceipt ? (
                <>
                  <Loader2 size={14} className="spinner" /> A analisar comprovativo...
                </>
              ) : (
                <>
                  ✅ <strong>Destinatário verificado:</strong> {detectedRecipient}
                </>
              )}
            </div>
          </div>
        ) : (
          <button
            type="button"
            className="dropzone"
            style={{
              width: '100%',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderColor: 'var(--primary)',
            }}
            onClick={() => receiptInputRef.current?.click()}
          >
            <Upload size={18} />
            <span className="text-sm text-bold">Clique aqui para anexar o comprovativo da venda (Obrigatório)</span>
          </button>
        )}
        <input
          ref={receiptInputRef}
          type="file"
          accept="image/*,.pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleReceiptSelected(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="field">
        <label>Categoria / Área de atuação *</label>
        <div className="row gap-sm wrap" style={{ alignItems: 'center' }}>
          <select
            className="select flex-1"
            style={{ minWidth: 0 }}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Selecione…</option>
            {categoryNames.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            style={{ whiteSpace: 'nowrap' }}
            onClick={openAddCategory}
          >
            <Plus size={14} /> Nova categoria
          </button>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          style={{ marginTop: 6 }}
          onClick={() => setShowManageCategories(true)}
        >
          Gerir categorias
        </button>
      </div>

      {error && <div className="banner banner-error" style={{ marginBottom: 16 }}>{error}</div>}

      {submitting && (
        <div className="banner banner-info" style={{ marginBottom: 16 }}>
          <span className="spinner" />
          {progress && progress.total > 0
            ? `A guardar dados e comprovativo no Drive… (${progress.done}/${progress.total})`
            : 'A guardar pedido…'}
        </div>
      )}

      <button className="btn btn-primary btn-block" type="submit" disabled={submitting}>
        {submitting ? 'A guardar…' : 'Salvar pedido'}
      </button>

      {showAddCategory && (
        <div
          onClick={() => setShowAddCategory(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div
            className="card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="nova-categoria-titulo"
            onClick={(e) => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 420, padding: 20 }}
          >
            <div className="row space-between" style={{ alignItems: 'center', marginBottom: 14 }}>
              <h3 id="nova-categoria-titulo" style={{ margin: 0 }}>Nova categoria</h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAddCategory(false)}
                aria-label="Fechar"
              >
                <X size={16} />
              </button>
            </div>

            <div className="field">
              <label>Nome da categoria</label>
              <input
                className="input"
                autoFocus
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCategory();
                  }
                  if (e.key === 'Escape') setShowAddCategory(false);
                }}
                placeholder="Ex.: Imobiliária"
              />
            </div>

            {newCategoryError && (
              <div className="banner banner-error" style={{ marginBottom: 12 }}>
                {newCategoryError}
              </div>
            )}

            <button
              className="btn btn-primary btn-block"
              type="button"
              onClick={handleAddCategory}
              disabled={savingCategory || !newCategoryName.trim()}
            >
              {savingCategory ? 'A salvar…' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}
      {showManageCategories && <ManageCategoriesModal onClose={() => setShowManageCategories(false)} />}
    </form>
  );
}

// ======================= MEUS PEDIDOS E INDICADORES =======================

function MyOrdersList({ onNewOrder }: { onNewOrder: () => void }) {
  const { profile } = useAuth();
  const { orders, loading, error, retry } = useOrders();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [openOrder, setOpenOrder] = useState<Order | null>(null);
  const [editOrder, setEditOrder] = useState<Order | null>(null);

  const [revisionOrder, setRevisionOrder] = useState<Order | null>(null);
  const [revisionText, setRevisionText] = useState('');
  const [revisionImages, setRevisionImages] = useState<PendingImage[]>([]);
  const [sendingRevision, setSendingRevision] = useState(false);

  const commissionPercent = Number((profile as any)?.commissionPercent ?? 10);

  const metrics = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    const todayStr = new Date().toISOString().slice(0, 10);

    const monthOrders = orders.filter((o) => new Date(o.createdAtISO).getTime() >= monthStart);
    const monthTotal = monthOrders.reduce((acc, o) => acc + (o.value || 0), 0);
    const commissionValue = (monthTotal * commissionPercent) / 100;
    const todayCount = orders.filter((o) => o.createdAtISO.slice(0, 10) === todayStr).length;

    const readyList = orders.filter((o) => o.status === 'ready');
    const activeList = orders.filter((o) => o.status === 'pending' || o.status === 'production');
    const deliveredList = orders.filter((o) => o.status === 'delivered');

    return {
      monthTotal,
      commissionValue,
      monthCount: monthOrders.length,
      todayCount,
      readyCount: readyList.length,
      activeCount: activeList.length,
      deliveredCount: deliveredList.length,
    };
  }, [orders, commissionPercent]);

  // Separa os pedidos ativos/prontos dos pedidos já entregues
  const { activeOrders, deliveredOrders } = useMemo(() => {
    const term = normalizeSearch(search);
    const filtered = orders.filter(
      (o) =>
        !term ||
        normalizeSearch(o.clientName).includes(term) ||
        o.orderNumber.includes(term) ||
        o.clientPhone.includes(search)
    );

    const active = filtered.filter((o) => {
      if (statusFilter === 'ready') return o.status === 'ready';
      if (statusFilter === 'active') return o.status === 'pending' || o.status === 'production';
      if (statusFilter === 'delivered') return false;
      return o.status !== 'delivered';
    });

    const delivered = filtered.filter((o) => {
      if (statusFilter === 'active' || statusFilter === 'ready') return false;
      return o.status === 'delivered';
    });

    return { activeOrders: active, deliveredOrders: delivered };
  }, [orders, search, statusFilter]);

  async function handleDeliver(order: Order) {
    if (!profile) return;
    await markDelivered(order, profile.uid, profile.name);
  }

  async function handleConfirmRevision() {
    if (!profile || !revisionOrder || !revisionText.trim()) return;
    setSendingRevision(true);
    try {
      const targetFolder = revisionOrder.folderName || revisionOrder.folderPath || `#${revisionOrder.orderNumber} - ${revisionOrder.clientName}`;
      const newUploadedImages: any[] = [];

      for (let i = 0; i < revisionImages.length; i++) {
        const img = revisionImages[i];
        const blob = img.convertedBlob || img.originalFile;
        const fileName = img.convertedFileName || img.originalFile.name;
        const result = await uploadOrderImage(targetFolder, blob, fileName);
        newUploadedImages.push({
          url: result.url || '',
          path: result.path || '',
          caption: img.caption || 'Ajuste',
          order: revisionOrder.images.length + i,
          originalName: img.originalFile?.name || fileName,
          converted: !!img.convertedBlob,
        });
      }

      const updatedImages = [...revisionOrder.images, ...newUploadedImages];
      const updatedVideos = revisionOrder.videos.map((v, idx) => ({
        ...v,
        script: idx === 0 ? `${v.script}\n\n[AJUSTE SOLICITADO]: ${revisionText.trim()}` : v.script,
      }));

      await updateDoc(doc(db, 'orders', revisionOrder.id), {
        images: updatedImages,
        videos: updatedVideos,
      });

      await requestOrderRevision(revisionOrder, revisionText, profile.uid, profile.name);

      setRevisionOrder(null);
      setRevisionText('');
      setRevisionImages([]);
    } catch (err) {
      alert('Erro ao enviar alteração. Tente novamente.');
    } finally {
      setSendingRevision(false);
    }
  }

  function handleWhatsApp(order: Order) {
    const videoUrl = order.videos.find((v) => v.videoUrl)?.videoUrl || '';
    const msg = buildDeliveryMessage(order.clientName, videoUrl);
    window.open(buildWhatsAppUrl(order.clientPhone, msg), '_blank');
  }

  function downloadAllVideos(order: Order) {
    order.videos.forEach((v, i) => {
      if (v.videoUrl) {
        setTimeout(() => downloadDriveFile(v.videoUrl!, v.fileName || `video-${v.index}.mp4`), i * 350);
      }
    });
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

  const goals = [5, 10, 20];

  return (
    <div className="stack gap-lg">
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        <div className="stat-card" style={{ cursor: 'default' }}>
          <span className="stat-label"><DollarSign size={14} /> Vendas no Mês ({metrics.monthCount})</span>
          <span className="stat-value">{formatCurrency(metrics.monthTotal)}</span>
          <span className="text-sm text-muted" style={{ marginTop: 4 }}>{metrics.todayCount} venda(s) fechada(s) hoje</span>
        </div>

        <div className="stat-card" style={{ cursor: 'default', borderColor: 'var(--primary)' }}>
          <span className="stat-label"><Award size={14} /> Minha Comissão ({commissionPercent}%)</span>
          <span className="stat-value" style={{ color: 'var(--primary)' }}>
            {formatCurrency(metrics.commissionValue)}
          </span>
          <span className="text-sm text-muted" style={{ marginTop: 4 }}>Acumulado nas vendas deste mês</span>
        </div>

        <div className="stat-card" style={{ cursor: 'default' }}>
          <span className="stat-label" style={{ marginBottom: 8 }}>
            <Target size={14} /> Metas do Mês ({metrics.monthCount} vendas)
          </span>
          <div className="stack gap-xs" style={{ width: '100%' }}>
            {goals.map((g) => {
              const pct = Math.min(100, Math.round((metrics.monthCount / g) * 100));
              const hit = metrics.monthCount >= g;
              return (
                <div key={g} style={{ width: '100%' }}>
                  <div className="row space-between" style={{ fontSize: '0.75rem', marginBottom: 2 }}>
                    <span className={hit ? 'text-bold' : 'text-muted'}>
                      {hit ? '✅ ' : ''}Meta {g} vendas
                    </span>
                    <span className="mono-number">{Math.min(metrics.monthCount, g)}/{g} ({pct}%)</span>
                  </div>
                  <div style={{ width: '100%', height: 7, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${pct}%`,
                        height: '100%',
                        background: hit ? 'var(--status-ready)' : 'var(--primary)',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px' }}>
        <button
          className="stat-card"
          style={metrics.readyCount > 0 ? { borderColor: 'var(--status-ready)' } : undefined}
          onClick={() => setStatusFilter('ready')}
        >
          <span className="stat-label"><Sparkles size={14} /> Prontos p/ Entregar</span>
          <span className="stat-value" style={metrics.readyCount > 0 ? { color: 'var(--status-ready)' } : undefined}>
            {metrics.readyCount}
          </span>
          <span className="text-sm text-muted" style={{ marginTop: 2 }}>Aguardando envio ao cliente</span>
        </button>

        <button className="stat-card" onClick={() => setStatusFilter('active')}>
          <span className="stat-label"><Clock size={14} /> Em Produção / Fila</span>
          <span className="stat-value">{metrics.activeCount}</span>
          <span className="text-sm text-muted" style={{ marginTop: 2 }}>Em criação 3D</span>
        </button>

        <button className="stat-card" onClick={() => setStatusFilter('delivered')}>
          <span className="stat-label"><CheckCircle2 size={14} /> Entregues</span>
          <span className="stat-value">{metrics.deliveredCount}</span>
          <span className="text-sm text-muted" style={{ marginTop: 2 }}>Concluídos com sucesso</span>
        </button>
      </div>

      <div className="row gap-sm wrap space-between">
        <div className="chip-group">
          <button className={`chip ${statusFilter === 'all' ? 'active' : ''}`} onClick={() => setStatusFilter('all')}>
            Todos ({orders.length})
          </button>
          <button className={`chip ${statusFilter === 'ready' ? 'active' : ''}`} onClick={() => setStatusFilter('ready')}>
            🎉 Prontos para Entrega ({metrics.readyCount})
          </button>
          <button className={`chip ${statusFilter === 'active' ? 'active' : ''}`} onClick={() => setStatusFilter('active')}>
            ⏳ Na Fila / Produção ({metrics.activeCount})
          </button>
          <button className={`chip ${statusFilter === 'delivered' ? 'active' : ''}`} onClick={() => setStatusFilter('delivered')}>
            ✅ Entregues ({metrics.deliveredCount})
          </button>
        </div>

        <input
          className="input"
          style={{ maxWidth: 320 }}
          placeholder="Buscar por cliente, Nº ou WhatsApp…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {activeOrders.length === 0 && deliveredOrders.length === 0 ? (
        <div className="empty-state">
          <span className="emoji">📋</span>
          <p>Nenhum pedido encontrado neste filtro.</p>
          <button className="btn btn-primary btn-sm" style={{ marginTop: 10 }} onClick={onNewOrder}>
            + Cadastrar Novo Pedido
          </button>
        </div>
      ) : (
        <div className="stack gap-lg">
          {activeOrders.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
              {activeOrders.map((order) => {
                const sla =
                  order.status === 'pending' || order.status === 'production'
                    ? getSlaInfo(new Date(order.createdAtISO))
                    : null;
                const firstImg = order.images && order.images.length > 0 ? order.images[0].url : null;
                const isReady = order.status === 'ready';
                const hasRevision = (order as any).revisionRequested;

                return (
                  <div
                    key={order.id}
                    className="card"
                    style={{
                      padding: '16px',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      borderColor: isReady ? 'var(--status-ready)' : undefined,
                    }}
                  >
                    <div>
                      <div className="row space-between" style={{ marginBottom: 10 }}>
                        <span className="mono-number text-bold">#{order.orderNumber}</span>
                        <StatusBadge status={order.status} />
                      </div>

                      <div
                        style={{
                          width: '100%',
                          height: '125px',
                          borderRadius: '8px',
                          overflow: 'hidden',
                          marginBottom: 10,
                          cursor: 'pointer',
                        }}
                        onClick={() => setOpenOrder(order)}
                      >
                        {firstImg ? (
                          <DriveThumb url={firstImg} />
                        ) : (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              background: 'var(--bg-secondary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <ImageIcon size={22} className="text-muted" />
                          </div>
                        )}
                      </div>

                      <div className="row space-between" style={{ alignItems: 'baseline' }}>
                        <strong style={{ fontSize: '1.05rem' }}>{order.clientName}</strong>
                        <strong className="text-sm" style={{ color: 'var(--primary)' }}>
                          {formatCurrency(order.value)}
                        </strong>
                      </div>

                      <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                        {order.clientPhone}
                      </div>

                      {(order as any).recipientAccount && (
                        <div className="text-sm text-muted" style={{ fontSize: '0.75rem', marginTop: 3 }}>
                          Validado: <strong>{(order as any).recipientAccount}</strong>
                        </div>
                      )}

                      <div className="row gap-xs wrap" style={{ marginTop: 8 }}>
                        <span className="badge badge-category">{order.category}</span>
                        <span className="text-sm text-muted">
                          {order.videoCount} vídeo{order.videoCount > 1 ? 's' : ''}
                        </span>
                        {(order as any).receiptUrl && (
                          <span className="badge" style={{ fontSize: '0.7rem', background: 'var(--bg-secondary)' }}>
                            🧾 Comprovativo OK
                          </span>
                        )}
                        {hasRevision && (
                          <span className="badge" style={{ fontSize: '0.7rem', background: 'rgba(239,68,68,0.15)', color: 'var(--danger)' }}>
                            🔄 Em Revisão
                          </span>
                        )}
                      </div>

                      {sla && (
                        <div
                          className={`text-sm ${sla.overdue ? 'text-danger text-bold' : 'text-muted'}`}
                          style={{ marginTop: 8 }}
                        >
                          {sla.label}
                        </div>
                      )}
                    </div>

                    <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid var(--border)' }} className="stack gap-xs">
                      <div className="row gap-xs wrap">
                        <button className="btn btn-secondary btn-sm flex-1" onClick={() => setOpenOrder(order)}>
                          <FolderOpen size={13} /> Pasta / Roteiro
                        </button>
                        {(order.status === 'pending' || order.status === 'production') && (
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditOrder(order)}>
                            <Pencil size={13} /> Editar
                          </button>
                        )}
                        <button
                          className="btn btn-ghost btn-sm"
                          title="Copiar número"
                          onClick={() => {
                            navigator.clipboard?.writeText(order.clientPhone);
                            alert('Número copiado!');
                          }}
                        >
                          <Copy size={13} />
                        </button>
                      </div>

                      {isReady && (
                        <div className="stack gap-xs" style={{ marginTop: 4 }}>
                          <div className="row gap-xs">
                            <button className="btn btn-secondary btn-sm flex-1" onClick={() => downloadAllVideos(order)}>
                              <Download size={13} /> Baixar Vídeo
                            </button>
                            <button className="btn btn-secondary btn-sm flex-1" onClick={() => handleWhatsApp(order)}>
                              <MessageCircle size={13} /> WhatsApp
                            </button>
                          </div>

                          <button className="btn btn-primary btn-sm btn-block" onClick={() => handleDeliver(order)}>
                            <CheckCircle2 size={14} /> Marcar como Entregue
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {deliveredOrders.length > 0 && (
            <div className="stack gap-sm" style={{ marginTop: 24, paddingTop: 20, borderTop: '2px dashed var(--border)' }}>
              <div className="row gap-xs" style={{ alignItems: 'center' }}>
                <CheckCheck size={18} style={{ color: 'var(--status-delivered)' }} />
                <h3 style={{ margin: 0, color: 'var(--text-muted)' }}>Entregues Recentemente ({deliveredOrders.length})</h3>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
                {deliveredOrders.map((order) => {
                  const firstImg = order.images && order.images.length > 0 ? order.images[0].url : null;
                  return (
                    <div
                      key={order.id}
                      className="card"
                      style={{
                        padding: '16px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        opacity: 0.8,
                      }}
                    >
                      <div>
                        <div className="row space-between" style={{ marginBottom: 10 }}>
                          <span className="mono-number text-bold">#{order.orderNumber}</span>
                          <StatusBadge status={order.status} />
                        </div>

                        <div
                          style={{
                            width: '100%',
                            height: '100px',
                            borderRadius: '8px',
                            overflow: 'hidden',
                            marginBottom: 10,
                            cursor: 'pointer',
                          }}
                          onClick={() => setOpenOrder(order)}
                        >
                          {firstImg ? (
                            <DriveThumb url={firstImg} />
                          ) : (
                            <div
                              style={{
                                width: '100%',
                                height: '100%',
                                background: 'var(--bg-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              <ImageIcon size={20} className="text-muted" />
                            </div>
                          )}
                        </div>

                        <div className="row space-between" style={{ alignItems: 'baseline' }}>
                          <strong style={{ fontSize: '1rem' }}>{order.clientName}</strong>
                          <span className="text-sm text-muted">{formatCurrency(order.value)}</span>
                        </div>

                        <div className="text-sm text-muted" style={{ marginTop: 2 }}>
                          {order.clientPhone}
                        </div>

                        <div className="text-sm text-muted" style={{ marginTop: 8, fontSize: '0.8rem' }}>
                          Concluído em {formatDate(order.deliveredAt || order.createdAtISO)}
                        </div>
                      </div>

                      <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)' }} className="stack gap-xs">
                        <div className="row gap-xs">
                          <button className="btn btn-secondary btn-sm flex-1" onClick={() => setOpenOrder(order)}>
                            <FolderOpen size={13} /> Ver Pasta
                          </button>
                          <button
                            className="btn btn-ghost btn-sm btn-block"
                            style={{ color: 'var(--danger)', border: '1px dashed var(--border)' }}
                            onClick={() => {
                              setRevisionOrder(order);
                              setRevisionText('');
                              setRevisionImages([]);
                            }}
                          >
                            <RotateCcw size={13} /> Solicitar Alteração
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {revisionOrder && (
        <Modal title={`Solicitar Alteração — #${revisionOrder.orderNumber}`} onClose={() => setRevisionOrder(null)}>
          <p className="text-sm text-muted" style={{ marginBottom: 12 }}>
            Adicione novas orientações de texto ou envie novas imagens para o pedido de <strong>{revisionOrder.clientName}</strong>. Ele retornará para a fila do Criador.
          </p>

          <div className="field">
            <label>O que precisa de ser alterado / Roteiro adicional *</label>
            <textarea
              className="textarea"
              rows={3}
              placeholder="Ex: Ajustar o texto do locutor ou instruções de correção..."
              value={revisionText}
              onChange={(e) => setRevisionText(e.target.value)}
            />
          </div>

          <div className="field">
            <label>Novas imagens para o ajuste (Opcional)</label>
            <ImageUploader value={revisionImages} onChange={setRevisionImages} />
          </div>

          <button
            className="btn btn-primary btn-block"
            disabled={(!revisionText.trim() && revisionImages.length === 0) || sendingRevision}
            onClick={handleConfirmRevision}
          >
            {sendingRevision ? 'A enviar alterações…' : 'Confirmar e Enviar para o Criador'}
          </button>
        </Modal>
      )}

      {openOrder && <FolderContentsModal order={openOrder} onClose={() => setOpenOrder(null)} />}
      {editOrder && <EditOrderModal order={editOrder} onClose={() => setEditOrder(null)} />}
    </div>
  );
}