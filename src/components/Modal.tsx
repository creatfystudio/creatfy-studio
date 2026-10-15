import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={wide ? { maxWidth: 820 } : undefined}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="btn btn-icon btn-ghost" onClick={onClose} aria-label="Fechar">
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  danger,
  requireText,
  onCancel,
  onConfirm,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  requireText?: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [typed, setTyped] = React.useState('');
  const canConfirm = !requireText || typed.trim().toUpperCase() === requireText.toUpperCase();

  return (
    <Modal title={title} onClose={onCancel}>
      <p style={{ marginBottom: 16 }}>{message}</p>
      {requireText && (
        <div className="field">
          <label>
            Digite <strong>{requireText}</strong> para confirmar
          </label>
          <input className="input" value={typed} onChange={(e) => setTyped(e.target.value)} />
        </div>
      )}
      <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>
          Cancelar
        </button>
        <button
          className={danger ? 'btn btn-danger' : 'btn btn-primary'}
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
