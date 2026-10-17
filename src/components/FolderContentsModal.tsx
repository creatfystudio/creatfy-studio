import React from 'react';
import { Copy, Download, ExternalLink } from 'lucide-react';
import { Modal } from './Modal';
import DriveImage from './DriveImage';
import type { Order } from '../types';
import { buildFolderNameNoPhone, triggerBrowserDownload } from '../lib/storage';

interface Props {
  order: Order;
  hidePhone?: boolean;
  onClose: () => void;
  footer?: React.ReactNode;
}

function extractFileId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export default function FolderContentsModal({ order, hidePhone, onClose, footer }: Props) {
  const displayName = hidePhone
    ? buildFolderNameNoPhone(order.orderNumber, order.clientName, new Date(order.createdAtISO))
    : order.folderName;

  function handleDownload(url: string, name: string) {
    const fileId = extractFileId(url);
    const token = localStorage.getItem('gdrive_access_token');

    if (fileId && token) {
      fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((res) => res.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          triggerBrowserDownload(blobUrl, name);
          setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        })
        .catch(() => window.open(url, '_blank'));
    } else {
      window.open(url, '_blank');
    }
  }

  return (
    <Modal title={`#${order.orderNumber} — ${order.clientName}`} onClose={onClose} wide>
      <p className="text-sm text-muted" style={{ marginBottom: 16 }}>
        Pasta: <strong>{displayName}</strong>
      </p>

      <h4 style={{ marginBottom: 10 }}>Roteiros</h4>
      <div className="stack gap-sm" style={{ marginBottom: 20 }}>
        {order.videos.map((v) => (
          <div key={v.index} className="card" style={{ padding: 14 }}>
            <div className="row space-between" style={{ marginBottom: 6 }}>
              <strong className="text-sm">Vídeo {v.index}</strong>
              <button
                className="btn btn-ghost btn-sm"
                type="button"
                onClick={() => navigator.clipboard?.writeText(v.script || '')}
              >
                <Copy size={13} /> Copiar roteiro
              </button>
            </div>
            <p className="text-sm" style={{ whiteSpace: 'pre-wrap' }}>
              {v.script || <span className="text-muted">(sem roteiro)</span>}
            </p>
            {v.videoUrl && (
              <div className="row gap-sm" style={{ marginTop: 8 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleDownload(v.videoUrl!, v.fileName || `video-${v.index}.mp4`)}
                >
                  <Download size={13} /> Baixar vídeo {v.index}
                </button>
                <a
                  href={v.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                >
                  <ExternalLink size={13} /> Abrir no Drive
                </a>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="row space-between" style={{ marginBottom: 10 }}>
        <h4>Imagens do mascote</h4>
      </div>
      {order.images.length === 0 ? (
        <p className="text-sm text-muted">Nenhuma imagem enviada.</p>
      ) : (
        <div className="thumb-grid">
          {order.images.map((img, i) => (
            <div key={img.path || i}>
              <div className="thumb" style={{ overflow: 'hidden', borderRadius: 8, height: 110 }}>
                <DriveImage fileId={img.path} alt={img.caption || 'Mascote'} />
              </div>
              {img.caption && <div className="text-sm text-muted" style={{ marginTop: 4 }}>{img.caption}</div>}
              <div className="row gap-xs" style={{ marginTop: 6 }}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => handleDownload(img.url, img.originalName || `imagem-${i + 1}.png`)}
                >
                  <Download size={12} /> Baixar
                </button>
                <a
                  href={img.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-ghost btn-sm"
                  title="Abrir no Google Drive"
                >
                  <ExternalLink size={12} /> Drive
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {footer && <div style={{ marginTop: 20 }}>{footer}</div>}
    </Modal>
  );
}