import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { dayExercisesOf, sessionLogs, completedHistoryForExercise, lastCompletedLogsForExercise } from '../store/selectors';
import { weightIncreaseSuggestion } from '../domain/progression';
import { kgToDisplay, displayToKg, displayStep, incrementKgFor, formatWeight } from '../domain/units';
import { DEFAULT_START_WEIGHT_KG } from '../types';
import { BigCta, Stepper, StripedPlaceholder, PillChip, Sheet } from '../components/ui';
import { X, More, Check, MinusCircle, Plus, ArrowRight } from '../components/icons';
import { MuscleMap } from '../components/MuscleMap';
import { Keypad } from '../components/Keypad';
import { ExercisePicker } from '../components/ExercisePicker';
import { toast } from '../components/toast';
import { autoPush } from '../sync/gist';

export function ActiveWorkoutScreen() {
  const navigate = useNavigate();
  const { dayId = '' } = useParams();
  const state = useStore();
  const day = state.workoutDays[dayId];
  const unit = state.prefs.units;

  const startOrResume = useStore((s) => s.startOrResumeSession);
  const logSet = useStore((s) => s.logSet);
  const removeSet = useStore((s) => s.removeSet);
  const undoLastSet = useStore((s) => s.undoLastSet);
  const setCurrentIndex = useStore((s) => s.setCurrentIndex);
  const startRestTimer = useStore((s) => s.startRestTimer);
  const adjustRestTimer = useStore((s) => s.adjustRestTimer);
  const clearRestTimer = useStore((s) => s.clearRestTimer);
  const finishWorkout = useStore((s) => s.finishWorkout);
  const addExerciseToWorkout = useStore((s) => s.addExerciseToWorkout);
  const replaceExercise = useStore((s) => s.replaceExercise);
  const removeExerciseFromWorkout = useStore((s) => s.removeExerciseFromWorkout);

  const dayExs = useMemo(() => (day ? dayExercisesOf(state, dayId) : []), [state, day, dayId]);
  const isRest = !!day?.isRestDay;
  const emptyDay = !isRest && dayExs.length === 0;

  // bootstrap session
  useEffect(() => {
    if (!day || isRest || emptyDay) return;
    startOrResume(dayId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayId, isRest, emptyDay]);

  // lazily request notification permission
  useEffect(() => {
    if (isRest || emptyDay) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {});
    }
  }, [isRest, emptyDay]);

  // ephemeral per-exercise UI state
  const [extra, setExtra] = useState<Record<string, number>>({});
  const [removed, setRemoved] = useState<Record<string, number>>({});
  const [overrides, setOverrides] = useState<Record<string, Record<number, number>>>({});
  const [menuOpen, setMenuOpen] = useState(false);
  const [picker, setPicker] = useState<null | 'add' | 'replace'>(null);
  const [keypad, setKeypad] = useState<null | 'weight' | 'reps'>(null);

  const active = state.activeSession;

  if (!day) return <Terminal onBack={() => navigate('/home')} title="NOT FOUND" body="This day does not exist." />;
  if (isRest) return <Terminal onBack={() => navigate('/home')} title="REST DAY" body="Recovery day — no training. Rest up." />;
  if (emptyDay) return <Terminal onBack={() => navigate('/home')} title="NOTHING TO DO" body="This day has no exercises." />;
  if (!active || active.workoutDayId !== dayId) return <div className="pad muted">Loading…</div>;

  const exerciseIds = active.exerciseIds;
  const total = exerciseIds.length;
  const currentIndex = Math.min(active.currentIndex, total - 1);
  const currentExId = exerciseIds[currentIndex];

  const logs = sessionLogs(state, active.sessionId);

  const prescriptionFor = (exId: string) => {
    const de = dayExs.find((d) => d.exerciseId === exId);
    const ex = state.exercises[exId];
    return {
      sets: de?.prescribedSets ?? ex?.defaultSets ?? 3,
      low: de?.prescribedRepsLow ?? ex?.defaultRepsLow ?? 8,
      high: de?.prescribedRepsHigh ?? ex?.defaultRepsHigh ?? 12,
    };
  };

  const infoFor = (exId: string) => {
    const exLogs = logs.filter((l) => l.exerciseId === exId);
    const doneNumbers = new Set(exLogs.map((l) => l.setNumber));
    const maxLogged = exLogs.length ? Math.max(...doneNumbers) : 0;
    const p = prescriptionFor(exId);
    const base = p.sets + (extra[exId] ?? 0) - (removed[exId] ?? 0);
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

  const back = () => navigate('/home');

  return (
    <div className="screen">
      {/* top chrome */}
      <div className="topbar">
        <button className="icon-btn bare" onClick={back} aria-label="Close"><X /></button>
        <div className="grow center">
          <div className="label-small muted">{day.name}</div>
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
          onRemoveSet={(n, logId) => {
            if (logId) removeSet(logId);
            setRemoved((prev) => ({ ...prev, [currentExId]: (prev[currentExId] ?? 0) + 1 }));
          }}
          onAddSet={() => setExtra((prev) => ({ ...prev, [currentExId]: (prev[currentExId] ?? 0) + 1 }))}
          onUndo={() => undoLastSet(currentExId)}
          onOpenKeypad={(mode) => setKeypad(mode)}
          keypad={keypad}
          onCloseKeypad={() => setKeypad(null)}
          onCompleteSet={(setNumber, weightKg, reps, isFinal) => {
            logSet(currentExId, setNumber, weightKg, reps);
            if (isFinal) {
              toast(`Set ${setNumber} logged`);
            } else {
              startRestTimer(state.prefs.restSeconds);
              toast(`Set ${setNumber} logged · ${state.prefs.restSeconds}s rest`);
            }
          }}
          isLastExercise={currentIndex === total - 1}
        />
      </div>

      {/* bottom CTA */}
      <BottomBar
        info={infoFor(currentExId)}
        isLastExercise={currentIndex === total - 1}
        onNext={() => {
          clearRestTimer();
          setCurrentIndex(Math.min(currentIndex + 1, total - 1));
        }}
        onFinish={() => {
          const sid = finishWorkout();
          if (sid) {
            autoPush();
            navigate(`/complete/${sid}`);
          }
        }}
      />

      {/* rest overlay */}
      {active.restEndAt != null && (
        <RestOverlay
          endAt={active.restEndAt}
          duration={active.restDuration ?? state.prefs.restSeconds}
          onAdjust={adjustRestTimer}
          onSkip={clearRestTimer}
          onDone={clearRestTimer}
        />
      )}

      {/* overflow menu */}
      {menuOpen && (
        <Sheet onClose={() => setMenuOpen(false)}>
          <div className="stack gap-8">
            <button className="ghost-cta" onClick={() => { setMenuOpen(false); setPicker('add'); }}>Add exercise</button>
            <button className="ghost-cta" onClick={() => { setMenuOpen(false); setPicker('replace'); }}>Replace this exercise</button>
            {total > 1 && (
              <button className="ghost-cta" style={{ color: 'var(--coral)' }} onClick={() => { removeExerciseFromWorkout(currentExId); setMenuOpen(false); }}>
                Remove this exercise
              </button>
            )}
          </div>
        </Sheet>
      )}

      {picker && (
        <ExercisePicker
          title={picker === 'add' ? 'Add exercise' : 'Replace exercise'}
          onClose={() => setPicker(null)}
          onPick={(id) => {
            if (picker === 'add') addExerciseToWorkout(id);
            else replaceExercise(currentExId, id);
          }}
        />
      )}
    </div>
  );
}

// -------------------------------------------------------------- Exercise content
interface Info {
  exLogs: ReturnType<typeof sessionLogs>;
  doneNumbers: Set<number>;
  setCount: number;
  activeSetNumber: number | null;
  doneCount: number;
  p: { sets: number; low: number; high: number };
}

function ExerciseContent({
  exId,
  exerciseNumber,
  isAdded,
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
}: {
  exId: string;
  exerciseNumber: number;
  isAdded: boolean;
  unit: 'kg' | 'lbs';
  info: Info;
  overrides: Record<number, number>;
  onBump: (displayVal: number, undoneNumbers: number[]) => void;
  onRemoveSet: (n: number, logId?: string) => void;
  onAddSet: () => void;
  onUndo: () => void;
  onOpenKeypad: (mode: 'weight' | 'reps') => void;
  keypad: null | 'weight' | 'reps';
  onCloseKeypad: () => void;
  onCompleteSet: (setNumber: number, weightKg: number, reps: number, isFinal: boolean) => void;
  isLastExercise: boolean;
}) {
  const state = useStore();
  const ex = state.exercises[exId];
  const { setCount, activeSetNumber, doneCount, doneNumbers, p } = info;

  const history = useMemo(() => completedHistoryForExercise(state, exId), [state, exId]);
  const lastLogs = useMemo(() => lastCompletedLogsForExercise(state, exId), [state, exId]);
  const suggestion = useMemo(
    () => weightIncreaseSuggestion(history, p.high, incrementKgFor(unit)),
    [history, p.high, unit],
  );

  const prefill = (n: number): { weightDisplay: number; reps: number } => {
    if (overrides[n] != null) {
      const sameHist = lastLogs.find((l) => l.setNumber === n);
      return { weightDisplay: overrides[n], reps: sameHist?.reps ?? p.low };
    }
    const isExtra = n > p.sets;
    if (isExtra) {
      const cur = [...info.exLogs].sort((a, b) => a.setNumber - b.setNumber);
      if (cur.length) {
        const last = cur[cur.length - 1];
        return { weightDisplay: round(kgToDisplay(last.weightKg, unit)), reps: last.reps };
      }
    }
    const same = lastLogs.find((l) => l.setNumber === n);
    if (same) return { weightDisplay: round(kgToDisplay(same.weightKg, unit)), reps: same.reps };
    if (lastLogs.length) {
      const last = lastLogs[lastLogs.length - 1];
      return { weightDisplay: round(kgToDisplay(last.weightKg, unit)), reps: last.reps };
    }
    return { weightDisplay: round(kgToDisplay(DEFAULT_START_WEIGHT_KG, unit)), reps: p.low };
  };

  const [draft, setDraft] = useState(() => (activeSetNumber ? prefill(activeSetNumber) : { weightDisplay: 0, reps: 0 }));
  const lastActive = useRef<number | null>(activeSetNumber);
  useEffect(() => {
    if (activeSetNumber !== lastActive.current) {
      lastActive.current = activeSetNumber;
      if (activeSetNumber) setDraft(prefill(activeSetNumber));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSetNumber, exId]);

  const step = displayStep(unit);
  const suggestedDisplay = suggestion ? round(kgToDisplay(suggestion.suggestedWeightKg, unit)) : null;
  const showSuggestion =
    suggestedDisplay != null && activeSetNumber != null && draft.weightDisplay < suggestedDisplay - 1e-3;

  const anyDone = doneCount > 0;

  return (
    <div className="stack gap-16" style={{ paddingBottom: 12 }}>
      {/* hero */}
      <StripedPlaceholder label="illustration" style={{ height: 160 }} />
      <div>
        <div className="label-medium muted">EXERCISE {exerciseNumber}{isAdded ? ' · ADDED' : ''}</div>
        <h1 className="headline-large" style={{ margin: '6px 0 10px' }}>{ex?.name ?? 'Exercise'}</h1>
        <span className="pill pill-outline">{p.sets}×{p.low}-{p.high} · PRESCRIPTION</span>
      </div>

      {/* targets */}
      <div className="card row gap-16">
        <MuscleMap muscles={ex ? [ex.primaryMuscle, ...ex.secondaryMuscles] : []} size={64} />
        <div className="stack grow">
          <div className="label-medium muted mb-8">TARGETS</div>
          <div className="row wrap gap-6">
            {ex && <PillChip label={ex.primaryMuscle} variant="solid" />}
            {ex?.secondaryMuscles.map((m) => <PillChip key={m} label={m} variant="outline" />)}
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

      {/* suggestion */}
      {showSuggestion && suggestion && suggestedDisplay != null && (
        <div className="card" style={{ borderColor: 'var(--accent-primary)' }}>
          <div className="label-medium accent mb-8">TIME TO ADD WEIGHT</div>
          <p className="body-medium" style={{ margin: '0 0 12px' }}>
            You hit {formatWeight(suggestion.currentWeightKg, unit)} {unit} × {suggestion.reps} the last 2 sessions — try {formatWeight(suggestion.suggestedWeightKg, unit)} {unit}.
          </p>
          <button
            className="big-cta"
            style={{ minHeight: 48 }}
            onClick={() => {
              const undone: number[] = [];
              for (let n = 1; n <= setCount; n++) if (!doneNumbers.has(n)) undone.push(n);
              onBump(suggestedDisplay, undone);
              setDraft((d) => ({ ...d, weightDisplay: suggestedDisplay }));
            }}
          >
            Bump to {formatWeight(suggestion.suggestedWeightKg, unit)} {unit}
          </button>
        </div>
      )}

      {/* sets */}
      <div className="row-between">
        <span className="headline-small">SETS</span>
        <span className="label-medium muted">{doneCount} / {setCount} done</span>
      </div>
      <div className="stack gap-8">
        {Array.from({ length: setCount }, (_, i) => i + 1).map((n) => {
          const log = info.exLogs.find((l) => l.setNumber === n);
          const isActive = n === activeSetNumber;
          const done = doneNumbers.has(n);
          return (
            <div key={n} className={`set-row ${isActive ? 'active' : ''}`}>
              <span className="label-medium muted" style={{ width: 46 }}>SET {n}</span>
              {done && log ? (
                <div className="row grow gap-8">
                  <span className="title-small grow">{formatWeight(log.weightKg, unit)} {unit} · {log.reps} reps</span>
                  <Check size={18} className="accent" />
                </div>
              ) : isActive ? (
                <div className="row grow" style={{ justifyContent: 'space-around' }}>
                  <Stepper
                    value={draft.weightDisplay}
                    step={step}
                    min={0}
                    onChange={(v) => setDraft((d) => ({ ...d, weightDisplay: round(v) }))}
                    onValueTap={() => onOpenKeypad('weight')}
                    format={(v) => `${formatNum(v)} ${unit}`}
                  />
                  <Stepper
                    value={draft.reps}
                    step={1}
                    min={0}
                    max={99}
                    onChange={(v) => setDraft((d) => ({ ...d, reps: v }))}
                    onValueTap={() => onOpenKeypad('reps')}
                    format={(v) => `${v} reps`}
                  />
                </div>
              ) : (
                <span className="grow muted3">—</span>
              )}
              <button className="icon-btn bare" style={{ width: 28, height: 28, color: 'var(--fg3)' }} onClick={() => onRemoveSet(n, log?.id)} aria-label="remove set">
                <MinusCircle size={18} />
              </button>
            </div>
          );
        })}
      </div>

      {activeSetNumber === null && setCount > 0 && (
        <button className="ghost-cta" onClick={onAddSet}><Plus size={18} /> Add set</button>
      )}

      {anyDone && (
        <button className="text-link center" onClick={onUndo}>Undo last set</button>
      )}

      {/* Complete-set CTA lives here so it sits with the sets */}
      {activeSetNumber != null && (
        <BigCta
          onClick={() => {
            const undoneAfter = setCount - doneNumbers.size - 1;
            const isFinal = isLastExercise && undoneAfter <= 0;
            onCompleteSet(activeSetNumber, displayToKg(draft.weightDisplay, unit), draft.reps, isFinal);
          }}
        >
          Complete set {activeSetNumber}
        </BigCta>
      )}

      {keypad && activeSetNumber != null && (
        <Keypad
          mode={keypad}
          unit={unit}
          initial={keypad === 'weight' ? draft.weightDisplay : draft.reps}
          onClose={onCloseKeypad}
          onSave={(v) => {
            if (keypad === 'weight') setDraft((d) => ({ ...d, weightDisplay: round(v) }));
            else setDraft((d) => ({ ...d, reps: Math.round(v) }));
          }}
        />
      )}
    </div>
  );
}

function BottomBar({
  info,
  isLastExercise,
  onNext,
  onFinish,
}: {
  info: Info;
  isLastExercise: boolean;
  onNext: () => void;
  onFinish: () => void;
}) {
  const done = info.activeSetNumber === null && info.setCount >= 0;
  if (!done) return <div style={{ height: 8 }} />;
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
}: {
  endAt: number;
  duration: number;
  onAdjust: (delta: number) => void;
  onSkip: () => void;
  onDone: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const firedRef = useRef(false);
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

  return (
    <div className="rest-overlay">
      <div className="row gap-24" style={{ alignItems: 'center' }}>
        <button className="icon-btn" style={{ width: 56, height: 56 }} onClick={() => onAdjust(-30)}>−30s</button>
        <svg width={200} height={200} viewBox="0 0 200 200">
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

function round(v: number): number {
  return Math.round(v * 100) / 100;
}
function formatNum(v: number): string {
  return Number.isInteger(v) ? String(v) : String(parseFloat(v.toFixed(2)));
}
