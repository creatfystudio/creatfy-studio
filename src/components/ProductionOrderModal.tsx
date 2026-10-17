import React, { useEffect, useState } from 'react';
import { Download, CheckCircle2 } from 'lucide-react';
import { Modal } from './Modal';
import VideoUploader from './VideoUploader';
import DriveImage from './DriveImage';
import type { Order } from '../types';
import { uploadVideoForOrder, finalizeOrder, getOrderOnce } from '../lib/orders';
import { triggerBrowserDownload } from '../lib/storage';
import { useAuth } from '../contexts/AuthContext';

function extractFileId(url: string | undefined): string | null {
  if (!url) return null;
  const match = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/id=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

interface Props {
  order: Order;
  onClose: () => void;
  onFinalized?: () => void;
}

export default function ProductionOrderModal({ order: initialOrder, onClose, onFinalized }: Props) {
  const { profile } = useAuth();
  const [currentOrder, setCurrentOrder] = useState<Order>(initialOrder);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  useEffect(() => {
    setCurrentOrder(initialOrder);
  }, [initialOrder]);

  const allUploaded = currentOrder.videos.every((v) => !!v.videoUrl);

  async function handleSelectFile(videoIndex: number, file: File) {
    setError(null);
    setUploadingIndex(videoIndex);
    setProgress(10);
    try {
      await uploadVideoForOrder(currentOrder, videoIndex, file, (pct) => setProgress(pct));

      const refreshed = await getOrderOnce(currentOrder.id);
      if (refreshed) {
        setCurrentOrder(refreshed);
      } else {
        setCurrentOrder((prev) => ({
          ...prev,
          videos: prev.videos.map((v) =>
            v.index === videoIndex
              ? { ...v, videoUrl: 'uploaded', fileName: file.name, uploadedAt: new Date().toISOString() }
              : v
          ),
        }));
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível enviar o vídeo. Tente novamente.');
    } finally {
      setUploadingIndex(null);
      setProgress(0);
    }
  }

  async function handleFinalize() {
    if (!profile) return;
    setError(null);
    setFinalizing(true);
    try {
      await finalizeOrder(currentOrder, profile.uid, profile.name);
      if (onFinalized) {
        onFinalized();
      } else {
        onClose();
      }
    } catch (err: any) {
      setError(err?.message || 'Não foi possível finalizar o pedido.');
    } finally {
      setFinalizing(false);
    }
  }

  function downloadAllImages() {
    currentOrder.images.forEach((img, i) => {
      const fileId = extractFileId(img.url) || img.path;
      const token = localStorage.getItem('gdrive_access_token');
      if (fileId && token) {
        setTimeout(() => {
          fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${token}` },
          })
            .then((res) => res.blob())
            .then((blob) => {
              const url = URL.createObjectURL(blob);
              triggerBrowserDownload(url, img.originalName || `imagem-${i + 1}.png`);
              setTimeout(() => URL.revokeObjectURL(url), 1000);
            })
            .catch(() => window.open(img.url, '_blank'));
        }, i * 300);
      } else {
        window.open(img.url, '_blank');
      }
    });
  }

  return (
    <Modal title={`#${currentOrder.orderNumber} — ${currentOrder.clientName} (Em produção)`} onClose={onClose} wide>
      <div className="row space-between" style={{ marginBottom: 12 }}>
        <h4>Imagens do mascote</h4>
        {currentOrder.images.length > 0 && (
          <button className="btn btn-ghost btn-sm" onClick={downloadAllImages}>
            <Download size={13} /> Baixar todas
          </button>
        )}
      </div>
      <div className="thumb-grid" style={{ marginBottom: 20 }}>
        {currentOrder.images.map((img, i) => (
          <div key={img.path || i}>
            <div className="thumb" style={{ overflow: 'hidden', borderRadius: 8, height: 90 }}>
              <DriveImage fileId={img.path} alt={img.caption || 'Imagem do mascote'} />
            </div>
            {img.caption && <div className="text-sm text-muted" style={{ marginTop: 4 }}>{img.caption}</div>}
          </div>
        ))}
      </div>

      <h4 style={{ marginBottom: 10 }}>
        Vídeos ({currentOrder.videos.filter((v) => v.videoUrl).length} de {currentOrder.videos.length} enviados)
      </h4>
      <div className="stack gap-sm" style={{ marginBottom: 18 }}>
        {currentOrder.videos.map((v) => (
          <VideoUploader
            key={v.index}
            video={v}
            uploading={uploadingIndex === v.index}
            progress={uploadingIndex === v.index ? progress : 0}
            onSelectFile={(file) => handleSelectFile(v.index, file)}
            disabled={uploadingIndex !== null}
          />
        ))}
      </div>

      {error && <div className="banner banner-error" style={{ marginBottom: 14 }}>{error}</div>}

      <button className="btn btn-primary btn-block" disabled={!allUploaded || finalizing} onClick={handleFinalize}>
        <CheckCircle2 size={16} />
        {finalizing ? 'Finalizando…' : allUploaded ? 'Finalizar pedido' : 'Envie todos os vídeos para finalizar'}
      </button>
    </Modal>
  );
}