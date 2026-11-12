import { useEffect, useMemo, useRef, useState } from 'react';
import { formatDateShort, MONTH_NAMES } from '../domain/dates';

export interface TrendPoint {
  at: number;
  value: number;
}

const DAY = 86400000;

/** Trailing 7-day mean at each point: smooths out water-weight noise in daily weigh-ins. */
export function sevenDayAverage(points: TrendPoint[]): TrendPoint[] {
  return points.map((p, i) => {
    let sum = 0;
    let n = 0;
    for (let j = i; j >= 0 && points[j].at > p.at - 7 * DAY; j--) {
      sum += points[j].value;
      n++;
    }
    return { at: p.at, value: sum / n };
  });
}

/** Round a range out to tidy tick values. */
function niceTicks(min: number, max: number, count = 3): number[] {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    min -= pad;
    max += pad;
  }
  const raw = (max - min) / (count - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return ticks;
}

const fmtTick = (v: number) => (Math.abs(v) >= 1000 ? `${Math.round(v / 100) / 10}k` : String(Math.round(v * 10) / 10));

/**
 * A dated line chart: y-axis values, x-axis dates, a crosshair tooltip, an optional dashed
 * goal and an optional 7-day average drawn over the raw points. Values are already in
 * display units; `format` renders one for the tooltip.
 */
export function TrendChart({
  points,
  format,
  goal,
  average = false,
  height = 150,
  label,
  seriesLabel = 'Value',
}: {
  points: TrendPoint[];
  format: (v: number) => string;
  goal?: number | null;
  /** Draw the raw points as dots and a 7-day average as the line. */
  average?: boolean;
  height?: number;
  /** Accessible name of the chart. */
  label: string;
  seriesLabel?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(320);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const update = () => setWidth(Math.max(200, Math.round(el.getBoundingClientRect().width)));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const avg = useMemo(() => (average ? sevenDayAverage(points) : null), [average, points]);
  const line = avg ?? points;

  if (!points.length) return null;

  const M = { l: 40, r: 10, t: 12, b: 24 };
  const w = width - M.l - M.r;
  const h = height - M.t - M.b;
  const values = [...points.map((p) => p.value), ...(goal != null ? [goal] : [])];
  const ticks = niceTicks(Math.min(...values), Math.max(...values));
  const yMin = ticks[0];
  const yMax = ticks[ticks.length - 1];
  const t0 = points[0].at;
  const t1 = points.length > 1 ? points[points.length - 1].at : t0 + DAY;
  const x = (at: number) => M.l + (points.length > 1 ? ((at - t0) / (t1 - t0 || 1)) * w : w / 2);
  const y = (v: number) => M.t + (1 - (v - yMin) / (yMax - yMin || 1)) * h;

  const path = line.map((p, i) => `${i ? 'L' : 'M'}${x(p.at).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ');
  // Over a long span the day of the month means less than the year.
  const long = t1 - t0 > 300 * DAY;
  const xFmt = (t: number) => {
    if (!long) return formatDateShort(t);
    const d = new Date(t);
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} '${String(d.getFullYear()).slice(2)}`;
  };
  const xLabels = points.length > 1 ? (width > 300 ? [t0, (t0 + t1) / 2, t1] : [t0, t1]) : [t0];
  const showDots = average || points.length <= 40;

  const onMove = (e: React.PointerEvent<SVGRectElement>) => {
    const rect = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    const px = e.clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(x(points[i].at) - px) < Math.abs(x(points[best].at) - px)) best = i;
    setHover(best);
  };

  const hp = hover != null ? points[hover] : null;
  const tipLeft = hp ? Math.min(Math.max(x(hp.at), 70), width - 70) : 0;

  return (
    <div ref={wrap} style={{ position: 'relative', width: '100%' }}>
      <svg width={width} height={height} role="img" aria-label={label} style={{ display: 'block', touchAction: 'pan-y' }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.l} x2={width - M.r} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={M.l - 6} y={y(t) + 4} textAnchor="end" fontSize={10} fill="var(--fg2)">{fmtTick(t)}</text>
          </g>
        ))}
        {xLabels.map((t, i) => (
          <text
            key={i}
            x={points.length > 1 ? x(t) : M.l + w / 2}
            y={height - 6}
            textAnchor={xLabels.length === 1 ? 'middle' : i === 0 ? 'start' : i === xLabels.length - 1 ? 'end' : 'middle'}
            fontSize={10}
            fill="var(--fg2)"
          >
            {xFmt(t)}
          </text>
        ))}
        {goal != null && (
          <g>
            <line x1={M.l} x2={width - M.r} y1={y(goal)} y2={y(goal)} stroke="var(--fg2)" strokeWidth={1.5} strokeDasharray="4 4" />
            <text x={width - M.r} y={y(goal) - 4} textAnchor="end" fontSize={10} fill="var(--fg2)">Goal</text>
          </g>
        )}
        {showDots &&
          points.map((p, i) => (
            <circle
              key={i}
              cx={x(p.at)}
              cy={y(p.value)}
              r={average ? 3 : 3.5}
              fill={average ? 'var(--fg3)' : 'var(--accent-primary)'}
              stroke="var(--surface)"
              strokeWidth={average ? 0 : 1.5}
            />
          ))}
        {line.length > 1 && <path d={path} fill="none" stroke="var(--accent-primary)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
        {hp && (
          <g pointerEvents="none">
            <line x1={x(hp.at)} x2={x(hp.at)} y1={M.t} y2={M.t + h} stroke="var(--fg3)" strokeWidth={1} />
            <circle cx={x(hp.at)} cy={y(hp.value)} r={5} fill="var(--accent-primary)" stroke="var(--surface)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={M.l}
          y={0}
          width={w}
          height={height}
          fill="transparent"
          onPointerMove={onMove}
          onPointerDown={onMove}
          onPointerLeave={() => setHover(null)}
        />
      </svg>
      {hp && hover != null && (
        <div
          className="chart-tip"
          style={{ left: tipLeft, top: 0 }}
          role="status"
        >
          <span className="label-small muted">{formatDateShort(hp.at)}</span>
          <span className="title-small">{format(hp.value)}</span>
          {avg && <span className="body-small muted">7-day avg {format(avg[hover].value)}</span>}
        </div>
      )}
      {average && (
        <div className="row gap-16 mt-8 body-small muted">
          <span className="row gap-6"><span style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--fg3)' }} />{seriesLabel}</span>
          <span className="row gap-6"><span style={{ width: 14, height: 2, borderRadius: 2, background: 'var(--accent-primary)' }} />7-day average</span>
        </div>
      )}
      <div className="sr-only">
      <table>
        <caption>{label}</caption>
        <tbody>
          {points.map((p, i) => (
            <tr key={i}>
              <td>{formatDateShort(p.at)}</td>
              <td>{format(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </div>
  );
}
