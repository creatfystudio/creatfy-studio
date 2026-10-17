import { useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { ImageIcon } from 'lucide-react';
import { getValidToken } from '../lib/googleDrive';

interface Props {
  fileId?: string;
  alt?: string;
  style?: CSSProperties;
}

/** Mostra uma imagem guardada no Drive, buscando-a com o token de acesso. */
export default function DriveImage({ fileId, alt = 'Imagem', style }: Props) {
  const [src, setSrc] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'ok' | 'error'>('loading');

  useEffect(() => {
    if (!fileId) {
      setStatus('error');
      return;
    }

    let active = true;
    let objectUrl: string | null = null;
    setStatus('loading');

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
        setStatus('ok');
      } catch {
        if (active) setStatus('error');
      }
    })();

    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [fileId]);

  if (status === 'ok' && src) {
    return (
      <img
        src={src}
        alt={alt}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', ...style }}
      />
    );
  }

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-secondary)',
        ...style,
      }}
    >
      {status === 'loading' ? (
        <span className="spinner" style={{ width: 18, height: 18 }} />
      ) : (
        <ImageIcon size={20} className="text-muted" />
      )}
    </div>
  );
}