import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import type { RoutineDraft, DraftDay } from '../store/store';
import { daysOf, dayExercisesOf } from '../store/selectors';
import { MIN_DAYS, MAX_DAYS } from '../types';
import { TopBar, BigCta, GhostCta, Stepper } from '../components/ui';
import { Plus, Trash } from '../components/icons';
import { ExercisePicker } from '../components/ExercisePicker';

export function CustomizeRoutineScreen() {
  const navigate = useNavigate();
  const { seedSplitId } = useParams();
  const state = useStore();
  const commit = useStore((s) => s.commitCustomSplit);

  const initial = useMemo<RoutineDraft>(() => {
    if (seedSplitId && state.splits[seedSplitId]) {
      const split = state.splits[seedSplitId];
      const days: DraftDay[] = daysOf(state, seedSplitId).map((d) => ({
        name: d.name,
        isRestDay: d.isRestDay,
        exercises: dayExercisesOf(state, d.id).map((de) => ({
          exerciseId: de.exerciseId,
          sets: de.prescribedSets,
          repsLow: de.prescribedRepsLow,
          repsHigh: de.prescribedRepsHigh,
        })),
      }));
      return { name: `${split.name} (mine)`, days };
    }
    return {
      name: 'My Routine',
      days: [1, 2, 3].map((n) => ({ name: `Day ${n}`, isRestDay: false, exercises: [] })),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedSplitId]);

  const [draft, setDraft] = useState<RoutineDraft>(initial);
  const [dayIdx, setDayIdx] = useState(0);
  const [picking, setPicking] = useState(false);
  const [removedDays, setRemovedDays] = useState<DraftDay[]>([]);

  const day = draft.days[dayIdx];
  const canLock = draft.days.some((d) => !d.isRestDay && d.exercises.length > 0);

  const setDayCount = (n: number) => {
    const target = Math.max(MIN_DAYS, Math.min(MAX_DAYS, n));

    // Read current values directly (the component re-renders on every stepper
    // click, so draft/removedDays are always fresh here) rather than splitting
    // this across two functional updaters, which would each see a stale view
    // of the other piece of state.
    const days = [...draft.days];
    const removed = [...removedDays];

    // Shrinking: pop days off the end onto the removed stack, most-recently
    // removed on top, so growing back restores them in their original order.
    while (days.length > target) {
      removed.push(days.pop()!);
    }

    // Growing: first restore days from the top of the removed stack (undoing
    // a previous shrink exactly), then fall back to fresh empty days once the
    // stack runs out.
    while (days.length < target) {
      const restored = removed.pop();
      days.push(restored ?? { name: `Day ${days.length + 1}`, isRestDay: false, exercises: [] });
    }

    setDraft((prev) => ({ ...prev, days }));
    setRemovedDays(removed);
    setDayIdx((i) => Math.min(i, target - 1));
  };

  const patchDay = (idx: number, patch: Partial<DraftDay>) => {
    setDraft((prev) => {
      const days = [...prev.days];
      days[idx] = { ...days[idx], ...patch };
      return { ...prev, days };
    });
  };

  const addExercise = (exerciseId: string) => {
    const ex = state.exercises[exerciseId];
    patchDay(dayIdx, {
      exercises: [
        ...day.exercises,
        {
          exerciseId,
          sets: ex?.defaultSets ?? 3,
          repsLow: ex?.defaultRepsLow ?? 8,
          repsHigh: ex?.defaultRepsHigh ?? 12,
        },
      ],
    });
  };

  const lockIn = () => {
    const id = commit(draft);
    if (id) navigate('/home');
  };

  return (
    <div className="ob screen">
      <TopBar onBack={() => navigate(-1)} eyebrow="STEP 3 OF 3" />
      <div className="screen-scroll pad">
        <h1 className="display-small" style={{ margin: '0 0 8px' }}>
          BUILD YOUR<br />ROUTINE.
        </h1>
        <div className="track mb-16">
          <div style={{ width: '100%' }} />
        </div>
        <p className="body-medium muted mb-16">
          {seedSplitId ? 'Tweak the template — swap exercises, adjust reps, rename days.' : 'Name it, set your days, and add exercises.'}
        </p>

        <label className="label-medium muted">Routine name</label>
        <input
          className="field mt-8 mb-16"
          placeholder="e.g. My Routine"
          value={draft.name}
          onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))}
        />

        <div className="row-between mb-16">
          <span className="body-medium">Days per week</span>
          <Stepper value={draft.days.length} onChange={setDayCount} min={MIN_DAYS} max={MAX_DAYS} />
        </div>

        <div className="row gap-8 mb-16" style={{ overflowX: 'auto', paddingBottom: 4 }}>
          {draft.days.map((d, i) => (
            <button key={i} className={`chip ${i === dayIdx ? 'selected' : ''}`} onClick={() => setDayIdx(i)}>
              D{i + 1}
            </button>
          ))}
        </div>

        {day && (
          <div className="card mb-16">
            <input
              className="field mb-16"
              placeholder={day.isRestDay ? 'Rest day' : 'Day name'}
              value={day.isRestDay ? '' : day.name}
              disabled={day.isRestDay}
              style={day.isRestDay ? { opacity: 0.5 } : undefined}
              onChange={(e) => patchDay(dayIdx, { name: e.target.value })}
            />
            <label className="row gap-8 mb-16" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={day.isRestDay}
                onChange={(e) => patchDay(dayIdx, { isRestDay: e.target.checked })}
              />
              <span className="body-medium">Rest day</span>
            </label>

            {!day.isRestDay && (
              <div className="stack gap-12">
                {day.exercises.map((row, ri) => {
                  const ex = state.exercises[row.exerciseId];
                  return (
                    <div key={ri} className="card-2 card" style={{ borderRadius: 12 }}>
                      <div className="row-between mb-8">
                        <span className="title-small">{ex?.name ?? 'Exercise'}</span>
                        <button
                          className="icon-btn bare"
                          style={{ color: 'var(--fg2)', width: 28, height: 28 }}
                          onClick={() => patchDay(dayIdx, { exercises: day.exercises.filter((_, k) => k !== ri) })}
                        >
                          <Trash size={16} />
                        </button>
                      </div>
                      <div className="row-between">
                        <div className="stack gap-4" style={{ alignItems: 'center' }}>
                          <span className="label-small muted">Sets</span>
                          <Stepper mini value={row.sets} min={1} max={10}
                            onChange={(v) => updateRow(setDraft, dayIdx, ri, { sets: Math.max(1, Math.min(10, v)) })} />
                        </div>
                        <div className="stack gap-4" style={{ alignItems: 'center' }}>
                          <span className="label-small muted">Rep low</span>
                          <Stepper mini value={row.repsLow} min={1} max={row.repsHigh}
                            onChange={(v) => updateRow(setDraft, dayIdx, ri, { repsLow: Math.max(1, Math.min(row.repsHigh, v)) })} />
                        </div>
                        <div className="stack gap-4" style={{ alignItems: 'center' }}>
                          <span className="label-small muted">Rep high</span>
                          <Stepper mini value={row.repsHigh} min={row.repsLow} max={30}
                            onChange={(v) => updateRow(setDraft, dayIdx, ri, { repsHigh: Math.max(row.repsLow, Math.min(30, v)) })} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                <button className="ghost-cta" onClick={() => setPicking(true)}>
                  <Plus size={18} /> Add exercise
                </button>
              </div>
            )}
          </div>
        )}

        <div className="stack gap-8">
          <BigCta disabled={!canLock} onClick={lockIn}>Lock it in</BigCta>
          <GhostCta onClick={() => navigate(-1)}>Back</GhostCta>
        </div>
      </div>

      {picking && <ExercisePicker onClose={() => setPicking(false)} onPick={addExercise} />}
    </div>
  );
}

function updateRow(
  setDraft: React.Dispatch<React.SetStateAction<RoutineDraft>>,
  dayIdx: number,
  rowIdx: number,
  patch: Partial<{ sets: number; repsLow: number; repsHigh: number }>,
) {
  setDraft((prev) => {
    const days = [...prev.days];
    const exercises = [...days[dayIdx].exercises];
    exercises[rowIdx] = { ...exercises[rowIdx], ...patch };
    days[dayIdx] = { ...days[dayIdx], exercises };
    return { ...prev, days };
  });
}
