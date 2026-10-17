import React, { useId, useRef, useState } from 'react';
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

function getErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

export default function EditOrderModal({ order, onClose, allowStatusChange, onRequestDelete }: Props) {
  const { profile } = useAuth();
  const { categories } = useCategories();
  const categoryNames = allCategoryNames(categories);
  const formId = useId();

  const [clientName, setClientName] = useState(order.clientName);
  const [clientPhone, setClientPhone] = useState(order.clientPhone);
  const [valueInput, setValueInput] = useState(order.value.toFixed(2).replace('.', ','));
  const [category, setCategory] = useState(order.category);
  const [scripts, setScripts] = useState(order.videos.map((v) => v.script));
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [newImages, setNewImages] = useState<PendingImage[]>([]);
  const [busy, setBusy] = useState(false);
  const [removingPath, setRemovingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trava síncrona: impede duplo clique antes de o React re-renderizar.
  const savingRef = useRef(false);

  function validate(): string | null {
    if (!clientName.trim()) return 'Informe o nome do cliente.';

    const phoneDigits = clientPhone.replace(/\D/g, '');
    if (phoneDigits.length > 0 && (phoneDigits.length < 10 || phoneDigits.length > 11)) {
      return 'Número do cliente incompleto. Use DDD + número.';
    }

    const value = parseCurrencyInput(valueInput);
    if (!Number.isFinite(value) || value <= 0) {
      return 'Informe um valor maior que zero.';
    }

    if (scripts.some((s) => !s.trim())) {
      return 'Preencha o roteiro de todos os vídeos ou remova os vazios.';
    }

    if (newImages.some((i) => i.converting)) {
      return 'Aguarde a conversão das imagens antes de salvar.';
    }

    const failedImages = newImages.filter((i) => i.error || !i.convertedBlob).length;
    if (failedImages > 0) {
      return `${failedImages} imagem(ns) não foram processadas. Remova-as ou tente novamente antes de salvar.`;
    }

    return null;
  }

  async function handleSave() {
    if (!profile || savingRef.current) return;

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    savingRef.current = true;
    setBusy(true);
    setError(null);

    let orderSaved = false;

    try {
      await updateOrder(
        order,
        {
          clientName: clientName.trim(),
          clientPhone,
          value: parseCurrencyInput(valueInput),
          category,
          scripts,
          ...(allowStatusChange ? { status } : {}),
        },
        profile.uid,
        profile.name
      );
      orderSaved = true;

      if (newImages.length > 0) {
        await addImagesToOrder(order, newImages.filter((i) => i.convertedBlob && !i.error));
      }

      onClose();
    } catch (err: unknown) {
      const fallback = orderSaved
        ? 'Os dados do pedido foram salvos, mas as imagens não foram enviadas. Tente adicioná-las novamente.'
        : 'Não foi possível salvar as alterações. Tente novamente.';
      setError(getErrorMessage(err, fallback));
    } finally {
      savingRef.current = false;
      setBusy(false);
    }
  }

  async function handleRemoveImage(img: Order['images'][number]) {
    if (removingPath || busy) return;
    setRemovingPath(img.path);
    setError(null);
    try {
      await removeImageFromOrder(order, img);
    } catch (err: unknown) {
      setError(getErrorMessage(err, 'Não foi possível remover a imagem. Tente novamente.'));
    } finally {
      setRemovingPath(null);
    }
  }

  return (
    <Modal title={`Editar pedido #${order.orderNumber}`} onClose={onClose} wide>
      <div className="field">
        <label htmlFor={`${formId}-name`}>Nome do cliente</label>
        <input
          id={`${formId}-name`}
          className="input"
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
          disabled={busy}
        />
      </div>

      <div className="field">
        <label htmlFor={`${formId}-phone`}>Número do cliente</label>
        <input
          id={`${formId}-phone`}
          className="input"
          inputMode="tel"
          value={clientPhone}
          onChange={(e) => setClientPhone(maskPhoneBR(e.target.value))}
          disabled={busy}
        />
      </div>

      <div className="field">
        <label htmlFor={`${formId}-value`}>Valor do pedido</label>
        <input
          id={`${formId}-value`}
          className="input"
          inputMode="decimal"
          value={valueInput}
          onChange={(e) => setValueInput(e.target.value)}
          disabled={busy}
        />
        <div className="field-hint">{formatCurrency(parseCurrencyInput(valueInput))}</div>
      </div>

      <div className="field">
        <label htmlFor={`${formId}-category`}>Categoria</label>
        <select
          id={`${formId}-category`}
          className="select"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          disabled={busy}
        >
          {categoryNames.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      {allowStatusChange && (
        <div className="field">
          <label htmlFor={`${formId}-status`}>Status</label>
          <select
            id={`${formId}-status`}
            className="select"
            value={status}
            onChange={(e) => setStatus(e.target.value as OrderStatus)}
            disabled={busy}
          >
            {(Object.keys(STATUS_LABELS) as OrderStatus[]).map((s) => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      )}

      <div className="field">
        <label>Roteiros</label>
        <div className="stack gap-sm">
          {scripts.map((s, idx) => {
            const scriptId = `${formId}-script-${idx}`;
            return (
              <div key={idx}>
                <label htmlFor={scriptId} className="text-sm">Vídeo {idx + 1}</label>
                <textarea
                  id={scriptId}
                  className="textarea"
                  value={s}
                  disabled={busy}
                  onChange={(e) =>
                    setScripts((prev) => prev.map((p, i) => (i === idx ? e.target.value : p)))
                  }
                />
              </div>
            );
          })}
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
                <img src={img.url} alt={img.caption || 'Imagem do pedido'} />
                <button
                  className="thumb-remove"
                  onClick={() => handleRemoveImage(img)}
                  type="button"
                  aria-label="Remover imagem"
                  disabled={busy || removingPath === img.path}
                >
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

      {error && (
        <div className="banner banner-error" role="alert" style={{ marginBottom: 14 }}>
          {error}
        </div>
      )}

      <div className="row space-between" style={{ marginTop: 4, flexWrap: 'wrap', gap: 8 }}>
        {onRequestDelete ? (
          <button className="btn btn-danger" onClick={onRequestDelete} type="button" disabled={busy}>
            Excluir pedido
          </button>
        ) : <span />}
        <div className="row gap-sm">
          <button className="btn btn-secondary" onClick={onClose} type="button" disabled={busy}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            type="button"
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? 'Salvando…' : 'Salvar alterações'}
          </button>
        </div>
      </div>
    </Modal>
  );
}