import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

interface ModalProps {
  title: string;
  onClose: () => void;
  wide?: boolean;
  children: React.ReactNode;
}

export function Modal({ title, onClose, wide, children }: ModalProps) {
  // Guarda a versão mais recente de onClose sem refazer o efeito a cada render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    // Trava a rolagem da página de fundo enquanto a janela estiver aberta.
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onCloseRef.current();
    }
    window.addEventListener('keydown', handleKey);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKey);
    };
  }, []);

  return (
    <div
      onClick={(e) => {
        // Fecha só ao clicar no fundo escuro, não dentro da janela.
        if (e.target === e.currentTarget) onClose();
      }}
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
        aria-label={title}
        style={{
          width: '100%',
          maxWidth: wide ? 880 : 520,
          maxHeight: 'calc(100vh - 32px)',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
        }}
      >
        <div
          className="row space-between"
          style={{
            alignItems: 'center',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <h3 style={{ margin: 0 }}>{title}</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Fechar">
            <X size={16} />
          </button>
        </div>

        <div
          style={{
            padding: 20,
            overflowY: 'auto',
            minHeight: 0,
            flex: '1 1 auto',
          }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal title={title} onClose={onCancel}>
      <p className="text-sm" style={{ marginBottom: 18 }}>{message}</p>
      <div className="row gap-sm" style={{ justifyContent: 'flex-end' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={`btn ${danger ? 'btn-danger' : 'btn-primary'}`}
          onClick={() => onConfirm()}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}