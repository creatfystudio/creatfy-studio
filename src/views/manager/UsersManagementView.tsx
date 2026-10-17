import React, { useMemo, useState } from 'react';
import { Plus, KeyRound, Trash2, ShieldAlert, Cloud, CheckCircle, AlertCircle, Percent } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useUsers, createUserAccount, updateUserProfile, setUserActive, deleteUserRecord, sendResetPasswordEmail } from '../../lib/users';
import { useOrders } from '../../lib/useOrders';
import { LEVEL_LABELS, type UserLevel, type AppUser } from '../../types';
import { formatDate, formatCurrency, startOfMonth } from '../../lib/utils';
import { Modal, ConfirmDialog } from '../../components/Modal';
import { MASTER_EMAIL, db } from '../../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { connectGoogleDrive, isDriveConnected, disconnectGoogleDrive } from '../../lib/googleDrive';
import { clearDriveFolderCache } from '../../lib/storage';

export default function UsersManagementView() {
  const { profile } = useAuth();
  const { users, loading, error } = useUsers();
  const { orders } = useOrders();
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<AppUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AppUser | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [driveConnected, setDriveConnected] = useState(isDriveConnected());
  const [connectingDrive, setConnectingDrive] = useState(false);

  // Calcula estatísticas de vendas por vendedor e produção por criador
  const userStats = useMemo(() => {
    const monthStart = startOfMonth(new Date()).getTime();
    const stats: Record<string, { totalSold: number; countSold: number; doneVideos: number; pendingVideos: number }> = {};

    orders.forEach((o) => {
      // Vendedor (por ID ou Nome)
      const sellerKey = o.sellerId || o.sellerName;
      if (sellerKey) {
        if (!stats[sellerKey]) stats[sellerKey] = { totalSold: 0, countSold: 0, doneVideos: 0, pendingVideos: 0 };
        const orderTime = new Date(o.createdAtISO).getTime();
        if (orderTime >= monthStart) {
          stats[sellerKey].totalSold += o.value || 0;
          stats[sellerKey].countSold += 1;
        }
      }

      // Criador / Finalizador
      const finishedBy = o.finishedByUid || o.finishedBy;
      if (finishedBy && (o.status === 'ready' || o.status === 'delivered')) {
        if (!stats[finishedBy]) stats[finishedBy] = { totalSold: 0, countSold: 0, doneVideos: 0, pendingVideos: 0 };
        const totalV = o.videos?.filter((v) => v.videoUrl)?.length || o.videoCount || 0;
        stats[finishedBy].doneVideos += totalV;
      }
    });

    // Total de vídeos ainda na fila (pendentes ou em produção)
    const totalPendingInQueue = orders
      .filter((o) => o.status === 'pending' || o.status === 'production')
      .reduce((acc, o) => acc + (o.videos?.filter((v) => !v.videoUrl)?.length || o.videoCount || 0), 0);

    return { stats, totalPendingInQueue };
  }, [orders, users]);

  if (profile?.email !== MASTER_EMAIL) {
    return (
      <div className="banner banner-error">
        <ShieldAlert size={16} /> Apenas o Gestor Mestre pode aceder a esta área.
      </div>
    );
  }

  async function handleResetPassword(u: AppUser) {
    try {
      await sendResetPasswordEmail(u.email);
      setFeedback(`E-mail de redefinição enviado para ${u.email}.`);
    } catch {
      setFeedback('Não foi possível enviar o e-mail de redefinição.');
    }
  }

  async function handleConnectDrive() {
    setConnectingDrive(true);
    try {
      await connectGoogleDrive();
      // Limpa o cache de pastas para não reaproveitar IDs de uma conta anterior.
      clearDriveFolderCache();
      setDriveConnected(true);
      setFeedback('Google Drive conectado com sucesso! Os uploads serão salvos nos seus 5 TB.');
    } catch (err: any) {
      setFeedback(`Erro ao ligar ao Google Drive: ${err?.message || 'Falha na autenticação'}`);
    } finally {
      setConnectingDrive(false);
    }
  }

  function handleDisconnectDrive() {
    disconnectGoogleDrive();
    clearDriveFolderCache();
    setDriveConnected(false);
    setFeedback('Google Drive desligado.');
  }

  return (
    <div className="stack gap-lg">
      <div className="row space-between wrap gap-sm">
        <div>
          <h2>Gestão de Equipa e Desempenho</h2>
          <p className="text-sm">Consulte as vendas por vendedor, os vídeos finalizados e pendentes por criador.</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          <Plus size={16} /> Novo utilizador
        </button>
      </div>

      {feedback && <div className="banner banner-info">{feedback}</div>}
      {error && <div className="banner banner-error">{error}</div>}

      {loading ? (
        <div className="loading-screen"><span className="spinner" /></div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Nome</th>
                <th>Nível</th>
                <th>Desempenho no Mês</th>
                <th>Comissão (%)</th>
                <th>Estado</th>
                <th>Criado em</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const comm = (u as any).commissionPercent ?? 10;
                const userStat = userStats.stats[u.uid] || userStats.stats[u.name] || { totalSold: 0, countSold: 0, doneVideos: 0, pendingVideos: 0 };

                return (
                  <tr key={u.uid}>
                    <td>
                      <strong>{u.name}</strong> {u.isMaster && <span className="badge badge-category">Mestre</span>}
                      <div className="text-sm text-muted">{u.email}</div>
                    </td>
                    <td>{LEVEL_LABELS[u.level]}</td>
                    <td>
                      {u.level === 'seller' && (
                        <div className="text-sm">
                          <div><strong>{formatCurrency(userStat.totalSold)}</strong> em vendas</div>
                          <div className="text-muted">{userStat.countSold} pedido(s) este mês</div>
                        </div>
                      )}
                      {u.level === 'creator' && (
                        <div className="text-sm">
                          <div>✅ <strong>{userStat.doneVideos}</strong> vídeo(s) finalizados</div>
                          <div className="text-muted">⏳ <strong>{userStats.totalPendingInQueue}</strong> na fila para finalizar</div>
                        </div>
                      )}
                      {u.level === 'manager' && (
                        <span className="text-sm text-muted">Gestão geral da operação</span>
                      )}
                    </td>
                    <td>
                      <span className="badge" style={{ background: 'var(--bg-secondary)', fontWeight: 700 }}>
                        {comm}%
                      </span>
                    </td>
                    <td>
                      <span className="badge" style={{ ['--c' as any]: u.active ? 'var(--status-ready)' : 'var(--status-delivered)' }}>
                        {u.active ? 'Ativo' : 'Inativo'}
                      </span>
                    </td>
                    <td>{formatDate(u.createdAt ? (u.createdAt as any).toDate?.() : null)}</td>
                    <td>
                      <div className="row gap-xs wrap">
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditUser(u)}>
                          Editar / %
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleResetPassword(u)} title="Redefinir palavra-passe">
                          <KeyRound size={13} />
                        </button>
                        {!u.isMaster && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => setUserActive(u.uid, !u.active)}
                          >
                            {u.active ? 'Desativar' : 'Ativar'}
                          </button>
                        )}
                        {!u.isMaster && (
                          <button className="btn btn-icon btn-ghost" onClick={() => setDeleteTarget(u)} aria-label="Excluir">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="card">
        <div className="row gap-sm" style={{ marginBottom: 8 }}>
          <Cloud size={18} />
          <h3>Armazenamento (Google Drive - 5 TB)</h3>
        </div>
        <p className="text-sm">
          Status:{' '}
          {driveConnected ? (
            <strong style={{ color: 'var(--status-ready)' }}>
              <CheckCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Google Drive Conectado — a guardar diretamente na nuvem dos seus 5 TB.
            </strong>
          ) : (
            <strong style={{ color: 'var(--status-delivered)' }}>
              <AlertCircle size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
              Desligado — ligue para permitir guardar pedidos e ficheiros.
            </strong>
          )}
        </p>

        <div style={{ marginTop: 14 }}>
          {driveConnected ? (
            <button className="btn btn-secondary btn-sm" onClick={handleDisconnectDrive}>
              Desligar conta Google
            </button>
          ) : (
            <button className="btn btn-primary btn-sm" onClick={handleConnectDrive} disabled={connectingDrive}>
              {connectingDrive ? 'A ligar...' : 'Ligar ao Google Drive'}
            </button>
          )}
        </div>
      </div>

      {showCreate && <CreateUserModal onClose={() => setShowCreate(false)} currentUserName={profile.name} />}
      {editUser && <EditUserModal user={editUser} onClose={() => setEditUser(null)} />}
      {deleteTarget && (
        <ConfirmDialog
          title="Excluir utilizador"
          message={`O registo de ${deleteTarget.name} será removido do Firestore e o acesso será bloqueado imediatamente.`}
          confirmLabel="Excluir"
          danger
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteUserRecord(deleteTarget.uid);
            setDeleteTarget(null);
          }}
        />
      )}
    </div>
  );
}

function CreateUserModal({ onClose, currentUserName }: { onClose: () => void; currentUserName: string }) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [level, setLevel] = useState<UserLevel>('seller');
  const [commissionPercent, setCommissionPercent] = useState<number>(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    setBusy(true);
    setError(null);
    try {
      if (password.length < 6) throw new Error('A palavra-passe inicial deve ter pelo menos 6 caracteres.');
      const newUid = await createUserAccount({ name, email, password, level }, currentUserName);
      if (newUid) {
        await updateDoc(doc(db, 'users', newUid as any), {
          commissionPercent: Number(commissionPercent) || 0,
        }).catch(() => undefined);
      }
      onClose();
    } catch (err: any) {
      setError(err?.message?.includes('email-already-in-use') ? 'Este e-mail já está registado.' : err?.message || 'Não foi possível criar o utilizador.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Novo utilizador" onClose={onClose}>
      <div className="field">
        <label>Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>E-mail / login</label>
        <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="field">
        <label>Palavra-passe inicial</label>
        <input
          className="input"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <div className="field-hint">Mínimo de 6 caracteres.</div>
      </div>
      <div className="field">
        <label>Área de acesso</label>
        <select className="select" value={level} onChange={(e) => setLevel(e.target.value as UserLevel)}>
          <option value="seller">Vendedor</option>
          <option value="creator">Criador de Vídeos</option>
          <option value="manager">Gestor Geral</option>
        </select>
      </div>
      <div className="field">
        <label>Porcentagem de Comissão (%)</label>
        <div className="row gap-xs" style={{ alignItems: 'center' }}>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={commissionPercent}
            onChange={(e) => setCommissionPercent(Number(e.target.value))}
          />
          <Percent size={16} className="text-muted" />
        </div>
        <div className="field-hint">Ex: 10 para 10% sobre o valor vendido no mês.</div>
      </div>
      {error && <div className="banner banner-error" style={{ marginBottom: 14 }}>{error}</div>}
      <button className="btn btn-primary btn-block" onClick={handleCreate} disabled={busy || !name || !email}>
        {busy ? 'A criar…' : 'Criar utilizador'}
      </button>
    </Modal>
  );
}

function EditUserModal({ user, onClose }: { user: AppUser; onClose: () => void }) {
  const [name, setName] = useState(user.name);
  const [level, setLevel] = useState<UserLevel>(user.level);
  const [commissionPercent, setCommissionPercent] = useState<number>((user as any).commissionPercent ?? 10);
  const [busy, setBusy] = useState(false);

  async function handleSave() {
    setBusy(true);
    try {
      await updateUserProfile(user.uid, { name, level: user.isMaster ? user.level : level });
      await updateDoc(doc(db, 'users', user.uid), {
        commissionPercent: Number(commissionPercent) || 0,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Editar utilizador e comissão" onClose={onClose}>
      <div className="field">
        <label>Nome</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="field">
        <label>Nível</label>
        <select className="select" value={level} onChange={(e) => setLevel(e.target.value as UserLevel)} disabled={user.isMaster}>
          <option value="seller">Vendedor</option>
          <option value="creator">Criador de Vídeos</option>
          <option value="manager">Gestor Geral</option>
        </select>
        {user.isMaster && <div className="field-hint">O nível do Gestor Mestre não pode ser alterado.</div>}
      </div>
      <div className="field">
        <label>Porcentagem de Comissão (%)</label>
        <div className="row gap-xs" style={{ alignItems: 'center' }}>
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={commissionPercent}
            onChange={(e) => setCommissionPercent(Number(e.target.value))}
          />
          <Percent size={16} className="text-muted" />
        </div>
        <div className="field-hint">Define quanto este vendedor ganha sobre as vendas do mês.</div>
      </div>
      <button className="btn btn-primary btn-block" onClick={handleSave} disabled={busy}>
        {busy ? 'A guardar…' : 'Guardar alterações'}
      </button>
    </Modal>
  );
}