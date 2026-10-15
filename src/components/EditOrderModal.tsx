import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal } from './Modal';
import ImageUploader, { type PendingImage } from './ImageUploader';
import { useAuth } from '../contexts/AuthContext';
import { useCategories, allCategoryNames } from '../lib/useCategories';
import { updateOrder, addImagesToOrder, removeImageFromOrder } from '../lib/orders';
import { maskPhoneBR, parseCurrencyInput, formatCurrency } from '../lib/utils';
import type { Order, OrderStatus } from '../types';
import { STATUS_LABELS } from '../types';

interface Props {
  order: Order;
  onClose: () => void;
  allowStatusChange?: boolean;
  onRequestDelete?: () => void;
}

export default function EditOrderModal({ order, onClose, allowStatusChange, onRequestDelete }: Props) {
  const { profile } = useAuth();
  const { categories } = useCategories();
  const categoryNames = allCategoryNames(categories);

  const [clientName, setClientName] = useState(order.clientName);
  const [clientPhone, setClientPhone] = useState(order.clientPhone);
  const [valueInput, setValueInput] = useState(order.value.toFixed(2).replace('.', ','));
  const [category, setCategory] = useState(order.category);
  const [scripts, setScripts] = useState(order.videos.map((v) => v.script));
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [newImages, setNewImages] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!profile) return;
    setBusy(true);
    setError(null);
    try {
      await updateOrder(
        order,
        { clientName, clientPhone, value: parseCurrencyInput(valueInput), category, scripts, status },
        profile.uid,
        profile.name
      );
      if (newImages.length > 0) {
        await addImagesToOrder(order, newImages.filter((i) => i.convertedBlob && !i.error));
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Não foi possível salvar as alterações.');
    } finally {
      setBusy(false);
    }
  }

  async function handleRemoveImage(img: Order['images'][number]) {
    await removeImageFromOrder(order, img);
  }

  return (
    <Modal title={`Editar pedido #${order.orderNumber}`} onClose={onClose} wide>
      <div className="field">
        <label>Nome do cliente</label>
        <input className="input" value={clientName} onChange={(e) => setClientName(e.target.value)} />
      </div>
      <div className="field">
        <label>Número do cliente</label>
        <input className="input" value={clientPhone} onChange={(e) => setClientPhone(maskPhoneBR(e.target.value))} />
      </div>
      <div className="field">
        <label>Valor do pedido</label>
        <input className="input" value={valueInput} onChange={(e) => setValueInput(e.target.value)} />
        <div className="field-hint">{formatCurrency(parseCurrencyInput(valueInput))}</div>
      </div>
      <div className="field">
        <label>Categoria</label>
        <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
          {categoryNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {allowStatusChange && (
        <div className="field">
          <label>Status</label>
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value as OrderStatus)}>
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Roteiros</label>
        <div className="stack gap-sm">
          {scripts.map((s, idx) => (
            <div key={idx}>
              <label className="text-sm">Vídeo {idx + 1}</label>
              <textarea
                className="textarea"
                value={s}
                onChange={(e) => setScripts((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="field">
        <label>Imagens atuais</label>
        {order.images.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma imagem.</p>
        ) : (
          <div className="thumb-grid">
            {order.images.map((img) => (
              <div key={img.path} className="thumb">
                <img src={img.url} alt={img.caption || ''} />
                <button className="thumb-remove" onClick={() => handleRemoveImage(img)} type="button" aria-label="Remover">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="field">
        <label>Adicionar novas imagens</label>
        <ImageUploader value={newImages} onChange={setNewImages} />
      </div>

      {error && <div className="banner banner-error" style={{ marginBottom: 14 }}>{error}</div>}

      <div className="row space-between" style={{ marginTop: 4 }}>
        {onRequestDelete ? (
          <button className="btn btn-danger" onClick={onRequestDelete} type="button">
            Excluir pedido
          </button>
        ) : <span />}
        <div className="row gap-sm">
          <button className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave} disabled={busy}>
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
