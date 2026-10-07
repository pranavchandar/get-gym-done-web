function toPath(values: number[], w: number, h: number, pad = 3, extra: number[] = []): string {
  if (values.length === 0) return '';
  if (values.length === 1 && extra.length === 0) {
    const y = h / 2;
    return `M${pad},${y} L${w - pad},${y}`;
  }
  if (values.length === 1) values = [values[0], values[0]]; // flat line, on the goal's scale
  const min = Math.min(...values, ...extra);
  const max = Math.max(...values, ...extra);
  const range = max - min || 1;
  const innerW = w - pad * 2;
  const innerH = h - pad * 2;
  return values
    .map((v, i) => {
      const x = pad + (i / (values.length - 1)) * innerW;
      const y = pad + (1 - (v - min) / range) * innerH;
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

export function Sparkline({
  values,
  width = 220,
  height = 44,
  color = 'var(--accent-primary)',
  fill = true,
  goal,
}: {
  values: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  /** Optional target drawn as a dashed line; the scale stretches to include it. */
  goal?: number | null;
}) {
  const extra = goal != null ? [goal] : [];
  const d = toPath(values, width, height, 3, extra);
  if (!d) return <svg width={width} height={height} />;
  const areaD =
    fill && values.length > 1 ? `${d} L${width - 3},${height - 3} L${3},${height - 3} Z` : '';
  // Same scale as toPath: the goal's y on the line's axis.
  let goalY: number | null = null;
  if (goal != null) {
    const min = Math.min(...values, goal);
    const range = Math.max(...values, goal) - min || 1;
    goalY = 3 + (1 - (goal - min) / range) * (height - 6);
  }
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {areaD && <path d={areaD} fill={color} opacity={0.12} />}
      {goalY != null && (
        <line x1={3} x2={width - 3} y1={goalY} y2={goalY} stroke="var(--fg3)" strokeWidth={1.5} strokeDasharray="4 4" />
      )}
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DualSparkline({
  primary,
  secondary,
  width = 220,
  height = 48,
}: {
  primary: number[];
  secondary: number[];
  width?: number;
  height?: number;
}) {
  const dp = toPath(primary, width, height);
  const ds = toPath(secondary, width, height);
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      {ds && (
        <path d={ds} fill="none" stroke="var(--fg3)" strokeWidth={1.5} strokeDasharray="3 3" strokeLinecap="round" />
      )}
      {dp && (
        <path d={dp} fill="none" stroke="var(--accent-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}
