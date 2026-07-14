import type { ReactNode } from 'react';
import { useEffect } from 'react';
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

export function StripedPlaceholder({
  label,
  style,
  className,
}: {
  label: string;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <div className={`striped ${className ?? ''}`} style={style}>
      {label}
    </div>
  );
}

export function TrendArrow({ prev, curr }: { prev: number | null | undefined; curr: number | null | undefined }) {
  if (prev == null || curr == null || prev === curr) return null;
  const up = curr > prev;
  return (
    <span style={{ color: up ? 'var(--trend-up)' : 'var(--trend-down)', fontWeight: 700 }}>
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
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className={`scrim ${center ? 'center' : ''}`} onClick={onClose}>
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
