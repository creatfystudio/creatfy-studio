import React, { useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
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

// Tipos explícitos, sem image/*: evita que o iPhone ofereça fotos em HEIC da galeria.
const ACCEPT =
  '.jpg,.jpeg,.png,.webp,.bmp,.gif,.jfif,image/jpeg,image/png,image/webp,image/bmp,image/gif';

function createId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

export default function ImageUploader({ value, onChange }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dragId = useRef<string | null>(null);
  // Itens removidos enquanto convertiam. Evita aplicar o resultado a um item que já não existe.
  const removedIds = useRef<Set<string>>(new Set());
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleFiles(incoming: File[]) {
    if (incoming.length === 0) return;

    const accepted = incoming.filter(isAcceptedImageFile);
    const rejected = incoming.length - accepted.length;
    setNotice(rejected > 0 ? `${rejected} arquivo(s) ignorado(s): formato não suportado.` : null);
    if (accepted.length === 0) return;

    const newItems: PendingImage[] = accepted.map((file) => ({
      id: createId(),
      originalFile: file,
      previewUrl: URL.createObjectURL(file),
      caption: '',
      converting: true,
    }));

    onChange((prev) => [...prev, ...newItems]);

    for (const item of newItems) {
      try {
        const result = await convertImage(item.originalFile);
        if (removedIds.current.has(item.id)) continue;

        const previewUrl = URL.createObjectURL(result.blob);
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
                  previewUrl,
                }
              : p
          )
        );
        // Libera a prévia do arquivo original, que já foi substituída.
        URL.revokeObjectURL(item.previewUrl);
      } catch (err: unknown) {
        if (removedIds.current.has(item.id)) continue;
        const message = errorMessage(err, 'Falha ao converter a imagem.');
        onChange((prev) =>
          prev.map((p) => (p.id === item.id ? { ...p, converting: false, error: message } : p))
        );
      }
    }
  }

  function removeItem(item: PendingImage) {
    removedIds.current.add(item.id);
    URL.revokeObjectURL(item.previewUrl);
    onChange((prev) => prev.filter((v) => v.id !== item.id));
  }

  function updateCaption(id: string, caption: string) {
    onChange((prev) => prev.map((v) => (v.id === id ? { ...v, caption } : v)));
  }

  function moveItem(id: string, delta: -1 | 1) {
    onChange((prev) => {
      const from = prev.findIndex((v) => v.id === id);
      const to = from + delta;
      if (from === -1 || to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next;
    });
  }

  function handleDrop(targetId: string) {
    const sourceId = dragId.current;
    dragId.current = null;
    setDragOverId(null);
    if (!sourceId || sourceId === targetId) return;

    onChange((prev) => {
      const from = prev.findIndex((v) => v.id === sourceId);
      const to = prev.findIndex((v) => v.id === targetId);
      if (from === -1 || to === -1) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  return (
    <div>
      <div className="thumb-grid" style={{ marginBottom: 10 }}>
        {value.map((img, idx) => (
          <div
            key={img.id}
            draggable
            onDragStart={() => {
              dragId.current = img.id;
            }}
            onDragOver={(e) => {
              e.preventDefault();
              if (dragOverId !== img.id) setDragOverId(img.id);
            }}
            onDragLeave={() => setDragOverId((cur) => (cur === img.id ? null : cur))}
            onDragEnd={() => {
              dragId.current = null;
              setDragOverId(null);
            }}
            onDrop={() => handleDrop(img.id)}
            style={{ opacity: dragOverId === img.id ? 0.6 : 1 }}
          >
            <div className="thumb" style={{ position: 'relative' }}>
              <img src={img.previewUrl} alt={img.caption || `Imagem ${idx + 1}`} />
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
                  {/* Cor da borda antes do shorthand, para o topo não ser sobrescrito. */}
                  <span
                    className="spinner"
                    style={{ borderColor: 'rgba(255,255,255,0.4)', borderTopColor: '#fff' }}
                    aria-label="Convertendo imagem"
                  />
                </div>
              )}
              <button
                className="thumb-remove"
                onClick={() => removeItem(img)}
                aria-label="Remover imagem"
                type="button"
              >
                <X size={13} />
              </button>
            </div>

            <input
              className="input"
              aria-label={`Legenda da imagem ${idx + 1}`}
              placeholder="Legenda (ex.: Cena 1)"
              value={img.caption}
              onChange={(e) => updateCaption(img.id, e.target.value)}
              style={{ marginTop: 6, fontSize: 12, padding: '6px 8px' }}
            />

            <div className="row gap-sm" style={{ marginTop: 4, justifyContent: 'space-between' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => moveItem(img.id, -1)}
                disabled={idx === 0}
                aria-label="Mover imagem para a esquerda"
                style={{ padding: '2px 6px' }}
              >
                <ChevronLeft size={14} />
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => moveItem(img.id, 1)}
                disabled={idx === value.length - 1}
                aria-label="Mover imagem para a direita"
                style={{ padding: '2px 6px' }}
              >
                <ChevronRight size={14} />
              </button>
            </div>

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

      {notice && (
        <div className="field-hint" role="status">
          {notice}
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          // Copia a lista antes de limpar o input, pois limpar pode esvaziar o FileList.
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          void handleFiles(files);
        }}
      />
    </div>
  );
}