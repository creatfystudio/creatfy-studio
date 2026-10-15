import React, { useRef, useState } from 'react';
import { UploadCloud, Copy, Download, RefreshCw } from 'lucide-react';
import type { VideoItem } from '../types';
import { triggerBrowserDownload } from '../lib/storage';

const ACCEPT = '.mp4,.mov,.webm,.m4v,.mkv,video/*';

interface Props {
  video: VideoItem;
  uploading: boolean;
  progress: number;
  onSelectFile: (file: File) => void;
  disabled?: boolean;
}

export default function VideoUploader({ video, uploading, progress, onSelectFile, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function pick(file?: File | null) {
    if (file) onSelectFile(file);
  }

  function copyScript() {
    navigator.clipboard?.writeText(video.script || '').catch(() => undefined);
  }

  return (
    <div className="card" style={{ padding: 16 }}>
      <div className="row space-between" style={{ marginBottom: 8 }}>
        <strong>Vídeo {video.index}</strong>
        <button className="btn btn-ghost btn-sm" onClick={copyScript} type="button">
          <Copy size={14} /> Copiar roteiro
        </button>
      </div>
      <p className="text-sm" style={{ marginBottom: 12, whiteSpace: 'pre-wrap' }}>
        {video.script || <span className="text-muted">(sem roteiro)</span>}
      </p>

      {video.videoUrl && !uploading && (
        <div style={{ marginBottom: 10 }}>
          <video src={video.videoUrl} controls style={{ width: '100%', borderRadius: 10, maxHeight: 220 }} />
        </div>
      )}

      {uploading ? (
        <div>
          <div className="progress-track" style={{ marginBottom: 6 }}>
            <div className="progress-fill" style={{ width: `${Math.round(progress)}%` }} />
          </div>
          <div className="text-sm text-muted">Enviando… {Math.round(progress)}%</div>
        </div>
      ) : (
        <div
          className={`dropzone ${dragOver ? 'drag-over' : ''}`}
          onDragOver={(e) => {
            e.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (disabled) return;
            pick(e.dataTransfer.files?.[0]);
          }}
          onClick={() => !disabled && inputRef.current?.click()}
          style={{ padding: 16, cursor: disabled ? 'not-allowed' : 'pointer' }}
        >
          <UploadCloud size={20} />
          <div className="text-sm" style={{ marginTop: 6 }}>
            {video.videoUrl ? (
              <span className="row gap-xs" style={{ justifyContent: 'center' }}>
                <RefreshCw size={13} /> Substituir vídeo (arraste ou clique)
              </span>
            ) : (
              'Arraste o vídeo aqui ou clique para selecionar'
            )}
          </div>
        </div>
      )}

      {video.videoUrl && !uploading && (
        <button
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 10 }}
          onClick={() => triggerBrowserDownload(video.videoUrl!, video.fileName || `video-${video.index}.mp4`)}
          type="button"
        >
          <Download size={14} /> Baixar vídeo
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        hidden
        onChange={(e) => {
          pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
    </div>
  );
}
