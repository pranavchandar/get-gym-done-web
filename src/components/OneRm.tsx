import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { estimate1RM, weightForReps, REP_CAP } from '../domain/onerm';
import { formatWeight, kgToDisplay, displayToKg, pillNumber } from '../domain/units';
import { formatDateShort } from '../domain/dates';
import { statsCtx, bestE1rmOf, loadKind } from '../domain/stats';
import type { BestE1rm } from '../domain/stats';
import { formatLoad } from '../domain/format';
import type { SetLog, Units } from '../types';
import { TrendChart } from './TrendChart';
import type { TrendPoint } from './TrendChart';
import { Sheet } from './ui';

interface Row {
  exId: string;
  best: BestE1rm;
  series: TrendPoint[];
}

/** Estimated 1RM per exercise: best estimate, the set it came from, and its trend. */
export function OneRmSection() {
  const sessions = useStore((s) => s.sessions);
  const setLogs = useStore((s) => s.setLogs);
  const exercises = useStore((s) => s.exercises);
  const bodyMetrics = useStore((s) => s.bodyMetrics);
  const unit = useStore((s) => s.prefs.units);
  const [open, setOpen] = useState<string | null>(null);
  const [calc, setCalc] = useState(false);

  const rows = useMemo(() => {
    const completed = Object.values(sessions)
      .filter((se) => se.completedAt != null)
      .sort((a, b) => (a.completedAt as number) - (b.completedAt as number));
    const order = new Map(completed.map((se, i) => [se.id, i]));
    // exercise -> session index -> logs
    const by = new Map<string, Map<number, SetLog[]>>();
    for (const l of Object.values(setLogs)) {
      const idx = order.get(l.sessionId);
      if (idx == null) continue;
      let m = by.get(l.exerciseId);
      if (!m) by.set(l.exerciseId, (m = new Map()));
      const arr = m.get(idx);
      if (arr) arr.push(l);
      else m.set(idx, [l]);
    }
    const ctx = statsCtx({ exercises, bodyMetrics });
    const out: Row[] = [];
    for (const [exId, perSession] of by) {
      const series: TrendPoint[] = [];
      let best: BestE1rm | null = null;
      for (const idx of [...perSession.keys()].sort((a, b) => a - b)) {
        const b = bestE1rmOf(perSession.get(idx)!, ctx);
        if (!b) continue;
        series.push({ at: completed[idx].completedAt as number, value: b.est });
        if (!best || b.est > best.est) best = b;
      }
      if (best) out.push({ exId, best, series });
    }
    return out.sort((a, b) => b.series.length - a.series.length || b.best.est - a.best.est);
  }, [sessions, setLogs, exercises, bodyMetrics]);

  return (
    <div>
      <div className="row-between mb-12">
        <span className="headline-small">ESTIMATED 1RM</span>
        <button className="chip" onClick={() => setCalc(true)}>Calculator</button>
      </div>
      {rows.length === 0 ? (
        <div className="card muted body-small">
          Log a weighted set of {REP_CAP} reps or fewer to see an estimated one-rep max.
        </div>
      ) : (
        <div className="stack gap-8">
          {rows.map((r) => (
            <div key={r.exId} className="card stack">
              <button
                className="stack"
                style={{ width: '100%', background: 'none', border: 'none', padding: 0, color: 'var(--fg)', textAlign: 'left' }}
                onClick={() => setOpen((o) => (o === r.exId ? null : r.exId))}
                aria-expanded={open === r.exId}
              >
                <div className="row-between gap-12" style={{ width: '100%' }}>
                  <span className="title-small min0">{exercises[r.exId]?.name ?? 'Exercise'}</span>
                  <span className="title-small accent nowrap">{formatWeight(r.best.est, unit)} {unit}</span>
                </div>
                <span className="body-small muted">
                  from {formatLoad(r.best.weightKg, exercises[r.exId], unit)} × {r.best.reps}
                  {loadKind(exercises[r.exId]) === 'bodyweight' ? ` (${formatWeight(r.best.loadKg, unit)} ${unit} total)` : ''} · {formatDateShort(r.best.at)}
                </span>
              </button>
              {open === r.exId && r.series.length > 1 && (
                <div className="mt-8">
                  <TrendChart
                    points={r.series.map((p) => ({ at: p.at, value: kgToDisplay(p.value, unit) }))}
                    format={(v) => `${pillNumber(v)} ${unit}`}
                    height={110}
                    label={`${exercises[r.exId]?.name ?? 'Exercise'} estimated 1RM over time`}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <div className="body-small muted mt-8" style={{ fontSize: 11 }}>
        Epley formula, from your best working set each session; bodyweight moves include your bodyweight. Sets over {REP_CAP} reps and warm-ups aren't used.
      </div>
      {calc && <OneRmCalculator unit={unit} onClose={() => setCalc(false)} />}
    </div>
  );
}

const TABLE_REPS = [1, 2, 3, 4, 5, 6, 8, 10, 12];

/** A weight you could actually load: nearest 0.5 kg / 1 lb. */
const loadable = (display: number, unit: Units) => (unit === 'lbs' ? Math.round(display) : Math.round(display * 2) / 2);

function OneRmCalculator({ unit, onClose }: { unit: Units; onClose: () => void }) {
  const [w, setW] = useState('');
  const [r, setR] = useState('');
  const weightKg = w ? displayToKg(Number(w), unit) : NaN;
  const reps = r ? Number(r) : NaN;
  const est = Number.isFinite(weightKg) && Number.isFinite(reps) ? estimate1RM(weightKg, reps) : null;
  const tooMany = Number.isFinite(reps) && reps > REP_CAP;

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">1RM calculator</div>
      <div className="row gap-8">
        <input className="field" inputMode="decimal" placeholder={`Weight (${unit})`} value={w} onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ''))} autoFocus />
        <input className="field" inputMode="numeric" placeholder="Reps" value={r} onChange={(e) => setR(e.target.value.replace(/\D/g, '').slice(0, 2))} />
      </div>
      {tooMany && <div className="body-small mt-8" style={{ color: 'var(--coral)' }}>Use a set of {REP_CAP} reps or fewer — estimates past that aren't reliable.</div>}
      {est != null && (
        <>
          <div className="center mt-20">
            <div className="label-medium muted">ESTIMATED 1RM</div>
            <div className="display-small accent">{formatWeight(est, unit)} {unit}</div>
          </div>
          <table className="mt-16" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr className="label-small muted">
                <td style={{ padding: '6px 4px' }}>Reps</td>
                <td style={{ padding: '6px 4px' }}>Weight</td>
                <td style={{ padding: '6px 4px', textAlign: 'right' }}>% of 1RM</td>
              </tr>
            </thead>
            <tbody>
              {TABLE_REPS.map((n) => {
                const kg = weightForReps(est, n);
                return (
                  <tr key={n} className="body-small" style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{n}</td>
                    <td style={{ padding: '6px 4px' }}>{n === 1 ? formatWeight(est, unit) : loadable(kgToDisplay(kg, unit), unit)} {unit}</td>
                    <td style={{ padding: '6px 4px', textAlign: 'right' }}>{Math.round((kg / est) * 100)}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      )}
    </Sheet>
  );
}
