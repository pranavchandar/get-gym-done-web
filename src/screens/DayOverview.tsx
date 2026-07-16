import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { daysOf, dayExercisesOf } from '../store/selectors';
import { TopBar, BigCta, GhostCta, SegTabs, Sheet, InitialTile, PillChip, Stepper } from '../components/ui';
import { Swap, Edit, Bed, Check, ArrowRight, ChevronUp, ChevronDown, Trash, Plus } from '../components/icons';
import { ExercisePicker } from '../components/ExercisePicker';

export function DayOverviewScreen() {
  const navigate = useNavigate();
  const { dayId = '' } = useParams();
  const state = useStore();
  const day = state.workoutDays[dayId];
  const [tab, setTab] = useState<'exercises' | 'warmup'>('exercises');
  const [switching, setSwitching] = useState(false);
  const [editing, setEditing] = useState(false);

  const allDays = useMemo(() => (day ? daysOf(state, day.splitId) : []), [state, day]);
  const total = allDays.length;
  const exs = useMemo(() => (day ? dayExercisesOf(state, day.id) : []), [state, day]);

  if (!day) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/home')} />
        <div className="pad center muted">Day not found.</div>
      </div>
    );
  }

  const primaries = [...new Set(exs.map((de) => state.exercises[de.exerciseId]?.primaryMuscle).filter((m): m is string => !!m))];
  const focus = primaries.length ? primaries.slice(0, 2).join(' & ') : (day.muscleGroups[0] ?? day.name);

  return (
    <div className="screen">
      <TopBar
        onBack={() => navigate('/home')}
        right={
          <div className="row gap-8">
            {total > 1 && (
              <button className="icon-btn" aria-label="Switch day" onClick={() => setSwitching(true)}><Swap size={18} /></button>
            )}
            {!day.isRestDay && (
              <button className="icon-btn" aria-label="Edit exercises" onClick={() => setEditing(true)}><Edit size={18} /></button>
            )}
          </div>
        }
      />

      <div className="screen-scroll pad">
        {day.isRestDay ? (
          <div className="center stack gap-16" style={{ paddingTop: 48, alignItems: 'center' }}>
            <div className="label-medium muted">DAY {day.dayNumber} OF {total}</div>
            <Bed size={64} className="accent" />
            <h1 className="display-medium" style={{ margin: 0 }}>REST DAY</h1>
            <p className="body-medium muted" style={{ maxWidth: 320 }}>
              No training today. Recovery is when the work pays off — eat well, sleep, and let the muscles rebuild. Light walks or mobility are fine.
            </p>
          </div>
        ) : (
          <>
            <div className="label-medium muted">DAY {day.dayNumber} OF {total}</div>
            <h1 className="display-small" style={{ margin: '6px 0 12px' }}>{day.name}</h1>
            <div className="row gap-8 mb-16">
              <PillChip label={`${exs.length} exercises`} variant="surface" />
              <PillChip label={`~${exs.length * 11} min`} variant="surface" />
            </div>

            <SegTabs
              options={[{ key: 'exercises', label: 'Exercises' }, { key: 'warmup', label: 'Warmup' }]}
              value={tab}
              onChange={(k) => setTab(k as 'exercises' | 'warmup')}
            />

            {tab === 'exercises' ? (
              <div className="stack gap-12 mt-16">
                {exs.map((de, i) => {
                  const ex = state.exercises[de.exerciseId];
                  return (
                    <div key={de.id} className="card row gap-12">
                      <span className="display-small" style={{ color: 'var(--fg3)', width: 28 }}>{i + 1}</span>
                      <InitialTile name={ex?.name ?? '?'} />
                      <div className="stack grow">
                        <span className="title-small">{ex?.name ?? 'Exercise'}</span>
                        <span className="body-small muted">{ex?.primaryMuscle ?? ''}</span>
                      </div>
                      <span className="pill pill-outline">{de.prescribedSets}×{de.prescribedRepsLow}-{de.prescribedRepsHigh}</span>
                    </div>
                  );
                })}
                {exs.length === 0 && <div className="card center muted">No exercises yet.</div>}
              </div>
            ) : (
              <div className="stack gap-12 mt-16">
                {[
                  '5 min easy bike or rower',
                  `Dynamic stretch — ${focus}, 2 min`,
                  'Band activation — 2×15',
                  'Light ramp-up sets — 1×10',
                ].map((step, i) => (
                  <div key={i} className="card row gap-12">
                    <span className="headline-small accent">{String(i + 1).padStart(2, '0')}</span>
                    <span className="body-large">{step}</span>
                  </div>
                ))}
                <p className="body-small muted center">Skip warmup at your own risk.</p>
              </div>
            )}
          </>
        )}
      </div>

      {!day.isRestDay && (
        <div className="pad">
          {exs.length === 0 ? (
            <BigCta onClick={() => setEditing(true)}>
              Add exercises <ArrowRight size={22} />
            </BigCta>
          ) : (
            <BigCta onClick={() => navigate(`/workout/${day.id}`)}>
              Start workout <ArrowRight size={22} />
            </BigCta>
          )}
        </div>
      )}

      {switching && (
        <Sheet onClose={() => setSwitching(false)}>
          <div className="headline-small mb-16">Switch day</div>
          <div className="stack gap-8">
            {allDays.map((d) => (
              <button
                key={d.id}
                className="card row-between"
                style={{ color: 'var(--fg)' }}
                onClick={() => { setSwitching(false); navigate(`/day/${d.id}`); }}
              >
                <span className="title-small">Day {d.dayNumber} · {d.isRestDay ? 'Rest' : d.name}</span>
                {d.id === day.id && <Check size={18} className="accent" />}
              </button>
            ))}
          </div>
        </Sheet>
      )}

      {editing && <EditExercisesSheet dayId={day.id} onClose={() => setEditing(false)} />}
    </div>
  );
}

interface Row { exerciseId: string; sets: number; repsLow: number; repsHigh: number }

function EditExercisesSheet({ dayId, onClose }: { dayId: string; onClose: () => void }) {
  const state = useStore();
  const day = state.workoutDays[dayId];
  const save = useStore((s) => s.saveDayExercises);
  const [name, setName] = useState(day?.name ?? '');
  const [rows, setRows] = useState<Row[]>(
    () => dayExercisesOf(state, dayId).map((de) => ({
      exerciseId: de.exerciseId,
      sets: de.prescribedSets,
      repsLow: de.prescribedRepsLow,
      repsHigh: de.prescribedRepsHigh,
    })),
  );
  const [picking, setPicking] = useState(false);

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">Edit exercises</div>
      <input className="field mb-16" value={name} onChange={(e) => setName(e.target.value)} placeholder="Day name" />
      <div className="stack gap-12">
        {rows.map((r, i) => {
          const ex = state.exercises[r.exerciseId];
          return (
            <div key={i} className="card-2 card" style={{ borderRadius: 12 }}>
              <div className="row-between mb-8">
                <span className="title-small">{ex?.name ?? 'Exercise'}</span>
                <div className="row gap-4">
                  <button className="icon-btn bare" disabled={i === 0} onClick={() => move(i, -1)}><ChevronUp size={16} /></button>
                  <button className="icon-btn bare" disabled={i === rows.length - 1} onClick={() => move(i, 1)}><ChevronDown size={16} /></button>
                  <button className="icon-btn bare" style={{ color: 'var(--coral)' }} onClick={() => setRows(rows.filter((_, k) => k !== i))}><Trash size={16} /></button>
                </div>
              </div>
              <div className="row-between">
                <div className="stack gap-4" style={{ alignItems: 'center' }}>
                  <span className="label-small muted">Sets</span>
                  <Stepper mini value={r.sets} min={1} max={10} onChange={(v) => patch(setRows, i, { sets: Math.max(1, Math.min(10, v)) })} />
                </div>
                <div className="stack gap-4" style={{ alignItems: 'center' }}>
                  <span className="label-small muted">Rep low</span>
                  <Stepper mini value={r.repsLow} min={1} max={r.repsHigh} onChange={(v) => patch(setRows, i, { repsLow: Math.max(1, Math.min(r.repsHigh, v)) })} />
                </div>
                <div className="stack gap-4" style={{ alignItems: 'center' }}>
                  <span className="label-small muted">Rep high</span>
                  <Stepper mini value={r.repsHigh} min={r.repsLow} max={30} onChange={(v) => patch(setRows, i, { repsHigh: Math.max(r.repsLow, Math.min(30, v)) })} />
                </div>
              </div>
            </div>
          );
        })}
        <button className="ghost-cta" onClick={() => setPicking(true)}><Plus size={18} /> Add exercise</button>
      </div>
      <div className="mt-20">
        <BigCta onClick={() => { save(dayId, name.trim() || day?.name || 'Day', rows); onClose(); }}>Save</BigCta>
      </div>

      {picking && (
        <ExercisePicker
          onClose={() => setPicking(false)}
          onPick={(id) => {
            const ex = state.exercises[id];
            setRows((prev) => [...prev, { exerciseId: id, sets: ex?.defaultSets ?? 3, repsLow: ex?.defaultRepsLow ?? 8, repsHigh: ex?.defaultRepsHigh ?? 12 }]);
          }}
        />
      )}
    </Sheet>
  );
}

function patch(setRows: React.Dispatch<React.SetStateAction<Row[]>>, i: number, p: Partial<Row>) {
  setRows((prev) => {
    const next = [...prev];
    next[i] = { ...next[i], ...p };
    return next;
  });
}
