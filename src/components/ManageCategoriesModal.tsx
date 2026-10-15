import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import { useCategories, addCategory, deleteCategory } from '../lib/useCategories';
import { useAuth } from '../contexts/AuthContext';

export default function ManageCategoriesModal({ onClose }: { onClose: () => void }) {
  const { categories } = useCategories();
  const { profile } = useAuth();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mine = categories.filter((c) => c.createdBy === profile?.uid);

  async function handleAdd() {
    if (!profile) return;
    setError(null);
    setBusy(true);
    try {
      await addCategory(name, profile.uid);
      setName('');
    } catch (err: any) {
      setError(err?.message || 'Não foi possível adicionar a categoria.');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(id: string) {
    setBusy(true);
    try {
      await deleteCategory(id);
    } catch {
      setError('Não foi possível remover esta categoria.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Gerenciar categorias" onClose={onClose}>
      <div className="field">
        <label>Nova categoria</label>
        <div className="row gap-sm">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome da categoria" />
          <button className="btn btn-primary" disabled={busy || !name.trim()} onClick={handleAdd}>
            Adicionar
          </button>
        </div>
        {error && <div className="field-error">{error}</div>}
      </div>

      <hr />
      <p className="text-sm text-muted" style={{ marginBottom: 10 }}>
        Você só pode renomear ou remover categorias que você mesmo criou.
      </p>

      {mine.length === 0 ? (
        <p className="text-sm text-muted">Você ainda não criou nenhuma categoria personalizada.</p>
      ) : (
        <div className="stack gap-sm">
          {mine.map((c) => (
            <div key={c.id} className="row space-between" style={{ padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span>{c.name}</span>
              <button className="btn btn-icon btn-ghost" onClick={() => handleDelete(c.id)} disabled={busy} aria-label="Remover">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
