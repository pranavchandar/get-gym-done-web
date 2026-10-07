import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { loadOfLogs, levelsOf, rankOf, MUSCLE_LABEL } from '../domain/muscles';
import { BodyMap } from './BodyMap';

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
  const { levels, worked, missed, total } = useMemo(() => {
    const cutoff = def.days === Infinity ? 0 : Date.now() - def.days * 86400000;
    const done = new Set(
      Object.values(sessions).filter((se) => se.completedAt != null && se.completedAt >= cutoff).map((se) => se.id),
    );
    const logs = Object.values(setLogs).filter((l) => done.has(l.sessionId));
    const load = loadOfLogs(logs, exercises);
    return { levels: levelsOf(load), ...rankOf(load), total: logs.length };
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
              <span style={{ color: 'var(--coral)' }}>{missed.map((m) => MUSCLE_LABEL[m]).join(' · ')}</span>
            </div>
          )}
        </div>
      )}
      <div className="body-small muted mt-12" style={{ fontSize: 11 }}>
        Shading counts sets (supporting muscles count 40%), relative to your most-trained muscle.
      </div>
    </div>
  );
}
