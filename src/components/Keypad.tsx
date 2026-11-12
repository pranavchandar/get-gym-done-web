import { useState } from 'react';
import { Sheet, BigCta } from './ui';
import type { Units } from '../types';

export function Keypad({
  initial,
  mode,
  unit,
  onSave,
  onClose,
  label,
  signed = false,
}: {
  initial: number;
  mode: 'weight' | 'reps';
  unit: Units;
  onSave: (value: number) => void;
  onClose: () => void;
  /** Heading override, e.g. "SECONDS" for a timed hold. */
  label?: string;
  /** Allow a negative value (assistance on a bodyweight move). */
  signed?: boolean;
}) {
  const initialStr = Number.isInteger(initial) ? String(Math.abs(initial)) : String(parseFloat(Math.abs(initial).toFixed(2)));
  const [buffer, setBuffer] = useState(initialStr);
  const [negative, setNegative] = useState(signed && initial < 0);
  const [fresh, setFresh] = useState(true); // prefilled placeholder — first keypress clears

  const press = (ch: string) => {
    setBuffer((prev) => {
      let base = fresh ? '' : prev;
      if (ch === '.') {
        if (mode === 'reps') return base;
        if (base.includes('.')) return base;
        if (base === '') base = '0';
      }
      const next = base + ch;
      if (next.replace('.', '').length > 6) return base;
      return next;
    });
    setFresh(false);
  };

  const backspace = () => {
    setBuffer((prev) => (fresh ? '' : prev.slice(0, -1)));
    setFresh(false);
  };

  const quickAdd = (amount: number) => {
    const cur = parseFloat(buffer) || 0;
    const v = Math.max(0, Math.round((cur + amount) * 100) / 100);
    setBuffer(Number.isInteger(v) ? String(v) : String(v));
    setFresh(false);
  };

  const chips = mode === 'weight'
    ? unit === 'lbs'
      ? [5, 10, 25]
      : [2.5, 5, 10]
    : [1, 2, 5];

  const save = () => {
    const v = parseFloat(buffer);
    const abs = Number.isFinite(v) ? v : 0;
    onSave(negative ? -abs : abs);
    onClose();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', mode === 'weight' ? '.' : '', '0', '⌫'];

  return (
    <Sheet onClose={onClose}>
      <div className="center mb-16">
        <div className="label-medium muted">{label ?? (mode === 'weight' ? `WEIGHT · ${unit.toUpperCase()}` : 'REPS')}</div>
        <div className="display-medium" style={{ marginTop: 6, color: fresh ? 'var(--fg2)' : 'var(--fg)' }}>
          {negative ? '−' : ''}{buffer || '0'}
        </div>
      </div>

      <div className="row gap-8 mb-16" style={{ justifyContent: 'center' }}>
        {signed && (
          <button className={`chip ${negative ? 'selected' : ''}`} onClick={() => setNegative((n) => !n)} aria-pressed={negative}>
            {negative ? 'Assisted (−)' : 'Added (+)'}
          </button>
        )}
        {chips.map((c) => (
          <button key={c} className="chip" onClick={() => quickAdd(c)}>
            +{c}
          </button>
        ))}
      </div>

      <div className="keypad mb-16">
        {keys.map((k, i) =>
          k === '' ? (
            <div key={i} />
          ) : k === '⌫' ? (
            <button key={i} onClick={backspace} aria-label="backspace">⌫</button>
          ) : (
            <button key={i} onClick={() => press(k)}>{k}</button>
          ),
        )}
      </div>

      <BigCta onClick={save}>Save</BigCta>
    </Sheet>
  );
}
