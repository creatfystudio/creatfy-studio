import React, { useMemo, useState } from 'react';
import SellerArea from '../seller/SellerArea';
import CreatorArea from '../creator/CreatorArea';
import {
  Users as UsersIcon,
  DollarSign,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar as CalendarIcon,
  Trash2,
  FolderOpen,
  Download,
  ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useOrders } from '../../lib/useOrders';
import { deleteOrder, bulkDeleteOrders, clearAllData } from '../../lib/orders';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getSlaInfo,
  normalizeSearch,
  startOfDay,
  endOfDay,
  startOfWeek,
  startOfMonth,
  endOfMonth,
} from '../../lib/utils';
import { triggerBrowserDownload } from '../../lib/storage';
import { MASTER_EMAIL } from '../../lib/firebase';
import type { Order, OrderStatus } from '../../types';
import { STATUS_LABELS } from '../../types';
import StatusBadge from '../../components/StatusBadge';
import EditOrderModal from '../../components/EditOrderModal';
import FolderContentsModal from '../../components/FolderContentsModal';
import { ConfirmDialog } from '../../components/Modal';
import CalendarPopover from '../../components/CalendarPopover';
import SimpleBarChart from '../../components/SimpleBarChart';
import UsersManagementView from './UsersManagementView';

type MainTab = 'panel' | 'seller' | 'creator' | 'leads' | 'allVideos' | 'finalized' | 'users';
type CardView = null | 'clients' | 'value' | 'ready' | 'pending' | 'emergency';

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function ManagerDashboard() {
  const { profile } = useAuth();
  const { orders, loading, error, retry } = useOrders();
  const [mainTab, setMainTab] = useState<MainTab>('panel');

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
        {error}{' '}
        <button className="btn btn-sm btn-secondary" onClick={retry}>
          Tentar novamente
        </button>
      </div>
    );
  }

  const isMaster = profile?.email === MASTER_EMAIL;

  return (
    <div className="stack gap-lg">
      <div className="row space-between wrap gap-sm">
        <div>
          <h2>Painel Geral</h2>
          <p className="text-sm">Visão completa da operação do Mascotfy Studio.</p>
        </div>
        <div className="navbar-tabs" style={{ padding: 0 }}>
          <button className={`navbar-tab ${mainTab === 'panel' ? 'active' : ''}`} onClick={() => setMainTab('panel')}>
            Painel
          </button>
          <button className={`navbar-tab ${mainTab === 'seller' ? 'active' : ''}`} onClick={() => setMainTab('seller')}>
            Área do Vendedor
          </button>
          <button className={`navbar-tab ${mainTab === 'creator' ? 'active' : ''}`} onClick={() => setMainTab('creator')}>
            Área do Criador
          </button>
          <button className={`navbar-tab ${mainTab === 'leads' ? 'active' : ''}`} onClick={() => setMainTab('leads')}>
            Dados dos Leads
          </button>
          <button className={`navbar-tab ${mainTab === 'allVideos' ? 'active' : ''}`} onClick={() => setMainTab('allVideos')}>
            Todos os Vídeos
          </button>
          <button className={`navbar-tab ${mainTab === 'finalized' ? 'active' : ''}`} onClick={() => setMainTab('finalized')}>
            Finalizados
          </button>
          {isMaster && (
            <button className={`navbar-tab ${mainTab === 'users' ? 'active' : ''}`} onClick={() => setMainTab('users')}>
              Usuários
            </button>
          )}
        </div>
      </div>

      {mainTab === 'panel' && <PanelView orders={orders} />}
      {mainTab === 'seller' && <SellerArea />}
      {mainTab === 'creator' && <CreatorArea />}
      {mainTab === 'leads' && <LeadsFoldersView orders={orders} />}
      {mainTab === 'allVideos' && <ManagerAllVideosTab orders={orders} />}
      {mainTab === 'finalized' && <ManagerFinalizedTab orders={orders.filter((o) => o.status === 'ready' || o.status === 'delivered')} />}
      {mainTab === 'users' && <UsersManagementView />}
    </div>
  );
}

// ======================= PAINEL =======================

function PanelView({ orders }: { orders: Order[] }) {
  const [cardView, setCardView] = useState<CardView>(null);
  const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
  const [shortcut, setShortcut] = useState<'today' | 'week' | 'month' | 'all' | 'custom'>('all');
  const [showCalendar, setShowCalendar] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sellerFilter, setSellerFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Order | null>(null);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [busy, setBusy] = useState(false);

  const now = new Date();

  function applyShortcut(s: typeof shortcut) {
    setShortcut(s);
    if (s === 'today') setDateRange({ start: startOfDay(now), end: endOfDay(now) });
    else if (s === 'week') setDateRange({ start: startOfWeek(now), end: endOfDay(now) });
    else if (s === 'month') setDateRange({ start: startOfMonth(now), end: endOfMonth(now) });
    else if (s === 'all') setDateRange({ start: null, end: null });
  }

  const datesWithOrders = useMemo(() => new Set(orders.map((o) => dateKey(new Date(o.createdAtISO)))), [orders]);

  const dateFiltered = useMemo(() => {
    if (!dateRange.start || !dateRange.end) return orders;
    return orders.filter((o) => {
      const t = new Date(o.createdAtISO).getTime();
      return t >= dateRange.start!.getTime() && t <= dateRange.end!.getTime();
    });
  }, [orders, dateRange]);

  const sellers = useMemo(() => Array.from(new Set(orders.map((o) => o.sellerName))).sort(), [orders]);
  const categories = useMemo(() => Array.from(new Set(orders.map((o) => o.category))).sort(), [orders]);

  const tableFiltered = useMemo(() => {
    const term = normalizeSearch(search);
    return dateFiltered.filter(
      (o) =>
        (!term || normalizeSearch(o.clientName).includes(term) || o.orderNumber.includes(term)) &&
        (!statusFilter || o.status === statusFilter) &&
        (!sellerFilter || o.sellerName === sellerFilter) &&
        (!categoryFilter || o.category === categoryFilter)
    );
  }, [dateFiltered, search, statusFilter, sellerFilter, categoryFilter]);

  const readyOrders = dateFiltered.filter((o) => o.status === 'ready');
  const toFinalize = dateFiltered.filter((o) => o.status === 'pending' || o.status === 'production');
  const emergencyList = useMemo(
    () =>
      toFinalize
        .map((o) => ({ order: o, sla: getSlaInfo(new Date(o.createdAtISO)) }))
        .filter((x) => x.sla.overdue)
        .sort((a, b) => b.sla.businessDaysLate - a.sla.businessDaysLate),
    [toFinalize]
  );
  const totalValue = dateFiltered.reduce((sum, o) => sum + o.value, 0);
  const todayCount = orders.filter((o) => dateKey(new Date(o.createdAtISO)) === dateKey(now)).length;

  const chartData = useMemo(() => {
    const days: { label: string; value: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      const count = orders.filter((o) => dateKey(new Date(o.createdAtISO)) === key).length;
      days.push({ label: d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }), value: count });
    }
    return days;
  }, [orders]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.size === tableFiltered.length ? new Set() : new Set(tableFiltered.map((o) => o.id))));
  }

  const rangeLabel =
    dateRange.start && dateRange.end
      ? dateRange.start.getTime() === startOfDay(dateRange.start).getTime() && dateKey(dateRange.start) === dateKey(dateRange.end)
        ? `Exibindo: ${formatDate(dateRange.start)}`
        : `Exibindo: ${formatDate(dateRange.start)} a ${formatDate(dateRange.end)}`
      : null;

  if (cardView) {
    return (
      <CardDetailView
        view={cardView}
        onBack={() => setCardView(null)}
        orders={dateFiltered}
        readyOrders={readyOrders}
        toFinalize={toFinalize}
        emergencyList={emergencyList}
        totalValue={totalValue}
        onOpenOrder={setEditOrder}
      />
    );
  }

  return (
    <div className="stack gap-lg">
      <div className="grid-cards">
        <button className="stat-card" onClick={() => setCardView('clients')}>
          <span className="stat-label"><UsersIcon size={14} /> Clientes vendidos</span>
          <span className="stat-value">{dateFiltered.length}</span>
        </button>
        <button className="stat-card" onClick={() => setCardView('value')}>
          <span className="stat-label"><DollarSign size={14} /> Valor total em vendas</span>
          <span className="stat-value">{formatCurrency(totalValue)}</span>
        </button>
        <button className="stat-card" onClick={() => setCardView('ready')}>
          <span className="stat-label"><CheckCircle2 size={14} /> Vídeos prontos</span>
          <span className="stat-value">{readyOrders.length}</span>
        </button>
        <button className="stat-card" onClick={() => setCardView('pending')}>
          <span className="stat-label"><Clock size={14} /> Vídeos a finalizar</span>
          <span className="stat-value">{toFinalize.length}</span>
        </button>
        <button className={`stat-card ${emergencyList.length > 0 ? 'emergency' : ''}`} onClick={() => setCardView('emergency')}>
          <span className="stat-label"><AlertTriangle size={14} /> Emergência</span>
          <span className="stat-value">{emergencyList.length}</span>
        </button>
      </div>

      <div className="card">
        <div className="row space-between wrap gap-sm" style={{ marginBottom: 14 }}>
          <h4>Vendas por dia (últimos 14 dias)</h4>
          <span className="text-sm text-muted">{todayCount} pedido{todayCount !== 1 ? 's' : ''} hoje</span>
        </div>
        <SimpleBarChart data={chartData} />
      </div>

      <div className="card">
        <div className="row gap-sm wrap" style={{ marginBottom: 14, position: 'relative' }}>
          {(['today', 'week', 'month', 'all'] as const).map((s) => (
            <button
              key={s}
              className={`chip ${shortcut === s ? 'active' : ''}`}
              onClick={() => applyShortcut(s)}
            >
              {s === 'today' ? 'Hoje' : s === 'week' ? 'Esta semana' : s === 'month' ? 'Este mês' : 'Todos'}
            </button>
          ))}
          <button className={`chip ${shortcut === 'custom' ? 'active' : ''}`} onClick={() => setShowCalendar((v) => !v)} style={{ position: 'relative' }}>
            <CalendarIcon size={14} /> Personalizado
          </button>
          {showCalendar && (
            <CalendarPopover
              datesWithOrders={datesWithOrders}
              onPickDay={(d) => {
                setShortcut('custom');
                setDateRange({ start: startOfDay(d), end: endOfDay(d) });
                setShowCalendar(false);
              }}
              onPickRange={(start, end) => {
                setShortcut('custom');
                setDateRange({ start: startOfDay(start), end: endOfDay(end) });
                setShowCalendar(false);
              }}
              onClose={() => setShowCalendar(false)}
            />
          )}
          {rangeLabel && (
            <span className="row gap-sm text-sm">
              <strong>{rangeLabel}</strong>
              <button className="btn btn-ghost btn-sm" onClick={() => applyShortcut('all')}>
                Limpar filtro
              </button>
            </span>
          )}
        </div>

        <div className="row gap-sm wrap" style={{ marginBottom: 14 }}>
          <input className="input flex-1" placeholder="Buscar por nome ou número…" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="select" style={{ maxWidth: 170 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">Todos os status</option>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
          <select className="select" style={{ maxWidth: 170 }} value={sellerFilter} onChange={(e) => setSellerFilter(e.target.value)}>
            <option value="">Todos os vendedores</option>
            {sellers.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <select className="select" style={{ maxWidth: 190 }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">Todas as categorias</option>
            {categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {selected.size > 0 && (
          <div className="banner banner-info" style={{ marginBottom: 14 }}>
            {selected.size} selecionado{selected.size > 1 ? 's' : ''}
            <button className="btn btn-danger btn-sm" style={{ marginLeft: 'auto' }} onClick={() => setBulkDeleteConfirm(true)}>
              <Trash2 size={13} /> Excluir selecionados
            </button>
          </div>
        )}

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={selected.size > 0 && selected.size === tableFiltered.length} onChange={toggleSelectAll} />
                </th>
                <th>Nº</th>
                <th>Cliente</th>
                <th>Categoria</th>
                <th>Vendedor</th>
                <th>Valor</th>
                <th>Vídeos</th>
                <th>Status</th>
                <th>Data</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {tableFiltered.map((o) => (
                <tr key={o.id}>
                  <td><input type="checkbox" checked={selected.has(o.id)} onChange={() => toggleSelect(o.id)} /></td>
                  <td className="mono-number">#{o.orderNumber}</td>
                  <td>{o.clientName}</td>
                  <td><span className="badge badge-category">{o.category}</span></td>
                  <td>{o.sellerName}</td>
                  <td>{formatCurrency(o.value)}</td>
                  <td>{o.videoCount}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{formatDate(o.createdAtISO)}</td>
                  <td>
                    <button className="btn btn-secondary btn-sm" onClick={() => setEditOrder(o)}>Abrir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tableFiltered.length === 0 && <p className="text-sm text-muted" style={{ marginTop: 14 }}>Nenhum pedido encontrado.</p>}

        <button className="btn btn-danger btn-sm" style={{ marginTop: 18 }} onClick={() => setClearAllConfirm(true)}>
          <Trash2 size={14} /> Limpar todos os dados
        </button>
      </div>

      {editOrder && (
        <EditOrderModal
          order={editOrder}
          allowStatusChange
          onClose={() => setEditOrder(null)}
          onRequestDelete={() => {
            setDeleteTarget(editOrder);
            setEditOrder(null);
          }}
        />
      )}

      {deleteTarget && (
        <ConfirmDialog
          title="Excluir pedido"
          message={`O pedido #${deleteTarget.orderNumber} de ${deleteTarget.clientName} e todos os arquivos da pasta serão excluídos permanentemente.`}
          confirmLabel="Excluir"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            setBusy(true);
            await deleteOrder(deleteTarget);
            setBusy(false);
            setDeleteTarget(null);
          }}
        />
      )}

      {bulkDeleteConfirm && (
        <ConfirmDialog
          title="Excluir pedidos selecionados"
          message={`${selected.size} pedido(s) e seus arquivos serão excluídos permanentemente.`}
          confirmLabel="Excluir selecionados"
          danger
          onCancel={() => setBulkDeleteConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            await bulkDeleteOrders(tableFiltered.filter((o) => selected.has(o.id)));
            setSelected(new Set());
            setBusy(false);
            setBulkDeleteConfirm(false);
          }}
        />
      )}

      {clearAllConfirm && (
        <ConfirmDialog
          title="Limpar todos os dados"
          message="Isso vai apagar TODOS os pedidos, imagens e vídeos do sistema, permanentemente. Esta ação não pode ser desfeita."
          confirmLabel="Limpar tudo"
          danger
          requireText="LIMPAR"
          onCancel={() => setClearAllConfirm(false)}
          onConfirm={async () => {
            setBusy(true);
            await clearAllData(orders);
            setBusy(false);
            setClearAllConfirm(false);
          }}
        />
      )}

      {busy && (
        <div className="modal-backdrop">
          <span className="spinner" />
        </div>
      )}
    </div>
  );
}

// ======================= CARD DETAIL PAGES =======================

function CardDetailView({
  view,
  onBack,
  orders,
  readyOrders,
  toFinalize,
  emergencyList,
  totalValue,
  onOpenOrder,
}: {
  view: Exclude<CardView, null>;
  onBack: () => void;
  orders: Order[];
  readyOrders: Order[];
  toFinalize: Order[];
  emergencyList: { order: Order; sla: ReturnType<typeof getSlaInfo> }[];
  totalValue: number;
  onOpenOrder: (o: Order) => void;
}) {
  const titles: Record<Exclude<CardView, null>, string> = {
    clients: 'Clientes vendidos',
    value: 'Valor total em vendas',
    ready: 'Vídeos prontos',
    pending: 'Vídeos a finalizar',
    emergency: 'Emergência',
  };

  return (
    <div>
      <button className="btn btn-ghost btn-sm" onClick={onBack} style={{ marginBottom: 12 }}>
        <ArrowLeft size={14} /> Voltar ao painel
      </button>
      <h3 style={{ marginBottom: 16 }}>{titles[view]}</h3>

      {view === 'clients' && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Nº</th><th>Cliente</th><th>Número</th><th>Categoria</th><th>Vendedor</th><th>Valor</th><th>Vídeos</th><th>Status</th><th>Data</th></tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => onOpenOrder(o)}>
                  <td className="mono-number">#{o.orderNumber}</td>
                  <td>{o.clientName}</td>
                  <td>{o.clientPhone}</td>
                  <td>{o.category}</td>
                  <td>{o.sellerName}</td>
                  <td>{formatCurrency(o.value)}</td>
                  <td>{o.videoCount}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td>{formatDate(o.createdAtISO)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {view === 'value' && <ValueBreakdown orders={orders} totalValue={totalValue} onOpenOrder={onOpenOrder} />}

      {view === 'ready' && (
        <div className="stack gap-sm">
          {readyOrders.length === 0 && <p className="text-sm text-muted">Nenhum vídeo pronto no período.</p>}
          {readyOrders.map((o) => (
            <div key={o.id} className="card row space-between wrap gap-sm">
              <div>
                <div className="row gap-sm"><span className="mono-number text-bold">#{o.orderNumber}</span><strong>{o.clientName}</strong></div>
                <div className="text-sm text-muted">{o.category} · {o.videoCount} vídeo{o.videoCount > 1 ? 's' : ''}</div>
              </div>
              <div className="row gap-sm">
                <button className="btn btn-secondary btn-sm" onClick={() => o.videos[0]?.videoUrl && triggerBrowserDownload(o.videos[0].videoUrl, o.videos[0].fileName || 'video.mp4')}>
                  <Download size={13} /> Baixar
                </button>
                <button className="btn btn-primary btn-sm" onClick={() => onOpenOrder(o)}>Abrir</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'pending' && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>Nº</th><th>Cliente</th><th>Categoria</th><th>Status</th><th>Prazo</th></tr></thead>
            <tbody>
              {toFinalize.map((o) => {
                const sla = getSlaInfo(new Date(o.createdAtISO));
                return (
                  <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => onOpenOrder(o)}>
                    <td className="mono-number">#{o.orderNumber}</td>
                    <td>{o.clientName}</td>
                    <td>{o.category}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td className={sla.overdue ? 'text-danger text-bold' : ''}>{sla.label}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'emergency' && (
        <div className="stack gap-sm">
          {emergencyList.length === 0 && <p className="text-sm text-muted">Nenhum pedido em atraso. 🎉</p>}
          {emergencyList.map(({ order, sla }) => (
            <div key={order.id} className="card" style={{ borderColor: 'var(--danger)', cursor: 'pointer' }} onClick={() => onOpenOrder(order)}>
              <div className="row space-between wrap gap-sm">
                <div>
                  <div className="row gap-sm"><span className="mono-number text-bold">#{order.orderNumber}</span><strong>{order.clientName}</strong></div>
                  <div className="text-sm text-muted">{order.category} · {order.sellerName} · {order.videoCount} vídeo{order.videoCount > 1 ? 's' : ''} · {formatDate(order.createdAtISO)}</div>
                </div>
                <span className="text-danger text-bold">{sla.label}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ValueBreakdown({ orders, totalValue, onOpenOrder }: { orders: Order[]; totalValue: number; onOpenOrder: (o: Order) => void }) {
  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.category, (map.get(o.category) || 0) + o.value));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [orders]);
  const bySeller = useMemo(() => {
    const map = new Map<string, number>();
    orders.forEach((o) => map.set(o.sellerName, (map.get(o.sellerName) || 0) + o.value));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [orders]);

  return (
    <div className="stack gap-lg">
      <div className="card">
        <div className="stat-label">Total do período</div>
        <div className="stat-value">{formatCurrency(totalValue)}</div>
      </div>
      <div className="row gap-lg wrap">
        <div className="card flex-1">
          <h4 style={{ marginBottom: 10 }}>Por categoria</h4>
          {byCategory.map(([cat, val]) => (
            <div key={cat} className="row space-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm">{cat}</span>
              <strong className="text-sm">{formatCurrency(val)}</strong>
            </div>
          ))}
        </div>
        <div className="card flex-1">
          <h4 style={{ marginBottom: 10 }}>Por vendedor</h4>
          {bySeller.map(([seller, val]) => (
            <div key={seller} className="row space-between" style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span className="text-sm">{seller}</span>
              <strong className="text-sm">{formatCurrency(val)}</strong>
            </div>
          ))}
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Valor</th><th>Data</th></tr></thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => onOpenOrder(o)}>
                <td className="mono-number">#{o.orderNumber}</td>
                <td>{o.clientName}</td>
                <td>{formatCurrency(o.value)}</td>
                <td>{formatDate(o.createdAtISO)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ======================= DADOS DOS LEADS =======================

function LeadsFoldersView({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('');
  const [openOrder, setOpenOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const term = normalizeSearch(search);
    return orders.filter(
      (o) => !term || normalizeSearch(o.clientName).includes(term) || o.orderNumber.includes(term) || o.clientPhone.includes(search)
    );
  }, [orders, search]);

  return (
    <div className="stack gap-md">
      <input className="input" placeholder="Buscar por Nº, nome ou telefone…" value={search} onChange={(e) => setSearch(e.target.value)} />
      <div className="stack gap-sm">
        {filtered.map((o) => (
          <div key={o.id} className="card row space-between wrap gap-sm" style={{ cursor: 'pointer' }} onClick={() => setOpenOrder(o)}>
            <div>
              <strong>{o.folderName}</strong>
              <div className="text-sm text-muted">{o.images.length} imagem(ns) · {o.videos.filter((v) => v.videoUrl).length} vídeo(s) enviados</div>
            </div>
            <button className="btn btn-secondary btn-sm"><FolderOpen size={14} /> Abrir</button>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted">Nenhuma pasta encontrada.</p>}
      </div>
      {openOrder && <FolderContentsModal order={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
}

// ======================= TODOS OS VÍDEOS (gestor) =======================

function ManagerAllVideosTab({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [openOrder, setOpenOrder] = useState<Order | null>(null);

  const items = useMemo(() => {
    const flat: { order: Order; video: Order['videos'][number] }[] = [];
    orders.forEach((o) => o.videos.filter((v) => v.videoUrl).forEach((v) => flat.push({ order: o, video: v })));
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
        <input className="input flex-1" placeholder="Buscar por Nº ou nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 220 }} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">Todas as categorias</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="thumb-grid">
        {items.map(({ order, video }) => (
          <div key={`${order.id}-${video.index}`}>
            <div className="thumb" style={{ cursor: 'pointer' }} onClick={() => setOpenOrder(order)}>
              <video src={video.videoUrl} />
            </div>
            <div className="text-sm text-bold">#{order.orderNumber} · {order.clientName}</div>
            <div className="text-sm text-muted">Vídeo {video.index} de {order.videoCount} · {order.sellerName} → {order.finishedBy || '—'}</div>
            <div className="text-sm text-muted">{formatDate(video.uploadedAt)}</div>
            <button className="btn btn-ghost btn-sm" onClick={() => triggerBrowserDownload(video.videoUrl!, video.fileName || 'video.mp4')}>
              <Download size={12} /> Baixar
            </button>
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-muted">Nenhum vídeo enviado ainda.</p>}
      {openOrder && <FolderContentsModal order={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
}

// ======================= FINALIZADOS (gestor) =======================

function ManagerFinalizedTab({ orders }: { orders: Order[] }) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | 'ready' | 'delivered'>('');
  const [openOrder, setOpenOrder] = useState<Order | null>(null);

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
        <input className="input flex-1" placeholder="Buscar por Nº ou nome…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="select" style={{ maxWidth: 200 }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as any)}>
          <option value="">Pronto e Entregue</option>
          <option value="ready">Só Prontos</option>
          <option value="delivered">Só Entregues</option>
        </select>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Nº</th><th>Cliente</th><th>Categoria</th><th>Vídeos</th><th>Status</th><th>Finalizado por</th><th>Em</th></tr></thead>
          <tbody>
            {filtered.map((o) => (
              <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setOpenOrder(o)}>
                <td className="mono-number">#{o.orderNumber}</td>
                <td>{o.clientName}</td>
                <td>{o.category}</td>
                <td>{o.videoCount}</td>
                <td><StatusBadge status={o.status} /></td>
                <td>{o.finishedBy || '—'}</td>
                <td>{formatDateTime(o.finishedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && <p className="text-sm text-muted">Nenhum pedido finalizado no período.</p>}
      {openOrder && <FolderContentsModal order={openOrder} onClose={() => setOpenOrder(null)} />}
    </div>
  );
}