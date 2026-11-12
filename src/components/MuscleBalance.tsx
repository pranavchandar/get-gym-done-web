import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { loadOfLogs, levelsOf, rankOf, MUSCLE_LABEL } from '../domain/muscles';
import { BodyMap } from './BodyMap';
import { workingSets } from '../domain/stats';
import type { Exercise, SetLog } from '../types';

// Muscle groups people count sets for, from each exercise's primary muscle.
const SET_GROUPS: { label: string; muscles: string[] }[] = [
  { label: 'Chest', muscles: ['chest', 'upper chest', 'lower chest'] },
  { label: 'Back', muscles: ['lats', 'mid back', 'back', 'lower back'] },
  { label: 'Shoulders', muscles: ['shoulders', 'front delts', 'side delts', 'rear delts'] },
  { label: 'Traps', muscles: ['traps', 'neck'] },
  { label: 'Biceps', muscles: ['biceps', 'brachialis'] },
  { label: 'Triceps', muscles: ['triceps'] },
  { label: 'Forearms', muscles: ['forearms'] },
  { label: 'Quads', muscles: ['quads'] },
  { label: 'Hamstrings', muscles: ['hamstrings', 'posterior chain'] },
  { label: 'Glutes', muscles: ['glutes', 'abductors', 'adductors'] },
  { label: 'Calves', muscles: ['calves'] },
  { label: 'Core', muscles: ['abs', 'obliques', 'core', 'hip flexors'] },
];

/** Working sets per muscle group (primary muscle only), as a weekly average over `weeks`. */
function setsPerGroup(logs: SetLog[], exercises: Record<string, Exercise>, weeks: number): { label: string; sets: number }[] {
  const counts = new Map<string, number>();
  for (const l of workingSets(logs)) {
    const m = exercises[l.exerciseId]?.primaryMuscle?.toLowerCase();
    const g = SET_GROUPS.find((x) => m && x.muscles.includes(m));
    if (g) counts.set(g.label, (counts.get(g.label) ?? 0) + 1);
  }
  return SET_GROUPS.map((g) => ({ label: g.label, sets: Math.round(((counts.get(g.label) ?? 0) / weeks) * 10) / 10 }));
}

const WINDOWS = [
  { key: 'week', label: 'Week', days: 7, noun: 'this week' },
  { key: 'month', label: 'Month', days: 30, noun: 'in the last 30 days' },
  { key: 'all', label: 'All time', days: Infinity, noun: 'yet' },
] as const;

/** Front/back body map shaded by sets per muscle over a window, plus what was skipped. */
export function MuscleBalanceCard() {
  const setLogs = useStore((s) => s.setLogs);
  const sessions = useStore((s) => s.sessions);
  const exercises = useStore((s) => s.exercises);
  const figure = useStore((s) => s.prefs.bodyFigure ?? 'male');
  const setPrefs = useStore((s) => s.setPrefs);
  const [win, setWin] = useState<(typeof WINDOWS)[number]['key']>('week');

  const def = WINDOWS.find((w) => w.key === win)!;
  const { levels, worked, missed, total, perGroup, perWeek } = useMemo(() => {
    const cutoff = def.days === Infinity ? 0 : Date.now() - def.days * 86400000;
    const doneSessions = Object.values(sessions).filter((se) => se.completedAt != null && se.completedAt >= cutoff);
    const done = new Set(doneSessions.map((se) => se.id));
    const logs = Object.values(setLogs).filter((l) => done.has(l.sessionId));
    const load = loadOfLogs(workingSets(logs), exercises);
    // All time is averaged over the weeks since the first session; a week is a week.
    const first = Math.min(...doneSessions.map((se) => se.completedAt as number));
    const weeks = def.days === Infinity ? Math.max(1, (Date.now() - (Number.isFinite(first) ? first : Date.now())) / (7 * 86400000)) : def.days / 7;
    return { levels: levelsOf(load), ...rankOf(load), total: logs.length, perGroup: setsPerGroup(logs, exercises, weeks), perWeek: def.days !== 7 };
  }, [setLogs, sessions, exercises, def.days]);

  return (
    <div className="card">
      <div className="row-between mb-12">
        <span className="headline-small">MUSCLES</span>
        <button className="chip" onClick={() => setPrefs({ bodyFigure: figure === 'male' ? 'female' : 'male' })} aria-label="Switch body figure">
          {figure === 'male' ? 'Male figure' : 'Female figure'}
        </button>
      </div>
      <div className="seg mb-16">
        {WINDOWS.map((w) => (
          <button key={w.key} className={win === w.key ? 'active' : ''} onClick={() => setWin(w.key)}>{w.label}</button>
        ))}
      </div>
      <BodyMap levels={levels} figure={figure} height={220} label={`muscles trained ${def.noun}`} />
      {total === 0 ? (
        <div className="center muted body-small mt-12">No sets logged {def.noun}.</div>
      ) : (
        <div className="stack gap-8 mt-16">
          <div className="body-small">
            <span className="label-small muted">MOST WORKED </span>
            {worked.slice(0, 4).map((m) => MUSCLE_LABEL[m]).join(' · ')}
          </div>
          {missed.length > 0 && (
            <div className="body-small">
              <span className="label-small muted">NOT TRAINED {def.key === 'all' ? 'YET' : def.key === 'week' ? 'THIS WEEK' : 'THIS MONTH'} </span>
              {/* Neutral: a muscle you chose not to train isn't a mistake. */}
              <span className="muted">{missed.map((m) => MUSCLE_LABEL[m]).join(' · ')}</span>
            </div>
          )}
          <div className="label-small muted mt-8">{perWeek ? 'WORKING SETS PER WEEK (AVERAGE)' : 'WORKING SETS THIS WEEK'}</div>
          <div className="sets-grid">
            {perGroup.map((g) => (
              <div key={g.label} className="sets-cell">
                <span className="body-small">{g.label}</span>
                <span className="title-small" style={{ fontVariantNumeric: 'tabular-nums' }}>{g.sets}</span>
                <span className="sets-bar" aria-hidden="true"><span style={{ width: `${Math.min(100, (g.sets / 20) * 100)}%` }} /></span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="body-small muted mt-12" style={{ fontSize: 11 }}>
        Shading counts working sets (supporting muscles count 40%), relative to your most-trained muscle. Set counts use each exercise's main muscle; bars fill at 20 a week.
      </div>
    </div>
  );
}
