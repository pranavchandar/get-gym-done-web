import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import { ChevronLeft } from './icons';

export function BigCta({
  children,
  onClick,
  disabled,
  style,
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <button className="big-cta" onClick={onClick} disabled={disabled} style={style}>
      {children}
    </button>
  );
}

export function GhostCta({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="ghost-cta" onClick={onClick}>
      {children}
    </button>
  );
}

export function PillChip({
  label,
  variant = 'outline',
  style,
}: {
  label: string;
  variant?: 'solid' | 'outline' | 'surface';
  style?: React.CSSProperties;
}) {
  return <span className={`pill pill-${variant}`} style={style}>{label}</span>;
}

export function InitialTile({ name, size = 56 }: { name: string; size?: number }) {
  const initial = (name.trim().charAt(0) || '?').toUpperCase();
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 12,
        background: 'var(--surface2)',
        border: '1px solid var(--line)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flex: '0 0 auto',
      }}
    >
      <span style={{ fontFamily: 'Anton', fontSize: Math.round(size * 0.45), color: 'var(--accent-text)' }}>
        {initial}
      </span>
    </div>
  );
}

/**
 * The arrow always points the way the number actually moved; only the colour says
 * whether that move is good. Flipping the glyph for "lower is better" metrics (as
 * body fat needs) would claim the value rose when it fell.
 */
export function TrendArrow({
  prev,
  curr,
  goodDirection = 'up',
}: {
  prev: number | null | undefined;
  curr: number | null | undefined;
  goodDirection?: 'up' | 'down' | 'none';
}) {
  if (prev == null || curr == null || prev === curr) return null;
  const up = curr > prev;
  const color =
    goodDirection === 'none'
      ? 'var(--fg2)'
      : (up ? 'up' : 'down') === goodDirection
      ? 'var(--trend-up)'
      : 'var(--trend-down)';
  const delta = Math.abs(curr - prev);
  return (
    <span
      style={{ color, fontWeight: 700 }}
      title={`${up ? 'Up' : 'Down'} ${delta.toFixed(delta < 10 ? 1 : 0)} since last entry`}
    >
      {up ? '↑' : '↓'}
    </span>
  );
}

export function Stepper({
  value,
  onChange,
  step = 1,
  min = -Infinity,
  max = Infinity,
  format,
  onValueTap,
  mini,
}: {
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (v: number) => string;
  onValueTap?: () => void;
  mini?: boolean;
}) {
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  return (
    <div className={`stepper ${mini ? 'mini' : ''}`}>
      <button type="button" aria-label="decrease" onClick={() => onChange(clamp(value - step))}>−</button>
      {onValueTap ? (
        <button type="button" className="value" onClick={onValueTap}>
          {format ? format(value) : value}
        </button>
      ) : (
        <span className="value">{format ? format(value) : value}</span>
      )}
      <button type="button" aria-label="increase" onClick={() => onChange(clamp(value + step))}>+</button>
    </div>
  );
}

export function Sheet({
  children,
  onClose,
  center,
}: {
  children: ReactNode;
  onClose: () => void;
  center?: boolean;
}) {
  const scrimRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // The on-screen keyboard and mobile browser toolbars shrink the *visual* viewport
  // but not the layout viewport that `position: fixed` resolves against, which
  // otherwise strands a sheet's Save button underneath them. Track the difference
  // and lift the scrim by it so the CTA stays reachable.
  useEffect(() => {
    const vv = window.visualViewport;
    const el = scrimRef.current;
    if (!vv || !el) return;
    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      el.style.bottom = `${inset}px`;
    };
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);

  return (
    <div ref={scrimRef} className={`scrim ${center ? 'center' : ''}`} onClick={onClose}>
      <div className={center ? 'dialog' : 'sheet'} onClick={(e) => e.stopPropagation()}>
        {!center && <div className="sheet-handle" />}
        {children}
      </div>
    </div>
  );
}

export function Dialog({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <Sheet onClose={onClose} center>
      {children}
    </Sheet>
  );
}

export function TopBar({
  onBack,
  eyebrow,
  right,
}: {
  onBack?: () => void;
  eyebrow?: string;
  right?: ReactNode;
}) {
  return (
    <div className="topbar">
      {onBack && (
        <button className="icon-btn bare" onClick={onBack} aria-label="Back">
          <ChevronLeft />
        </button>
      )}
      {eyebrow && <span className="label-medium muted grow">{eyebrow}</span>}
      {!eyebrow && <span className="grow" />}
      {right}
    </div>
  );
}

export function SegTabs({
  options,
  value,
  onChange,
}: {
  options: { key: string; label: string }[];
  value: string;
  onChange: (k: string) => void;
}) {
  return (
    <div className="seg">
      {options.map((o) => (
        <button key={o.key} className={value === o.key ? 'active' : ''} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}
