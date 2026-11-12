import { useState } from 'react';
import type { Units } from '../types';
import { kgToDisplay, displayToKg, formatWeight } from '../domain/units';
import { Sheet, BigCta, GhostCta } from './ui';

// Body-metric entry, shared by Profile and the Today screen's weight tile.

const BW_KG_MIN = 20;
const BW_KG_MAX = 400;
const FAT_MIN = 2;
const FAT_MAX = 70;
const MUSCLE_KG_MIN = 10;
const MUSCLE_KG_MAX = 150;

export function LogBodySheet({ unit, onClose, onSave }: { unit: Units; onClose: () => void; onSave: (m: { bodyweightKg?: number | null; bodyFatPct?: number | null; muscleMassKg?: number | null }) => void }) {
  const [w, setW] = useState('');
  const [f, setF] = useState('');
  const [m, setM] = useState('');
  const kg = (v: string) => (v ? displayToKg(Number(v), unit) : null);

  const weightRangeLabel = (minKg: number, maxKg: number) =>
    `Enter ${Math.round(kgToDisplay(minKg, unit))}–${Math.round(kgToDisplay(maxKg, unit))} ${unit}`;

  const wErr = (() => {
    if (!w) return null;
    const kgVal = kg(w);
    if (kgVal === null || !Number.isFinite(kgVal)) return weightRangeLabel(BW_KG_MIN, BW_KG_MAX);
    if (kgVal < BW_KG_MIN || kgVal > BW_KG_MAX) return weightRangeLabel(BW_KG_MIN, BW_KG_MAX);
    return null;
  })();

  const fErr = (() => {
    if (!f) return null;
    const fVal = Number(f);
    if (!Number.isFinite(fVal) || fVal < FAT_MIN || fVal > FAT_MAX) return `Enter ${FAT_MIN}–${FAT_MAX} %`;
    return null;
  })();

  const mErr = (() => {
    if (!m) return null;
    const kgVal = kg(m);
    if (kgVal === null || !Number.isFinite(kgVal)) return weightRangeLabel(MUSCLE_KG_MIN, MUSCLE_KG_MAX);
    if (kgVal < MUSCLE_KG_MIN || kgVal > MUSCLE_KG_MAX) return weightRangeLabel(MUSCLE_KG_MIN, MUSCLE_KG_MAX);
    return null;
  })();

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">Log body metrics</div>
      <div className="stack gap-12">
        <div>
          <input className="field" inputMode="decimal" placeholder={`Bodyweight (${unit})`} autoFocus value={w} onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ''))} />
          {wErr && <div className="body-small" style={{ color: 'var(--coral)' }}>{wErr}</div>}
        </div>
        <div>
          <input className="field" inputMode="decimal" placeholder="Body fat %" value={f} onChange={(e) => setF(e.target.value.replace(/[^\d.]/g, ''))} />
          {fErr && <div className="body-small" style={{ color: 'var(--coral)' }}>{fErr}</div>}
        </div>
        <div>
          <input className="field" inputMode="decimal" placeholder={`Muscle mass (${unit})`} value={m} onChange={(e) => setM(e.target.value.replace(/[^\d.]/g, ''))} />
          {mErr && <div className="body-small" style={{ color: 'var(--coral)' }}>{mErr}</div>}
        </div>
      </div>
      <div className="mt-20">
        <BigCta
          disabled={(!w && !f && !m) || !!wErr || !!fErr || !!mErr}
          onClick={() => {
            onSave({ bodyweightKg: kg(w), bodyFatPct: f ? Number(f) : null, muscleMassKg: kg(m) });
            onClose();
          }}
        >
          Save
        </BigCta>
      </div>
    </Sheet>
  );
}

export function GoalSheet({ unit, goalKg, onClose, onSave }: { unit: Units; goalKg: number | null; onClose: () => void; onSave: (kg: number | null) => void }) {
  const [v, setV] = useState(goalKg != null ? formatWeight(goalKg, unit) : '');
  const kg = v ? displayToKg(Number(v), unit) : null;
  const err = kg != null && (!Number.isFinite(kg) || kg < BW_KG_MIN || kg > BW_KG_MAX)
    ? `Enter ${Math.round(kgToDisplay(BW_KG_MIN, unit))}–${Math.round(kgToDisplay(BW_KG_MAX, unit))} ${unit}`
    : null;
  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-8">Goal weight</div>
      <p className="body-small muted" style={{ margin: '0 0 16px' }}>Drawn as a dashed line on your weight chart; the trend arrow turns green when you move toward it.</p>
      <input className="field" inputMode="decimal" placeholder={`Goal (${unit})`} value={v} onChange={(e) => setV(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />
      {err && <div className="body-small" style={{ color: 'var(--coral)' }}>{err}</div>}
      <div className="stack gap-8 mt-20">
        <BigCta disabled={kg == null || !!err} onClick={() => { onSave(kg); onClose(); }}>Save goal</BigCta>
        {goalKg != null && <GhostCta onClick={() => { onSave(null); onClose(); }}>Clear goal</GhostCta>}
      </div>
    </Sheet>
  );
}

