import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ImageIcon } from 'lucide-react';
import { getValidToken } from '../lib/googleDrive';

interface Props {
  fileId?: string;
  alt?: string;
  style?: CSSProperties;
}

/**
 * Mostra uma imagem guardada no Drive.
 * 1) Tenta buscar com o token da conta conectada.
 * 2) Se não conseguir, usa o endereço de miniatura do Drive.
 * 3) Se nada funcionar, mostra um ícone.
 */
export default function DriveImage({ fileId, alt = 'Imagem', style }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [useThumb, setUseThumb] = useState(false);
  const [thumbFailed, setThumbFailed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSrc(null);
    setUseThumb(false);
    setThumbFailed(false);

    if (!fileId) {
      setThumbFailed(true);
      setLoading(false);
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setLoading(true);

    (async () => {
      try {
        const token = await getValidToken();
        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      } catch {
        if (active) setUseThumb(true);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  const box: CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--bg-secondary)',
    ...style,
  };

  if (loading) {
    return (
      <div style={box}>
        <span className="spinner" style={{ width: 18, height: 18 }} />
      </div>
    );
  }

  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      />
    );
  }

  if (useThumb && fileId && !thumbFailed) {
    return (
      <img
        src={`https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w800`}
        alt={alt}
        referrerPolicy="no-referrer"
        onError={() => setThumbFailed(true)}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      />
    );
  }

  return (
    <div style={box}>
      <ImageIcon size={20} className="text-muted" />
    </div>
  );
}