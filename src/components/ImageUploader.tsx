import React, { useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { convertImage, isAcceptedImageFile } from '../lib/imageConverter';

export interface PendingImage {
  id: string;
  originalFile: File;
  convertedBlob?: Blob;
  convertedFileName?: string;
  convertedMime?: string;
  previewUrl: string;
  caption: string;
  converting: boolean;
  conversionNote?: string;
  error?: string;
}

interface Props {
  value: PendingImage[];
  onChange: React.Dispatch<React.SetStateAction<PendingImage[]>>;
}

const ACCEPT = '.jfif,.jpg,.jpeg,.png,.webp,.heic,.heif,.bmp,.gif,image/*';

export default function ImageUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const accepted = Array.from(files).filter(isAcceptedImageFile);
    const rejected = files.length - accepted.length;

    const newItems: PendingImage[] = accepted.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      originalFile: file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      converting: true,
    }));

    onChange((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const result = await convertImage(item.originalFile);
        onChange((prev) =>
          prev.map((p) =>
            p.id === item.id
              ? {
                  ...p,
                  converting: false,
                  convertedBlob: result.blob,
                  convertedFileName: result.fileName,
                  convertedMime: result.mimeType,
                  conversionNote: result.note,
                  previewUrl: URL.createObjectURL(result.blob),
                }
              : p
          )
        );
      } catch (err: any) {
        onChange((prev) =>
          prev.map((p) =>
            p.id === item.id ? { ...p, converting: false, error: err?.message || 'Falha ao converter a imagem.' } : p
          )
        );
      }
    }

    if (rejected > 0) {
      alert(`${rejected} arquivo(s) ignorado(s): formato não suportado.`);
    }
  }

  function removeItem(id: string) {
    onChange((prev) => prev.filter((v) => v.id !== id));
  }

  function updateCaption(id: string, caption: string) {
    onChange((prev) => prev.map((v) => (v.id === id ? { ...v, caption } : v)));
  }

  function handleDrop(targetId: string) {
    if (dragIndex.current === null) return;
    const from = dragIndex.current;
    onChange((prev) => {
      const to = prev.findIndex((v) => v.id === targetId);
      if (from === to || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    dragIndex.current = null;
    setDragOverId(null);
  }

  return (
    <div>
      <div className="thumb-grid" style={{ marginBottom: 10 }}>
        {value.map((img, idx) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => (dragIndex.current = idx)}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOverId(img.id);
            }}
            onDrop={() => handleDrop(img.id)}
            style={{ opacity: dragOverId === img.id ? 0.6 : 1 }}
          >
            <div className="thumb">
              <img src={img.previewUrl} alt={img.caption || 'Imagem do mascote'} />
              {img.converting && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'rgba(0,0,0,0.35)',
                  }}
                >
                  <span
                    className="spinner"
                    style={{ borderTopColor: '#fff', borderColor: 'rgba(255,255,255,0.4)' }}
                  />
                </div>
              )}
              <button className="thumb-remove" onClick={() => removeItem(img.id)} aria-label="Remover imagem" type="button">
                <X size={13} />
              </button>
            </div>
            <input
              className="input"
              placeholder="Legenda (ex.: Cena 1)"
              value={img.caption}
              onChange={(e) => updateCaption(img.id, e.target.value)}
              style={{ marginTop: 6, fontSize: 12, padding: '6px 8px' }}
            />
            {img.conversionNote && <div className="field-hint">{img.conversionNote}</div>}
            {img.error && <div className="field-error">{img.error}</div>}
          </div>
        ))}

        <button
          type="button"
          className="dropzone"
          style={{
            aspectRatio: '1',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
          onClick={() => inputRef.current?.click()}
        >
          <Plus size={22} />
          <span style={{ fontSize: 12 }}>Adicionar outra imagem</span>
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
