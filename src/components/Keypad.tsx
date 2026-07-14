import { useState } from 'react';
import { Sheet, BigCta } from './ui';
import type { Units } from '../types';

export function Keypad({
  initial,
  mode,
  unit,
  onSave,
  onClose,
}: {
  initial: number;
  mode: 'weight' | 'reps';
  unit: Units;
  onSave: (value: number) => void;
  onClose: () => void;
}) {
  const initialStr = Number.isInteger(initial) ? String(initial) : String(parseFloat(initial.toFixed(2)));
  const [buffer, setBuffer] = useState(initialStr);
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
    onSave(Number.isFinite(v) ? v : 0);
    onClose();
  };

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', mode === 'weight' ? '.' : '', '0', '⌫'];

  return (
    <Sheet onClose={onClose}>
      <div className="center mb-16">
        <div className="label-medium muted">{mode === 'weight' ? `WEIGHT · ${unit.toUpperCase()}` : 'REPS'}</div>
        <div className="display-medium" style={{ marginTop: 6, color: fresh ? 'var(--fg2)' : 'var(--fg)' }}>
          {buffer || '0'}
        </div>
      </div>

      <div className="row gap-8 mb-16" style={{ justifyContent: 'center' }}>
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
