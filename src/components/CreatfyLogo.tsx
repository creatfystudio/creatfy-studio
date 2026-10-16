interface Props {
  size?: number;
  withWordmark?: boolean;
}

export default function MascotfyLogo({ size = 30, withWordmark = true }: Props) {
  return (
    <span className="row gap-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
      {/* Ícone com fundo preto minimalista e letra C elegante */}
      <div 
        style={{ 
          width: `${size}px`, 
          height: `${size}px`, 
          backgroundColor: '#000000', 
          border: '1.5px solid #27272a',
          borderRadius: '10px', 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: '900',
          fontSize: `${size * 0.55}px`,
          letterSpacing: '-0.03em',
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
        }}
      >
        c
      </div>
      {withWordmark && (
        <strong style={{ letterSpacing: '-0.02em', fontSize: `${size * 0.55}px`, color: 'var(--text, #ffffff)' }}>
          Creatfy Studio
        </strong>
      )}
    </span>
  );
}