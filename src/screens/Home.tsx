import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import {
  activeSplit,
  activeDays,
  lastCompletedDayNumber,
  nextDay as nextDaySel,
  dayExercisesOf,
  completedByEpochDay,
  activityByEpochDay,
  bodyMetricsSorted,
} from '../store/selectors';
import { maxConsecutiveRestDays } from '../domain/rotation';
import { currentStreakDays } from '../domain/streak';
import { epochDayLocal, todayEpochDay, WEEKDAY_FULL, MONTH_NAMES } from '../domain/dates';
import { isTrainingSession } from '../domain/metrics';
import { formatWeight } from '../domain/units';
import { REST_SESSION_NOTE } from '../types';
import { BigCta, GhostCta, Dialog, TrendArrow } from '../components/ui';
import { Confetti } from '../components/Confetti';
import { List, ArrowRight, Bed, Check, ChevronRight, ChevronUp, ChevronDown, Plus, Trash, Activity } from '../components/icons';
import { toast } from '../components/toast';

const ACTIVITY_CHIPS = ['Running', 'Walking', 'Cycling', 'Swimming', 'Pickleball', 'Tennis', 'Table Tennis', 'Basketball', 'Soccer', 'Yoga', 'Hiking'];

function formatElapsed(startedAt: number, now: number): string {
  const mins = Math.max(1, Math.round((now - startedAt) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const state = useStore();
  const autoLogRestDay = useStore((s) => s.autoLogRestDay);
  const moveDay = useStore((s) => s.moveDay);
  const addDay = useStore((s) => s.addDay);
  const removeDay = useStore((s) => s.removeDay);
  const logActivity = useStore((s) => s.logActivity);
  const consumeConfetti = useStore((s) => s.consumeConfetti);

  const split = activeSplit(state);
  const days = useMemo(() => activeDays(state), [state]);
  const unit = state.prefs.units;
  const today = todayEpochDay();
  const autoGuard = useRef<number | null>(null);

  const maxNumber = days.length ? Math.max(...days.map((d) => d.dayNumber)) : 0;
  const lastNum = lastCompletedDayNumber(state);
  const rawNextNum = maxNumber ? ((lastNum ?? 0) % maxNumber) + 1 : 0;
  const rawNextDay = days.find((d) => d.dayNumber === rawNextNum) ?? null;
  const upNext = nextDaySel(state);

  const sessionsArr = Object.values(state.sessions);
  const loggedToday = sessionsArr.some((s) => s.completedAt != null && epochDayLocal(s.completedAt) === today);
  const restLoggedToday = sessionsArr.some(
    (s) => s.completedAt != null && s.notes === REST_SESSION_NOTE && epochDayLocal(s.completedAt) === today,
  );
  const todayIsRest = restLoggedToday || (!!rawNextDay?.isRestDay && !loggedToday);

  // Auto rest-day logging
  useEffect(() => {
    if (!rawNextDay || !rawNextDay.isRestDay) return;
    if (loggedToday) return;
    if (autoGuard.current === today) return;
    autoGuard.current = today;
    autoLogRestDay(rawNextDay.id);
  }, [rawNextDay, loggedToday, today, autoLogRestDay]);

  const maxRestGap = maxConsecutiveRestDays(days);
  const streakDays = currentStreakDays(sessionsArr, maxRestGap);
  const hasTraining = sessionsArr.some(isTrainingSession);
  const streakLost = streakDays === 0 && hasTraining;

  const trainableDayCount = days.filter((d) => !d.isRestDay).length;
  const weekDoneDayNumbers = useMemo(() => {
    const set = new Set<number>();
    const dayIds = new Set(days.map((d) => d.id));
    for (const s of sessionsArr) {
      if (s.completedAt == null || s.notes === REST_SESSION_NOTE || s.workoutDayId == null) continue;
      if (!dayIds.has(s.workoutDayId)) continue;
      if (today - epochDayLocal(s.completedAt) <= 6) {
        const wd = state.workoutDays[s.workoutDayId];
        if (wd) set.add(wd.dayNumber);
      }
    }
    return set;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.sessions, state.workoutDays, days, today]);
  const sessionsThisWeek = weekDoneDayNumbers.size;

  const sessionCount = sessionsArr.filter((s) => s.completedAt != null && s.notes !== REST_SESSION_NOTE).length;

  const bm = useMemo(() => bodyMetricsSorted(state).filter((r) => r.bodyweightKg != null), [state]);
  const bwLatest = bm.length ? bm[bm.length - 1].bodyweightKg : null;
  const bwPrev = bm.length > 1 ? bm[bm.length - 2].bodyweightKg : null;

  const completedMap = useMemo(() => completedByEpochDay(state), [state]);
  const activityMap = useMemo(() => activityByEpochDay(state), [state]);

  const [showActivity, setShowActivity] = useState(false);
  const [editWeek, setEditWeek] = useState(false);

  const weekday = WEEKDAY_FULL[new Date().getDay()];

  const upNextExs = upNext ? dayExercisesOf(state, upNext.id) : [];
  const upNextSets = upNextExs.reduce((a, e) => a + e.prescribedSets, 0);

  const activeSess = state.activeSession;
  const activeSessDay = activeSess ? state.workoutDays[activeSess.workoutDayId] ?? null : null;
  const activeSessStarted = activeSess ? state.sessions[activeSess.sessionId]?.startedAt ?? null : null;
  const activeSessSets = activeSess ? Object.values(state.setLogs).filter((l) => l.sessionId === activeSess.sessionId).length : 0;

  const [nowTick, setNowTick] = useState(Date.now());
  useEffect(() => {
    if (!activeSess) return;
    const id = window.setInterval(() => setNowTick(Date.now()), 30000);
    return () => window.clearInterval(id);
  }, [activeSess]);

  return (
    <div className="pad stack gap-20" style={{ paddingBottom: 32 }}>
      {state.confettiArmed && <Confetti onFinished={consumeConfetti} />}

      {/* Header */}
      <div>
        <div className="label-medium muted">TODAY · {weekday}</div>
        <h1 className="display-medium" style={{ margin: '6px 0 0' }}>
          READY TO<br />GET IT<span className="accent">.</span>
        </h1>
      </div>

      {/* Stat strip */}
      <div className="row gap-8">
        <div className="stat-pill">
          <div className="big">{streakDays > 0 ? `${streakDays}d` : '—'}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>{streakLost ? 'Streak lost' : 'Streak'}</div>
        </div>
        <div className="stat-pill">
          <div className="big">{sessionsThisWeek}/{trainableDayCount}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>This week</div>
        </div>
        <div className="stat-pill">
          <div className="big row" style={{ justifyContent: 'center', gap: 4 }}>
            {bwLatest != null ? `${formatWeight(bwLatest, unit)} ${unit}` : '—'}
            <TrendArrow prev={bwPrev} curr={bwLatest} />
          </div>
          <div className="label-small muted" style={{ marginTop: 4 }}>Bodyweight</div>
        </div>
      </div>

      {/* Rest day card */}
      {todayIsRest && (
        <div className="card">
          <div className="label-medium accent mb-8">TODAY · REST DAY</div>
          <p className="body-medium muted" style={{ margin: 0 }}>
            Recovery is when the work pays off. Eat well, sleep, keep it light — you're back at it tomorrow.
          </p>
        </div>
      )}

      {/* Up-next card */}
      {activeSess && activeSessDay ? (
        <div className="card" style={{ position: 'relative', overflow: 'hidden', background: 'var(--accent-primary)', color: 'var(--on-accent)', borderColor: 'var(--accent-primary)' }}>
          <div className="watermark" style={{ color: 'var(--on-accent)' }}>D{activeSessDay.dayNumber}</div>
          <div className="label-medium" style={{ opacity: 0.7 }}>IN PROGRESS</div>
          <div className="headline-large" style={{ marginTop: 6 }}>DAY {activeSessDay.dayNumber}</div>
          <div className="title-medium" style={{ opacity: 0.85 }}>{activeSessDay.name}</div>
          <div className="body-small" style={{ opacity: 0.8, marginTop: 8 }}>
            {activeSessSets} sets logged{activeSessStarted ? ` · started ${formatElapsed(activeSessStarted, nowTick)} ago` : ''}
          </div>
          <div className="row gap-8 mt-16">
            <button
              className="big-cta grow"
              style={{ background: 'var(--on-accent)', color: 'var(--accent-primary)', minHeight: 52 }}
              onClick={() => navigate(`/workout/${activeSess.workoutDayId}`)}
            >
              Resume workout <ArrowRight size={20} />
            </button>
            <button
              className="icon-btn"
              style={{ background: 'var(--on-accent)', color: 'var(--accent-primary)', border: 'none', width: 52, height: 52 }}
              aria-label="Day overview"
              onClick={() => navigate(`/day/${activeSessDay.id}`)}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      ) : upNext ? (
        <div className="card" style={{ position: 'relative', overflow: 'hidden', background: 'var(--accent-primary)', color: 'var(--on-accent)', borderColor: 'var(--accent-primary)' }}>
          <div className="watermark" style={{ color: 'var(--on-accent)' }}>D{upNext.dayNumber}</div>
          <div className="label-medium" style={{ opacity: 0.7 }}>UP NEXT</div>
          <div className="headline-large" style={{ marginTop: 6 }}>DAY {upNext.dayNumber}</div>
          <div className="title-medium" style={{ opacity: 0.85 }}>{upNext.name}</div>
          <div className="body-small" style={{ opacity: 0.8, marginTop: 8 }}>
            {upNextExs.length} exercises · ~{upNextExs.length * 11} min · {upNextSets} sets
          </div>
          <div className="row gap-8 mt-16">
            <button
              className="big-cta grow"
              style={{ background: 'var(--on-accent)', color: 'var(--accent-primary)', minHeight: 52 }}
              onClick={() => navigate(upNextExs.length === 0 ? `/day/${upNext.id}` : `/workout/${upNext.id}`)}
            >
              {upNextExs.length === 0 ? 'Add exercises' : 'Start workout'} <ArrowRight size={20} />
            </button>
            <button
              className="icon-btn"
              style={{ background: 'var(--on-accent)', color: 'var(--accent-primary)', border: 'none', width: 52, height: 52 }}
              aria-label="Day overview"
              onClick={() => navigate(`/day/${upNext.id}`)}
            >
              <List size={20} />
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="headline-small mb-8">NO ROUTINE YET</div>
          <p className="body-medium muted" style={{ margin: 0 }}>
            Pick a split in Settings → Reset routine to get your week scheduled.
          </p>
        </div>
      )}

      <button className="ghost-cta" onClick={() => setShowActivity(true)}>
        <Activity size={18} /> Log activity
      </button>

      {/* Calendar */}
      <CalendarCard completedMap={completedMap} activityMap={activityMap} today={today} sessionCount={sessionCount}
        canLogToday={!loggedToday && !todayIsRest && !!upNext}
        onToday={() => upNext && navigate(`/day/${upNext.id}`)} />

      {/* This week */}
      {split && days.length > 0 && (
        <div>
          <div className="row-between mb-12">
            <span className="headline-small">THIS WEEK</span>
            <button className="text-link" onClick={() => setEditWeek((e) => !e)}>{editWeek ? 'Done' : 'Edit'}</button>
          </div>
          <div className="stack gap-8">
            {days.map((d, i) => {
              const exs = dayExercisesOf(state, d.id);
              const sets = exs.reduce((a, e) => a + e.prescribedSets, 0);
              const completed = weekDoneDayNumbers.has(d.dayNumber);
              const isNext = upNext?.id === d.id;
              return (
                <div key={d.id} className="card row-between" style={{ padding: 14 }}>
                  <button
                    className="row gap-12 grow"
                    style={{ background: 'none', border: 'none', color: 'var(--fg)', textAlign: 'left', cursor: d.isRestDay ? 'default' : 'pointer' }}
                    disabled={d.isRestDay || editWeek}
                    onClick={() => !d.isRestDay && navigate(`/day/${d.id}`)}
                  >
                    <span className="display-small" style={{ width: 34, color: 'var(--fg3)' }}>{d.dayNumber}</span>
                    <div className="stack">
                      <span className="title-small">{d.isRestDay ? 'REST' : d.name}</span>
                      <span className="body-small muted">{d.isRestDay ? 'Recovery day' : `${exs.length} exercises · ${sets} sets`}</span>
                    </div>
                  </button>
                  {editWeek ? (
                    <div className="row gap-4">
                      <button className="icon-btn bare" disabled={i === 0} onClick={() => moveDay(split.id, d.dayNumber, -1)}><ChevronUp size={18} /></button>
                      <button className="icon-btn bare" disabled={i === days.length - 1} onClick={() => moveDay(split.id, d.dayNumber, 1)}><ChevronDown size={18} /></button>
                      <button className="icon-btn bare" style={{ color: 'var(--coral)' }} onClick={() => {
                        if (!removeDay(d.id)) toast("Can't remove — this day has logged workouts.");
                      }}><Trash size={16} /></button>
                    </div>
                  ) : d.isRestDay ? (
                    <Bed size={18} className="muted" />
                  ) : completed ? (
                    <Check size={18} className="accent" />
                  ) : isNext ? (
                    <span className="pill pill-solid">NEXT</span>
                  ) : (
                    <ChevronRight size={18} className="muted" />
                  )}
                </div>
              );
            })}
            {editWeek && (
              <button className="ghost-cta" onClick={() => addDay(split.id, 'New Day')}>
                <Plus size={18} /> Add day
              </button>
            )}
          </div>
        </div>
      )}

      {showActivity && (
        <LogActivityDialog
          hasNextDay={!!upNext}
          onClose={() => setShowActivity(false)}
          onSave={(a) => {
            logActivity({
              activityType: a.activityType,
              durationMin: a.durationMin,
              notes: a.notes,
              workoutDayId: a.countAsToday && upNext ? upNext.id : null,
            });
            setShowActivity(false);
            toast('Activity logged');
          }}
        />
      )}
    </div>
  );
}

function CalendarCard({
  completedMap,
  activityMap,
  today,
  sessionCount,
  canLogToday,
  onToday,
}: {
  completedMap: Map<number, number>;
  activityMap: Map<number, string>;
  today: number;
  sessionCount: number;
  canLogToday: boolean;
  onToday: () => void;
}) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const first = new Date(year, month, 1);
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card">
      <div className="row-between mb-12">
        <span className="title-medium">{MONTH_NAMES[month]} {year}</span>
        <span className="body-small muted">{sessionCount} session{sessionCount === 1 ? '' : 's'}</span>
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} className="cal-cell empty" />;
          const ed = epochDayLocal(new Date(year, month, d).getTime());
          const workoutNum = completedMap.get(ed);
          const activity = activityMap.get(ed);
          const done = workoutNum != null || activity != null;
          const isToday = ed === today;
          const tag = workoutNum != null ? `D${workoutNum}` : activity ? activity.slice(0, 3).toUpperCase() : '';
          const clickable = isToday && canLogToday;
          return (
            <button
              key={i}
              className={`cal-cell ${done ? 'done' : ''} ${isToday && !done ? 'today' : ''}`}
              disabled={!clickable}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              onClick={onToday}
            >
              <span>{d}</span>
              {tag && <span className="tag">{tag}</span>}
            </button>
          );
        })}
      </div>
      <div className="row gap-16 mt-12">
        <span className="row gap-6 body-small muted"><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--accent-primary)' }} /> Completed</span>
        <span className="row gap-6 body-small muted"><span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid var(--accent-primary)' }} /> Today</span>
      </div>
    </div>
  );
}

function LogActivityDialog({
  hasNextDay,
  onClose,
  onSave,
}: {
  hasNextDay: boolean;
  onClose: () => void;
  onSave: (a: { activityType: string; durationMin: number | null; notes: string | null; countAsToday: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [countAsToday, setCountAsToday] = useState(false);

  return (
    <Dialog onClose={onClose}>
      <div className="headline-small mb-16">Log activity</div>
      <div className="row wrap gap-6 mb-16">
        {ACTIVITY_CHIPS.map((c) => (
          <button key={c} className={`chip ${name === c ? 'selected' : ''}`} onClick={() => setName(c)}>{c}</button>
        ))}
      </div>
      <input className="field mb-12" placeholder="Activity name" value={name} onChange={(e) => setName(e.target.value)} />
      <input
        className="field mb-12"
        placeholder="Duration (min)"
        inputMode="numeric"
        value={duration}
        onChange={(e) => setDuration(e.target.value.replace(/\D/g, '').slice(0, 4))}
      />
      <textarea className="field mb-12" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {hasNextDay && (
        <button className="row-between mb-16" style={{ width: '100%', background: 'none', border: 'none', color: 'var(--fg)' }} onClick={() => setCountAsToday((v) => !v)}>
          <span className="label-medium">COUNT AS TODAY'S WORKOUT</span>
          <span className={`switch ${countAsToday ? 'on' : ''}`}><span /></span>
        </button>
      )}
      <div className="row gap-8">
        <GhostCta onClick={onClose}>Cancel</GhostCta>
        <BigCta
          style={{ minHeight: 52 }}
          disabled={!name.trim()}
          onClick={() => onSave({
            activityType: name.trim(),
            durationMin: duration ? Number(duration) : null,
            notes: notes.trim() || null,
            countAsToday,
          })}
        >
          Save
        </BigCta>
      </div>
    </Dialog>
  );
}
