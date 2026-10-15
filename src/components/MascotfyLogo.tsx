interface Props {
  size?: number;
  withWordmark?: boolean;
}

/**
 * Logo placeholder em roxo (#7C35E9). Troque pelo arquivo oficial da
 * Mascotfy: basta substituir este componente por uma <img src="/logo.svg" />
 * apontando para o logo real em /public.
 */
export default function MascotfyLogo({ size = 30, withWordmark = true }: Props) {
  return (
    <span className="row gap-sm">
      <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="16" fill="#7C35E9" />
        <circle cx="24" cy="26" r="6" fill="#FFFFFF" />
        <circle cx="40" cy="26" r="6" fill="#FFFFFF" />
        <circle cx="24" cy="26" r="2.4" fill="#2D1458" />
        <circle cx="40" cy="26" r="2.4" fill="#2D1458" />
        <path d="M20 42c4 6 20 6 24 0" stroke="#FFFFFF" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      </svg>
      {withWordmark && <strong>Mascotfy Studio</strong>}
    </span>
  );
}
