import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import type { SetExtras } from '../store/store';
import { dayExercisesOf, sessionLogs, completedHistoryForExercise, lastCompletedLogsForExercise } from '../store/selectors';
import { progressionAdvice, platesPerSide } from '../domain/progression';
import { kgToDisplay, displayToKg, displayStep, formatWeight, roundDisplay, defaultStartDisplayWeight } from '../domain/units';
import { BigCta, GhostCta, Stepper, PillChip, Sheet, Dialog } from '../components/ui';
import { X, More, Check, MinusCircle, Plus, ArrowRight, ChevronUp, Play, Square, Note } from '../components/icons';
import { BodyMap, levelsForExercise } from '../components/BodyMap';
import { musclesOf } from '../domain/muscles';
import { useWakeLock } from '../domain/wakeLock';
import { prefillSet } from '../domain/prefill';
import { loadKind, statsCtx, bestE1rmOf } from '../domain/stats';
import type { LoadKind } from '../domain/stats';
import { formatSet, formatLoad, formatSeconds, plural } from '../domain/format';
import { epochDayLocal, formatDateShort } from '../domain/dates';
import { TIMED_DEFAULT } from '../store/seed';
import { BAND_LEVELS, REST_MIN, REST_MAX, REST_STEP } from '../types';
import type { SetLog, SetTag, Units, Exercise } from '../types';
import { Keypad } from '../components/Keypad';
import { ExercisePicker } from '../components/ExercisePicker';
import { toast } from '../components/toast';
import { autoPush } from '../sync/gist';

const NOTIF_PROMPT_DISMISSED_KEY = 'get-gym-done:notif-prompt-dismissed';
// Once someone minimizes the rest timer they want it out of the way: remember that.
const REST_COLLAPSED_KEY = 'get-gym-done:rest-collapsed';

function readRestCollapsed(): boolean {
  try {
    return localStorage.getItem(REST_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

const TAG_LABEL: Record<SetTag, string> = { warmup: 'Warm-up', top: 'Top set', backoff: 'Back-off' };
const TAG_SHORT: Record<SetTag, string> = { warmup: 'W', top: 'TOP', backoff: 'B-O' };

export function ActiveWorkoutScreen() {
  const navigate = useNavigate();
  const { dayId = '' } = useParams();
  const state = useStore();
  const day = state.workoutDays[dayId];
  const unit = state.prefs.units;

  const startOrResume = useStore((s) => s.startOrResumeSession);
  const logSet = useStore((s) => s.logSet);
  const removeSetRow = useStore((s) => s.removeSetRow);
  const adjustSetCount = useStore((s) => s.adjustSetCount);
  const undoLastSet = useStore((s) => s.undoLastSet);
  const setCurrentIndex = useStore((s) => s.setCurrentIndex);
  const startRestTimer = useStore((s) => s.startRestTimer);
  const adjustRestTimer = useStore((s) => s.adjustRestTimer);
  const clearRestTimer = useStore((s) => s.clearRestTimer);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const addExerciseToWorkout = useStore((s) => s.addExerciseToWorkout);
  const replaceExercise = useStore((s) => s.replaceExercise);
  const replaceInRoutine = useStore((s) => s.replaceInRoutine);
  const removeExerciseFromWorkout = useStore((s) => s.removeExerciseFromWorkout);
  const discardWorkout = useStore((s) => s.discardWorkout);
  const updateSession = useStore((s) => s.updateSession);

  const dayExs = useMemo(() => (day ? dayExercisesOf(state, dayId) : []), [state, day, dayId]);
  const isRest = !!day?.isRestDay;
  const emptyDay = !isRest && dayExs.length === 0;

  // bootstrap session
  useEffect(() => {
    if (!day || isRest || emptyDay) return;
    startOrResume(dayId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId, isRest, emptyDay]);

  // ephemeral UI state (set counts live in the store so they survive leaving the screen)
  const [overrides, setOverrides] = useState<Record<string, Record<number, number>>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<null | 'add' | 'replace'>(null);
  const [keypad, setKeypad] = useState<null | 'weight' | 'reps'>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<null | { exId: string; n: number; label: string }>(null);
  const [swapForGood, setSwapForGood] = useState<null | { oldId: string; newId: string }>(null);
  const [exSettings, setExSettings] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [restCollapsed, setRestCollapsedState] = useState(readRestCollapsed);
  const setRestCollapsed = (update: (c: boolean) => boolean) =>
    setRestCollapsedState((c) => {
      const next = update(c);
      try {
        localStorage.setItem(REST_COLLAPSED_KEY, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });

  // Keep the screen on for the whole session so the phone doesn't lock between sets.
  useWakeLock(state.prefs.keepAwake !== false && !!day && !isRest && !emptyDay);

  const active = state.activeSession;

  if (!day) return <Terminal onBack={() => navigate('/home')} title="NOT FOUND" body="This day does not exist." />;
  if (isRest) return <Terminal onBack={() => navigate('/home')} title="REST DAY" body="Recovery day — no training. Rest up." />;
  if (emptyDay) return <Terminal onBack={() => navigate('/home')} title="NOTHING TO DO" body="This day has no exercises." />;
  if (!active || active.workoutDayId !== dayId) return <div className="pad muted">Loading…</div>;

  const exerciseIds = active.exerciseIds;
  const total = exerciseIds.length;
  const currentIndex = Math.min(active.currentIndex, total - 1);
  const currentExId = exerciseIds[currentIndex];
  const session = state.sessions[active.sessionId];

  const logs = sessionLogs(state, active.sessionId);

  const prescriptionFor = (exId: string) => {
    const de = dayExs.find((d) => d.exerciseId === exId);
    const ex = state.exercises[exId];
    let low = de?.prescribedRepsLow ?? ex?.defaultRepsLow ?? 8;
    let high = de?.prescribedRepsHigh ?? ex?.defaultRepsHigh ?? 12;
    // A hold written as "1 rep" (older routines) means a hold of a sensible length.
    if (ex?.timed && high <= 1) [low, high] = TIMED_DEFAULT;
    return { sets: de?.prescribedSets ?? ex?.defaultSets ?? 3, low, high };
  };

  const infoFor = (exId: string): Info => {
    const exLogs = logs.filter((l) => l.exerciseId === exId);
    const doneNumbers = new Set(exLogs.map((l) => l.setNumber));
    const maxLogged = exLogs.length ? Math.max(...doneNumbers) : 0;
    const p = prescriptionFor(exId);
    const base = p.sets + (active.setAdjust?.[exId] ?? 0);
    const setCount = Math.max(base, maxLogged, 0);
    let activeSetNumber: number | null = null;
    for (let n = 1; n <= setCount; n++) {
      if (!doneNumbers.has(n)) {
        activeSetNumber = n;
        break;
      }
    }
    const doneCount = [...doneNumbers].filter((n) => n <= setCount).length;
    return { exLogs, doneNumbers, setCount, activeSetNumber, doneCount, p };
  };

  const totalSets = exerciseIds.reduce((a, id) => a + infoFor(id).setCount, 0);
  const doneSets = exerciseIds.reduce((a, id) => a + infoFor(id).doneCount, 0);

  const unfinished = exerciseIds
    .map((id, index) => ({ id, index, info: infoFor(id), name: state.exercises[id]?.name ?? 'Exercise' }))
    .filter((x) => x.info.activeSetNumber !== null);

  const restFor = (exId: string) => state.exercises[exId]?.restSeconds ?? state.prefs.restSeconds;

  const back = () => navigate('/home');

  const doFinish = () => {
    const sid = finishWorkout();
    if (sid) {
      autoPush();
      navigate(`/complete/${sid}`);
    }
  };

  return (
    <div className="screen">
      {/* top chrome */}
      <div className="topbar">
        <button className="icon-btn bare" onClick={back} aria-label="Close"><X /></button>
        <div className="grow center min0">
          <div className="label-small muted ellipsis" title={day.name}>{day.name}</div>
          <div className="title-small">{currentIndex + 1} / {total}</div>
        </div>
        <button className="icon-btn bare" onClick={() => setMenuOpen(true)} aria-label="Menu"><More /></button>
      </div>
      <div className="track thin" style={{ margin: '0 20px' }}>
        <div style={{ width: totalSets ? `${(doneSets / totalSets) * 100}%` : '0%' }} />
      </div>

      {/* exercise dots */}
      <div className="dot-row pad-h" style={{ marginTop: 12 }}>
        {exerciseIds.map((id, i) => {
          const info = infoFor(id);
          const cls = info.activeSetNumber === null && info.setCount > 0 ? 'done' : i === currentIndex ? 'current' : '';
          return <button key={id} className={`ex-dot ${cls}`} onClick={() => setCurrentIndex(i)} aria-label={`exercise ${i + 1}`} />;
        })}
      </div>

      <div className="screen-scroll pad">
        <ExerciseContent
          key={currentExId}
          exId={currentExId}
          exerciseNumber={currentIndex + 1}
          isAdded={active.addedExerciseIds.includes(currentExId)}
          isReplaced={(active.replacedExerciseIds ?? []).includes(currentExId)}
          unit={unit}
          info={infoFor(currentExId)}
          overrides={overrides[currentExId] ?? {}}
          onBump={(displayVal, undoneNumbers) => {
            setOverrides((prev) => {
              const map = { ...(prev[currentExId] ?? {}) };
              for (const n of undoneNumbers) map[n] = displayVal;
              return { ...prev, [currentExId]: map };
            });
          }}
          onRemoveSet={(n, log) => {
            const ex = state.exercises[currentExId];
            if (log) setConfirmRemove({ exId: currentExId, n, label: formatSet(log, ex, unit) });
            else removeSetRow(currentExId, n);
          }}
          onAddSet={() => adjustSetCount(currentExId, 1)}
          onUndo={() => undoLastSet(currentExId)}
          onOpenKeypad={(mode) => setKeypad(mode)}
          keypad={keypad}
          onCloseKeypad={() => setKeypad(null)}
          onCompleteSet={(setNumber, weightKg, reps, extras, isFinal) => {
            logSet(currentExId, setNumber, weightKg, reps, extras);
            if (extras.tag === 'warmup') {
              // Warm-ups are quick: no full rest period between them.
              toast(`Warm-up ${setNumber} logged`);
            } else if (isFinal) {
              toast(`Set ${setNumber} logged`);
            } else {
              const rest = restFor(currentExId);
              startRestTimer(rest);
              // The full-screen timer already says it; a toast would sit on its buttons.
              if (restCollapsed) toast(`Set ${setNumber} logged · ${rest}s rest`);
            }
          }}
          isLastExercise={currentIndex === total - 1}
          onEditSettings={() => setExSettings(true)}
        />
      </div>

      {/* bottom CTA */}
      <BottomBar
        info={infoFor(currentExId)}
        isLastExercise={currentIndex === total - 1}
        nextUnfinished={unfinished.find((u) => u.index !== currentIndex) ?? null}
        onNext={() => {
          clearRestTimer();
          setCurrentIndex(Math.min(currentIndex + 1, total - 1));
        }}
        onGoTo={(i) => {
          clearRestTimer();
          setCurrentIndex(i);
        }}
        onFinish={() => {
          if (unfinished.length > 0) setConfirmFinish(true);
          else doFinish();
        }}
      />
      {active.restEndAt != null && restCollapsed && <div className="rest-bar-spacer" aria-hidden="true" />}

      {/* rest overlay */}
      {active.restEndAt != null && (
        <RestOverlay
          endAt={active.restEndAt}
          duration={active.restDuration ?? state.prefs.restSeconds}
          onAdjust={adjustRestTimer}
          onSkip={clearRestTimer}
          onDone={clearRestTimer}
          collapsed={restCollapsed}
          onToggleCollapsed={() => setRestCollapsed((c) => !c)}
        />
      )}

      {/* confirm finish with unfinished exercises */}
      {confirmFinish && (
        <Dialog onClose={() => setConfirmFinish(false)}>
          <div className="headline-small mb-8">Finish with unfinished sets?</div>
          <p className="body-medium muted" style={{ margin: 0 }}>These exercises still have unlogged sets:</p>
          <div className="stack gap-4" style={{ margin: '12px 0 0' }}>
            {unfinished.map((x) => (
              <div key={x.id} className="body-medium">{x.name} <span className="muted">· {x.info.doneCount}/{x.info.setCount} sets</span></div>
            ))}
          </div>
          <div className="dialog-actions mt-20">
            <GhostCta onClick={() => setConfirmFinish(false)}>Keep training</GhostCta>
            <BigCta style={{ minHeight: 52 }} onClick={() => { setConfirmFinish(false); doFinish(); }}>Finish anyway</BigCta>
          </div>
        </Dialog>
      )}

      {/* overflow menu */}
      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)}>
          <div className="stack gap-8">
            {/* Ending early is normal (a short day, a phone call): it must not require
                deleting every remaining exercise first. */}
            <button
              className="ghost-cta"
              onClick={() => {
                setMenuOpen(false);
                if (doneSets === 0) setConfirmDiscard(true);
                else if (unfinished.length > 0) setConfirmFinish(true);
                else doFinish();
              }}
            >
              Finish workout
            </button>
            <button className="ghost-cta" onClick={() => { setMenuOpen(false); setPicker('add'); }}>Add exercise</button>
            <button className="ghost-cta" onClick={() => { setMenuOpen(false); setPicker('replace'); }}>Replace this exercise</button>
            <button className="ghost-cta" onClick={() => { setMenuOpen(false); setExSettings(true); }}>Exercise notes &amp; rest</button>
            <button className="ghost-cta" onClick={() => { setMenuOpen(false); setNoteOpen(true); }}>{session?.notes ? 'Edit workout note' : 'Add workout note'}</button>
            {total > 1 && (
              <button className="ghost-cta" style={{ color: 'var(--coral)' }} onClick={() => { removeExerciseFromWorkout(currentExId); setMenuOpen(false); }}>
                Remove this exercise
              </button>
            )}
            <button className="ghost-cta" style={{ color: 'var(--coral)' }} onClick={() => { setMenuOpen(false); setConfirmDiscard(true); }}>
              Discard workout
            </button>
          </div>
        </Sheet>
      )}

      {confirmDiscard && (
        <Dialog onClose={() => setConfirmDiscard(false)}>
          <div className="headline-small mb-8">Discard this workout?</div>
          <p className="body-medium muted" style={{ margin: 0 }}>
            {doneSets > 0
              ? `The ${plural(doneSets, 'set')} you logged will be deleted. This can't be undone.`
              : "You haven't logged any sets, so there's nothing to save."}
          </p>
          <div className="dialog-actions mt-20">
            <button
              className="ghost-cta"
              style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
              onClick={() => {
                setConfirmDiscard(false);
                discardWorkout();
                navigate('/home');
                toast('Workout discarded');
              }}
            >
              Discard
            </button>
            <BigCta style={{ minHeight: 52 }} onClick={() => setConfirmDiscard(false)}>Keep training</BigCta>
          </div>
        </Dialog>
      )}

      {confirmRemove && (
        <Dialog onClose={() => setConfirmRemove(null)}>
          <div className="headline-small mb-8">Delete set {confirmRemove.n}?</div>
          <p className="body-medium muted" style={{ margin: 0 }}>{confirmRemove.label} will be removed from this workout.</p>
          <div className="dialog-actions mt-20">
            <button
              className="ghost-cta"
              style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
              onClick={() => {
                removeSetRow(confirmRemove.exId, confirmRemove.n);
                setConfirmRemove(null);
              }}
            >
              Delete
            </button>
            <BigCta style={{ minHeight: 52 }} onClick={() => setConfirmRemove(null)}>Keep it</BigCta>
          </div>
        </Dialog>
      )}

      {swapForGood && (
        <Dialog onClose={() => setSwapForGood(null)}>
          <div className="headline-small mb-8">Swap for good?</div>
          <p className="body-medium muted" style={{ margin: 0 }}>
            Use {state.exercises[swapForGood.newId]?.name ?? 'the new exercise'} instead of {state.exercises[swapForGood.oldId]?.name ?? 'the old one'} in {day.name} from now on, with the same sets and reps?
          </p>
          <div className="dialog-actions mt-20">
            <GhostCta onClick={() => setSwapForGood(null)}>Just today</GhostCta>
            <BigCta
              style={{ minHeight: 52 }}
              onClick={() => {
                replaceInRoutine(dayId, swapForGood.oldId, swapForGood.newId);
                setSwapForGood(null);
                toast(`${day.name} updated`);
              }}
            >
              Update
            </BigCta>
          </div>
        </Dialog>
      )}

      {exSettings && state.exercises[currentExId] && (
        <ExerciseSettingsSheet exercise={state.exercises[currentExId]} defaultRest={state.prefs.restSeconds} onClose={() => setExSettings(false)} />
      )}

      {noteOpen && (
        <NoteSheet
          title="Workout note"
          placeholder="How did it go? Sleep, energy, anything to remember next time."
          initial={session?.notes ?? ''}
          onClose={() => setNoteOpen(false)}
          onSave={(text) => updateSession(active.sessionId, { notes: text })}
        />
      )}

      {picker && (
        <ExercisePicker
          title={picker === 'add' ? 'Add exercise' : 'Replace exercise'}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            if (picker === 'add') addExerciseToWorkout(id);
            else {
              const prescribed = dayExs.some((d) => d.exerciseId === currentExId);
              replaceExercise(currentExId, id);
              if (prescribed && id !== currentExId) setSwapForGood({ oldId: currentExId, newId: id });
            }
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------- Exercise content
interface Info {
  exLogs: SetLog[];
  doneNumbers: Set<number>;
  setCount: number;
  activeSetNumber: number | null;
  doneCount: number;
  p: { sets: number; low: number; high: number };
}

interface Draft {
  weightDisplay: number;
  reps: number;
  band: number;
  tag: SetTag | null;
  rir: number | null;
}

function ExerciseContent({
  exId,
  exerciseNumber,
  isAdded,
  isReplaced,
  unit,
  info,
  overrides,
  onBump,
  onRemoveSet,
  onAddSet,
  onUndo,
  onOpenKeypad,
  keypad,
  onCloseKeypad,
  onCompleteSet,
  isLastExercise,
  onEditSettings,
}: {
  exId: string;
  exerciseNumber: number;
  isAdded: boolean;
  isReplaced: boolean;
  unit: Units;
  info: Info;
  overrides: Record<number, number>;
  onBump: (displayVal: number, undoneNumbers: number[]) => void;
  onRemoveSet: (n: number, log?: SetLog) => void;
  onAddSet: () => void;
  onUndo: () => SetLog | null;
  onOpenKeypad: (mode: 'weight' | 'reps') => void;
  keypad: null | 'weight' | 'reps';
  onCloseKeypad: () => void;
  onCompleteSet: (setNumber: number, weightKg: number, reps: number, extras: SetExtras, isFinal: boolean) => void;
  isLastExercise: boolean;
  onEditSettings: () => void;
}) {
  const state = useStore();
  const snoozeBump = useStore((s) => s.snoozeBump);
  const ex = state.exercises[exId];
  const kind: LoadKind = loadKind(ex);
  const timed = kind === 'time';
  const showWeight = kind === 'weight' || kind === 'bodyweight' || (timed && ex?.equipment !== 'Bodyweight');
  const { setCount, activeSetNumber, doneCount, doneNumbers, p } = info;

  const history = useMemo(() => completedHistoryForExercise(state, exId), [state, exId]);
  const lastLogs = useMemo(() => lastCompletedLogsForExercise(state, exId), [state, exId]);
  const ctx = useMemo(() => statsCtx(state), [state]);
  const best1RM = useMemo(() => (kind === 'weight' || kind === 'bodyweight' ? bestE1rmOf(history, ctx) : null), [history, ctx, kind]);
  const advice = useMemo(() => progressionAdvice(history, ex, p.high, unit), [history, ex, p.high, unit]);
  const snoozed = state.bumpSnooze[exId] === epochDayLocal(Date.now());

  const lastSession = lastLogs.length ? state.sessions[lastLogs[0].sessionId] : undefined;

  const fmtWeight = (display: number) => formatLoad(displayToKg(display, unit), ex, unit) || `${formatNum(display)} ${unit}`;

  const prefill = (n: number): Draft => {
    const tagOf = (logsArr: SetLog[]) => logsArr.find((l) => l.setNumber === n)?.tag ?? null;
    const sameHist = lastLogs.find((l) => l.setNumber === n);
    const base = { band: sameHist?.band ?? info.exLogs.at(-1)?.band ?? 3, tag: tagOf(lastLogs), rir: null };
    if (overrides[n] != null) {
      return { ...base, weightDisplay: overrides[n], reps: sameHist?.reps ?? p.low };
    }
    const guess = prefillSet(n, info.exLogs, lastLogs);
    if (guess) return { ...base, weightDisplay: roundDisplay(kgToDisplay(guess.weightKg, unit), unit), reps: guess.reps };
    return {
      ...base,
      weightDisplay: kind === 'bodyweight' || kind === 'band' ? 0 : defaultStartDisplayWeight(unit, ex?.equipment ?? ''),
      reps: p.low,
    };
  };

  const [draft, setDraft] = useState<Draft>(() => (activeSetNumber ? prefill(activeSetNumber) : { weightDisplay: 0, reps: 0, band: 3, tag: null, rir: null }));
  const lastActive = useRef<number | null>(activeSetNumber);
  useEffect(() => {
    if (activeSetNumber !== lastActive.current) {
      lastActive.current = activeSetNumber;
      if (activeSetNumber) setDraft(prefill(activeSetNumber));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSetNumber, exId]);

  const undo = () => {
    const removed = onUndo();
    // Bring back exactly what was undone, not a fresh guess.
    if (removed) {
      lastActive.current = removed.setNumber;
      setDraft({
        weightDisplay: roundDisplay(kgToDisplay(removed.weightKg, unit), unit),
        reps: removed.reps,
        band: removed.band ?? 3,
        tag: removed.tag ?? null,
        rir: removed.rir ?? null,
      });
    }
  };

  const step = displayStep(unit);
  const suggestedDisplay = advice ? roundDisplay(kgToDisplay(advice.suggestedWeightKg, unit), unit) : null;
  // The advice is about working sets: warm-ups neither trigger nor hide it, and it goes
  // away once accepted or once a working set at the new weight is in.
  const workingDone = info.exLogs.filter((l) => l.tag !== 'warmup');
  const accepted = Object.keys(overrides).length > 0;
  const showSuggestion =
    advice != null &&
    suggestedDisplay != null &&
    activeSetNumber != null &&
    !snoozed &&
    !accepted &&
    (advice.kind === 'bump'
      ? !workingDone.some((l) => l.weightKg >= advice.suggestedWeightKg - 1e-3)
      : workingDone.length === 0);

  const anyDone = doneCount > 0;
  const prescription = timed ? `${p.sets}×${p.low}-${p.high}s` : `${p.sets}×${p.low}-${p.high}`;
  const plates = ex?.equipment === 'Barbell' && activeSetNumber != null ? platesPerSide(draft.weightDisplay, unit) : null;

  return (
    <div className="stack gap-16" style={{ paddingBottom: 12 }}>
      <div>
        <div className="label-medium muted">EXERCISE {exerciseNumber}{isReplaced ? ' · REPLACED' : isAdded ? ' · ADDED' : ''}</div>
        <h1 className="headline-large" style={{ margin: '6px 0 10px' }}>{ex?.name ?? 'Exercise'}</h1>
        <div className="row wrap gap-6">
          <span className="pill pill-outline">{prescription} · PRESCRIPTION</span>
          {best1RM && state.prefs.show1RM !== false && (
            <span className="pill pill-outline" title={`Estimated from ${formatLoad(best1RM.weightKg, ex, unit)} × ${best1RM.reps}`}>
              EST. 1RM {formatWeight(best1RM.est, unit)} {unit}{kind === 'bodyweight' ? ' INCL. BW' : ''}
            </span>
          )}
          {ex?.restSeconds != null && <span className="pill pill-outline">REST {formatSeconds(ex.restSeconds)}</span>}
        </div>
      </div>

      {ex?.notes && (
        <button className="card row gap-12" style={{ textAlign: 'left', color: 'var(--fg)' }} onClick={onEditSettings} aria-label="Edit exercise note">
          <Note size={18} className="accent" />
          <span className="body-medium grow min0" style={{ whiteSpace: 'pre-wrap' }}>{ex.notes}</span>
        </button>
      )}

      {/* targets */}
      <div className="card row wrap gap-16">
        <BodyMap levels={levelsForExercise(musclesOf(ex))} figure={state.prefs.bodyFigure} height={112} label={`muscles worked by ${ex?.name ?? 'this exercise'}`} />
        <div className="stack min0" style={{ flex: '1 1 140px' }}>
          <div className="label-medium muted mb-8">TARGETS</div>
          <div className="row wrap gap-6">
            {ex && <PillChip label={ex.primaryMuscle} variant="solid" style={{ maxWidth: '100%' }} />}
            {ex?.secondaryMuscles.map((m) => <PillChip key={m} label={m} variant="outline" style={{ maxWidth: '100%' }} />)}
          </div>
        </div>
      </div>

      {/* form cues */}
      {ex && ex.formCues.length > 0 && (
        <div className="card">
          <div className="label-medium muted mb-12">FORM CUES</div>
          <div className="stack gap-8">
            {ex.formCues.map((c, i) => (
              <div key={i} className="row gap-12">
                <span className="headline-small accent">{String(i + 1).padStart(2, '0')}</span>
                <span className="body-medium">{c}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* progression suggestion */}
      {showSuggestion && advice && suggestedDisplay != null && (
        <div className="card" style={{ borderColor: 'var(--accent-primary)' }}>
          <div className="label-medium accent mb-8">{advice.kind === 'bump' ? 'TIME TO ADD WEIGHT' : 'WELCOME BACK'}</div>
          <p className="body-medium" style={{ margin: '0 0 12px' }}>
            {advice.kind === 'bump'
              ? `Every working set at ${formatLoad(advice.currentWeightKg, ex, unit)} reached ${advice.reps}+ reps — try ${formatLoad(advice.suggestedWeightKg, ex, unit)}.`
              : `It's been ${advice.daysOff} days since you last did this. Ease back in at ${formatLoad(advice.suggestedWeightKg, ex, unit)}, about 10% lighter, and build up again.`}
          </p>
          <div className="dialog-actions">
            <button className="ghost-cta" onClick={() => snoozeBump(exId)}>Not today</button>
            <button
              className="big-cta"
              style={{ minHeight: 48 }}
              onClick={() => {
                // Working sets only: last time's warm-up slots keep their ramp.
                const warmupSlots = new Set(lastLogs.filter((l) => l.tag === 'warmup').map((l) => l.setNumber));
                const undone: number[] = [];
                for (let n = 1; n <= setCount; n++) if (!doneNumbers.has(n) && !warmupSlots.has(n)) undone.push(n);
                onBump(suggestedDisplay, undone);
                if (draft.tag !== 'warmup') setDraft((d) => ({ ...d, weightDisplay: suggestedDisplay }));
              }}
            >
              Use {formatLoad(advice.suggestedWeightKg, ex, unit)}
            </button>
          </div>
        </div>
      )}

      {/* sets */}
      <div className="row-between">
        <span className="headline-small">SETS</span>
        <span className="label-medium muted">{doneCount} / {setCount} done</span>
      </div>
      {lastLogs.length > 0 && (
        <div className="body-small muted" style={{ marginTop: -8 }}>
          <span className="label-small">LAST TIME{lastSession?.completedAt ? ` · ${formatDateShort(lastSession.completedAt).toUpperCase()}` : ''} </span>
          {lastLogs.map((l) => formatSet(l, ex, unit) + (l.tag === 'warmup' ? ' (W)' : '')).join(' · ')}
        </div>
      )}
      <div className="stack gap-8">
        {Array.from({ length: setCount }, (_, i) => i + 1).map((n) => {
          const log = info.exLogs.find((l) => l.setNumber === n);
          const isActive = n === activeSetNumber;
          const done = doneNumbers.has(n);
          const removeBtn = (
            <button className="icon-btn bare" style={{ width: 28, height: 28, color: 'var(--fg3)' }} onClick={() => onRemoveSet(n, done ? log : undefined)} aria-label={`remove set ${n}`}>
              <MinusCircle size={18} />
            </button>
          );
          if (isActive && !done) {
            // Each input gets a full line: side by side, two steppers don't fit a phone-width card.
            return (
              <div key={n} className="set-row active stack" style={{ alignItems: 'stretch', gap: 8 }}>
                <div className="row-between">
                  <span className="label-medium muted nowrap">SET {n}{draft.tag ? ` · ${TAG_LABEL[draft.tag].toUpperCase()}` : ''}</span>
                  {removeBtn}
                </div>
                {kind === 'band' && (
                  <div className="stack gap-6">
                    <span className="label-small muted">BAND</span>
                    <div className="row wrap gap-6">
                      {BAND_LEVELS.map((label, i) => (
                        <button key={label} className={`chip ${draft.band === i + 1 ? 'selected' : ''}`} onClick={() => setDraft((d) => ({ ...d, band: i + 1 }))}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {showWeight && (
                  <div className="row-between gap-12">
                    <span className="label-small muted min0">
                      {kind === 'bodyweight' ? 'ADDED' : ex?.equipment === 'Dumbbell' ? 'PER HAND' : 'WEIGHT'}
                    </span>
                    <Stepper
                      value={draft.weightDisplay}
                      step={step}
                      min={kind === 'bodyweight' ? -500 : 0}
                      onChange={(v) => setDraft((d) => ({ ...d, weightDisplay: roundDisplay(v, unit) }))}
                      onValueTap={() => onOpenKeypad('weight')}
                      format={fmtWeight}
                    />
                  </div>
                )}
                {plates && plates.plates.length > 0 && (
                  <div className="body-small muted" style={{ textAlign: 'right', marginTop: -4 }}>
                    {plates.exact ? 'Per side: ' : 'Closest per side: '}{plates.plates.join(' · ')}
                  </div>
                )}
                <div className="row-between gap-12">
                  <span className="label-small muted ellipsis min0">{timed ? 'TIME' : 'REPS'}</span>
                  <Stepper
                    value={draft.reps}
                    step={timed ? 5 : 1}
                    min={1}
                    max={timed ? 3600 : 99}
                    onChange={(v) => setDraft((d) => ({ ...d, reps: v }))}
                    onValueTap={() => onOpenKeypad('reps')}
                    format={(v) => (timed ? formatSeconds(v) : plural(v, 'rep'))}
                  />
                </div>
                {timed && <HoldTimer target={p.high} onStop={(sec) => setDraft((d) => ({ ...d, reps: Math.max(1, sec) }))} />}
                <div className="row wrap gap-6" role="group" aria-label="set type">
                  {(['warmup', 'top', 'backoff'] as SetTag[]).map((t) => (
                    <button
                      key={t}
                      className={`chip ${draft.tag === t ? 'selected' : ''}`}
                      style={{ padding: '4px 10px', fontSize: 12 }}
                      aria-pressed={draft.tag === t}
                      onClick={() => setDraft((d) => ({ ...d, tag: d.tag === t ? null : t }))}
                    >
                      {TAG_LABEL[t]}
                    </button>
                  ))}
                </div>
                {state.prefs.logEffort && draft.tag !== 'warmup' && !timed && (
                  <div className="row wrap gap-6" role="group" aria-label="reps in reserve">
                    <span className="label-small muted" style={{ marginRight: 2 }}>REPS LEFT</span>
                    {[0, 1, 2, 3, 4].map((r) => (
                      <button
                        key={r}
                        className={`chip ${draft.rir === r ? 'selected' : ''}`}
                        style={{ padding: '4px 10px', fontSize: 12, minWidth: 34 }}
                        aria-pressed={draft.rir === r}
                        onClick={() => setDraft((d) => ({ ...d, rir: d.rir === r ? null : r }))}
                      >
                        {r === 4 ? '4+' : r}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          return (
            <div key={n} className="set-row">
              <span className="label-medium muted nowrap" style={{ flex: '0 0 46px' }}>SET {n}</span>
              {done && log ? (
                <div className="row grow gap-8 min0">
                  <span className="title-small grow min0">
                    {formatSet(log, ex, unit)}
                    {log.rir != null && <span className="muted body-small"> · {log.rir >= 4 ? '4+' : log.rir} left</span>}
                  </span>
                  {log.tag && <span className="pill pill-outline" style={{ padding: '2px 6px' }}>{TAG_SHORT[log.tag]}</span>}
                  <Check size={18} className="accent" />
                </div>
              ) : (
                <span className="grow muted3">—</span>
              )}
              {removeBtn}
            </div>
          );
        })}
      </div>

      <button className="ghost-cta" onClick={onAddSet}><Plus size={18} /> Add set</button>

      {anyDone && (
        <button className="text-link center" onClick={undo}>Undo last set</button>
      )}

      {/* Complete-set CTA lives here so it sits with the sets */}
      {activeSetNumber != null && (
        <BigCta
          disabled={draft.reps < 1}
          onClick={() => {
            const undoneAfter = setCount - doneNumbers.size - 1;
            const isFinal = isLastExercise && undoneAfter <= 0;
            const extras: SetExtras = { tag: draft.tag, rir: draft.tag === 'warmup' ? null : draft.rir };
            if (kind === 'band') extras.band = draft.band;
            const weightKg = showWeight ? displayToKg(draft.weightDisplay, unit) : 0;
            onCompleteSet(activeSetNumber, weightKg, draft.reps, extras, isFinal);
          }}
        >
          Complete set {activeSetNumber}
        </BigCta>
      )}

      {keypad && activeSetNumber != null && (
        <Keypad
          mode={keypad}
          unit={unit}
          label={keypad === 'reps' && timed ? 'SECONDS' : keypad === 'weight' && kind === 'bodyweight' ? `ADDED WEIGHT · ${unit.toUpperCase()}` : undefined}
          signed={keypad === 'weight' && kind === 'bodyweight'}
          initial={keypad === 'weight' ? draft.weightDisplay : draft.reps}
          onClose={onCloseKeypad}
          onSave={(v) => {
            if (keypad === 'weight') setDraft((d) => ({ ...d, weightDisplay: roundDisplay(v, unit) }));
            else setDraft((d) => ({ ...d, reps: Math.max(1, Math.round(v)) }));
          }}
        />
      )}
    </div>
  );
}

/** A stopwatch for holds: start, stop, and the time goes into the set. */
function HoldTimer({ target, onStop }: { target: number; onStop: (seconds: number) => void }) {
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const beeped = useRef(false);
  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [startedAt]);
  const elapsed = startedAt == null ? 0 : Math.floor((now - startedAt) / 1000);
  useEffect(() => {
    if (startedAt != null && elapsed >= target && !beeped.current) {
      beeped.current = true;
      restAlarm();
    }
  }, [elapsed, target, startedAt]);
  if (startedAt == null) {
    return (
      <button className="ghost-cta" style={{ minHeight: 44 }} onClick={() => { beeped.current = false; setNow(Date.now()); setStartedAt(Date.now()); }}>
        <Play size={16} /> Start hold timer
      </button>
    );
  }
  return (
    <button
      className="big-cta"
      style={{ minHeight: 48, fontVariantNumeric: 'tabular-nums' }}
      onClick={() => {
        onStop(elapsed);
        setStartedAt(null);
      }}
    >
      <Square size={16} /> {formatSeconds(elapsed)} · Stop
    </button>
  );
}

function ExerciseSettingsSheet({ exercise, defaultRest, onClose }: { exercise: Exercise; defaultRest: number; onClose: () => void }) {
  const updateExercise = useStore((s) => s.updateExercise);
  const [notes, setNotes] = useState(exercise.notes ?? '');
  const [ownRest, setOwnRest] = useState(exercise.restSeconds != null);
  const [rest, setRest] = useState(exercise.restSeconds ?? defaultRest);
  const [timed, setTimed] = useState(!!exercise.timed);
  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-4">{exercise.name}</div>
      <p className="body-small muted" style={{ margin: '0 0 16px' }}>Saved with the exercise, so it shows every time you do it.</p>
      <div className="label-medium muted mb-8">Note</div>
      <textarea
        className="field mb-16"
        rows={3}
        placeholder="Seat on 4, pins at 7, grip just outside the rings…"
        value={notes}
        onChange={(e) => setNotes(e.target.value.slice(0, 500))}
      />
      <button className="row-between mb-8" style={{ width: '100%', background: 'none', border: 'none', color: 'var(--fg)', padding: 0 }} role="switch" aria-checked={ownRest} onClick={() => setOwnRest((v) => !v)}>
        <span className="label-medium">OWN REST TIME</span>
        <span className={`switch ${ownRest ? 'on' : ''}`}><span /></span>
      </button>
      {ownRest ? (
        <div className="row-between mb-16">
          <span className="body-small muted">Rest after each set</span>
          <Stepper value={rest} step={REST_STEP / 2} min={REST_MIN / 2} max={REST_MAX} onChange={setRest} format={formatSeconds} label="rest seconds" />
        </div>
      ) : (
        <p className="body-small muted" style={{ margin: '0 0 16px' }}>Uses your default rest ({formatSeconds(defaultRest)}).</p>
      )}
      <button className="row-between mb-8" style={{ width: '100%', background: 'none', border: 'none', color: 'var(--fg)', padding: 0 }} role="switch" aria-checked={timed} onClick={() => setTimed((v) => !v)}>
        <span className="label-medium">LOG AS A TIMED HOLD</span>
        <span className={`switch ${timed ? 'on' : ''}`}><span /></span>
      </button>
      <p className="body-small muted" style={{ margin: '0 0 20px' }}>For planks, hangs and carries: sets are seconds instead of reps.</p>
      <BigCta
        onClick={() => {
          updateExercise(exercise.id, { notes: notes.trim() || null, restSeconds: ownRest ? rest : null, timed });
          onClose();
        }}
      >
        Save
      </BigCta>
    </Sheet>
  );
}

export function NoteSheet({
  title,
  placeholder,
  initial,
  onSave,
  onClose,
}: {
  title: string;
  placeholder: string;
  initial: string;
  onSave: (text: string) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-12">{title}</div>
      <textarea className="field mb-16" rows={4} placeholder={placeholder} value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} autoFocus />
      <BigCta onClick={() => { onSave(text); onClose(); }}>Save</BigCta>
    </Sheet>
  );
}

function BottomBar({
  info,
  isLastExercise,
  nextUnfinished,
  onNext,
  onGoTo,
  onFinish,
}: {
  info: Info;
  isLastExercise: boolean;
  nextUnfinished: { index: number; name: string } | null;
  onNext: () => void;
  onGoTo: (index: number) => void;
  onFinish: () => void;
}) {
  const done = info.activeSetNumber === null && info.setCount >= 0;
  if (!done) return <div style={{ height: 8 }} />;
  if (isLastExercise && nextUnfinished) {
    // The last card is done but an earlier one isn't: going back is the likely next step,
    // finishing early stays one tap away.
    return (
      <div className="pad stack gap-8">
        <BigCta onClick={() => onGoTo(nextUnfinished.index)}>
          <span className="ellipsis min0">Back to {nextUnfinished.name}</span>
        </BigCta>
        <button className="text-link center" onClick={onFinish}>Finish workout</button>
      </div>
    );
  }
  return (
    <div className="pad">
      {isLastExercise ? (
        <BigCta onClick={onFinish}>Finish workout</BigCta>
      ) : (
        <BigCta onClick={onNext}>Next exercise <ArrowRight size={22} /></BigCta>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Rest overlay
function RestOverlay({
  endAt,
  duration,
  onAdjust,
  onSkip,
  onDone,
  collapsed,
  onToggleCollapsed,
}: {
  endAt: number;
  duration: number;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
  onDone: () => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);
  const [notifPrompt, setNotifPrompt] = useState(() => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'default') return false;
    try { return localStorage.getItem(NOTIF_PROMPT_DISMISSED_KEY) !== '1'; } catch { return true; }
  });
  const dismiss = () => {
    try { localStorage.setItem(NOTIF_PROMPT_DISMISSED_KEY, '1'); } catch { /* ignore */ }
    setNotifPrompt(false);
  };
  const enable = () => {
    setNotifPrompt(false);
    if (typeof Notification !== 'undefined') Notification.requestPermission().catch(() => {});
  };
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, []);

  const remainingMs = Math.max(0, endAt - now);
  const remaining = Math.ceil(remainingMs / 1000);

  useEffect(() => {
    if (remainingMs <= 0 && !firedRef.current) {
      firedRef.current = true;
      restAlarm();
      onDone();
    }
  }, [remainingMs, onDone]);

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const frac = duration > 0 ? remainingMs / (duration * 1000) : 0;
  const R = 84;
  const C = 2 * Math.PI * R;

  if (collapsed) {
    return (
      <div className="rest-bar">
        <span className="title-medium" style={{ fontVariantNumeric: 'tabular-nums' }}>{mins}:{String(secs).padStart(2, '0')}</span>
        <span className="label-small muted">REST</span>
        <div className="row gap-6">
          <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => onAdjust(-30)}>−30</button>
          <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={() => onAdjust(30)}>+30</button>
          <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={onSkip} aria-label="Skip rest"><X size={16} /></button>
          <button className="icon-btn" style={{ width: 40, height: 40 }} onClick={onToggleCollapsed} aria-label="Expand timer"><ChevronUp size={16} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="rest-overlay">
      {notifPrompt && (
        <div className="card" style={{ width: 'calc(100% - 40px)', maxWidth: 320, textAlign: 'left' }}>
          <p className="body-medium" style={{ margin: '0 0 12px' }}>Get an alert when rest ends — even if you're in another tab.</p>
          <div className="dialog-actions">
            <button className="ghost-cta" onClick={dismiss}>Not now</button>
            <button className="big-cta" style={{ minHeight: 44 }} onClick={enable}>Enable</button>
          </div>
        </div>
      )}
      <div className="row gap-12" style={{ alignItems: 'center' }}>
        <button className="icon-btn" style={{ width: 56, height: 56 }} onClick={() => onAdjust(-30)}>−30s</button>
        <svg viewBox="0 0 200 200" style={{ width: 'min(200px, calc(100vw - 152px))', height: 'auto' }}>
          <circle cx="100" cy="100" r={R} fill="none" stroke="var(--surface3)" strokeWidth="10" />
          <circle
            cx="100" cy="100" r={R} fill="none" stroke="var(--accent-primary)" strokeWidth="10"
            strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - frac)}
            transform="rotate(-90 100 100)"
          />
          <text x="100" y="96" textAnchor="middle" fontFamily="Anton" fontSize="40" fill="var(--fg)">
            {mins}:{String(secs).padStart(2, '0')}
          </text>
          <text x="100" y="124" textAnchor="middle" fontFamily="Inter" fontWeight="700" fontSize="12" letterSpacing="2" fill="var(--fg2)">REST</text>
        </svg>
        <button className="icon-btn" style={{ width: 56, height: 56 }} onClick={() => onAdjust(30)}>+30s</button>
      </div>
      <button className="ghost-cta" style={{ maxWidth: 200 }} onClick={onSkip}>Skip</button>
      <button className="ghost-cta" style={{ maxWidth: 200 }} onClick={onToggleCollapsed}>Minimize</button>
    </div>
  );
}

function restAlarm() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ac = new Ctx();
      const beep = (t: number) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.frequency.value = 880;
        o.connect(g);
        g.connect(ac.destination);
        g.gain.setValueAtTime(0.001, ac.currentTime + t);
        g.gain.exponentialRampToValueAtTime(0.3, ac.currentTime + t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + t + 0.15);
        o.start(ac.currentTime + t);
        o.stop(ac.currentTime + t + 0.16);
      };
      beep(0);
      beep(0.22);
      window.setTimeout(() => ac.close().catch(() => {}), 600);
    }
  } catch {
    /* ignore */
  }
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try { navigator.vibrate([200, 100, 200]); } catch { /* ignore */ }
  }
  if (typeof document !== 'undefined' && document.hidden && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try { new Notification("Rest's over", { body: 'Time for your next set.' }); } catch { /* ignore */ }
  }
}

function Terminal({ title, body, onBack }: { title: string; body: string; onBack: () => void }) {
  return (
    <div className="screen">
      <div className="topbar">
        <button className="icon-btn bare" onClick={onBack} aria-label="Close"><X /></button>
      </div>
      <div className="center stack gap-16 pad" style={{ paddingTop: 64 }}>
        <h1 className="display-medium" style={{ margin: 0 }}>{title}</h1>
        <p className="body-medium muted">{body}</p>
        <button className="ghost-cta" style={{ maxWidth: 200 }} onClick={onBack}>Back</button>
      </div>
    </div>
  );
}

function formatNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(2)));
}

