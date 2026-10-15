interface Props {
  data: { label: string; value: number }[];
  valueFormatter?: (v: number) => string;
}

export default function SimpleBarChart({ data, valueFormatter }: Props) {
  const max = Math.max(1, ...data.map((d) => d.value));
  const width = 640;
  const height = 180;
  const barGap = 6;
  const barWidth = data.length > 0 ? width / data.length - barGap : 0;

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={Math.max(width, data.length * 34)} height={height + 34} role="img" aria-label="Gráfico de vendas por dia">
        {data.map((d, i) => {
          const barHeight = (d.value / max) * (height - 10);
          const x = i * (barWidth + barGap);
          const y = height - barHeight;
          return (
            <g key={i}>
              <rect x={x} y={y} width={Math.max(barWidth, 10)} height={barHeight} rx={4} fill="var(--color-primary)" opacity={0.85}>
                <title>{`${d.label}: ${valueFormatter ? valueFormatter(d.value) : d.value}`}</title>
              </rect>
              <text x={x + Math.max(barWidth, 10) / 2} y={height + 16} fontSize="10" textAnchor="middle" fill="var(--text-muted)">
                {d.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
