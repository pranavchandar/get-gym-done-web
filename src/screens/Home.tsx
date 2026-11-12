import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import {
  activeSplit,
  activeDays,
  lastCompletedDayNumber,
  lastRoutineSession,
  nextDay as nextDaySel,
  dayExercisesOf,
  workoutTagByEpochDay,
  activityByEpochDay,
  restByEpochDay,
  bodyMetricsSorted,
  sessionsByEpochDay,
  sessionLogs,
} from '../store/selectors';
import { epochDayLocal, todayEpochDay, WEEKDAY_FULL, MONTH_NAMES } from '../domain/dates';
import { estimateDurationMin } from '../domain/metrics';
import { kgToDisplay, pillNumber, displayToKm, distanceUnit, formatDistance, formatPace } from '../domain/units';
import { trainingEpochDays, weeklyTargetFor, weekStreak, todayPlan, restRunAfter, weekStartOf } from '../domain/schedule';
import { statsCtx, volumeKg } from '../domain/stats';
import { plural, formatMinutes, wantsDistance } from '../domain/format';
import { REST_SESSION_NOTE } from '../types';
import type { Session, Units } from '../types';
import { BigCta, GhostCta, Dialog, Sheet, TrendArrow } from '../components/ui';
import { Confetti } from '../components/Confetti';
import { LogBodySheet } from '../components/BodySheets';
import { List, ArrowRight, Bed, Check, ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Plus, Trash, Activity, Swap } from '../components/icons';
import { toast } from '../components/toast';

const ACTIVITY_CHIPS = ['Running', 'Walking', 'Cycling', 'Swimming', 'Pickleball', 'Tennis', 'Table Tennis', 'Basketball', 'Soccer', 'Yoga', 'Hiking'];
const WEEKDAY_NAME = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function formatElapsed(startedAt: number, now: number): string {
  const mins = Math.max(1, Math.round((now - startedAt) / 60000));
  if (mins < 60) return `${mins} min`;
  return `${Math.floor(mins / 60)} h ${mins % 60} min`;
}

export function HomeScreen() {
  const navigate = useNavigate();
  const state = useStore();
  const moveDay = useStore((s) => s.moveDay);
  const addDay = useStore((s) => s.addDay);
  const removeDay = useStore((s) => s.removeDay);
  const duplicateDay = useStore((s) => s.duplicateDay);
  const logActivity = useStore((s) => s.logActivity);
  const logBodyMetric = useStore((s) => s.logBodyMetric);
  const consumeConfetti = useStore((s) => s.consumeConfetti);

  const split = activeSplit(state);
  const days = useMemo(() => activeDays(state), [state]);
  const unit = state.prefs.units;
  const today = todayEpochDay();

  const upNext = nextDaySel(state);
  const lastNum = lastCompletedDayNumber(state);
  const lastRoutine = lastRoutineSession(state);

  const trainingDays = useMemo(() => trainingEpochDays(state.sessions, state.workoutDays, today), [state.sessions, state.workoutDays, today]);
  const target = weeklyTargetFor(state.prefs, days);
  const streak = weekStreak(trainingDays, target, today);
  const trainedToday = trainingDays.has(today);
  const plan = todayPlan({
    today,
    trainedToday,
    lastRoutineEd: lastRoutine?.completedAt != null ? epochDayLocal(lastRoutine.completedAt) : null,
    restRun: restRunAfter(days, lastNum),
    weekdays: state.prefs.trainingWeekdays,
  });
  const restToday = plan.kind === 'rest';

  // Routine days done this calendar week (the week the "This week" list is about).
  const weekStart = weekStartOf(today);
  const weekDoneDayNumbers = useMemo(() => {
    const set = new Set<number>();
    const dayIds = new Set(days.map((d) => d.id));
    for (const s of Object.values(state.sessions)) {
      if (s.completedAt == null || s.notes === REST_SESSION_NOTE || s.workoutDayId == null) continue;
      if (!dayIds.has(s.workoutDayId)) continue;
      if (epochDayLocal(s.completedAt) >= weekStart) {
        const wd = state.workoutDays[s.workoutDayId];
        if (wd) set.add(wd.dayNumber);
      }
    }
    return set;
  }, [state.sessions, state.workoutDays, days, weekStart]);

  const bm = useMemo(() => bodyMetricsSorted(state).filter((r) => r.bodyweightKg != null), [state]);
  const bwLatest = bm.length ? bm[bm.length - 1].bodyweightKg : null;
  const bwPrev = bm.length > 1 ? bm[bm.length - 2].bodyweightKg : null;

  const workoutMap = useMemo(() => workoutTagByEpochDay(state), [state]);
  const activityMap = useMemo(() => activityByEpochDay(state), [state]);
  const restDayMap = useMemo(() => restByEpochDay(state), [state]);
  const sessionsByDay = useMemo(() => sessionsByEpochDay(state), [state]);

  const [showActivity, setShowActivity] = useState(false);
  const [weighIn, setWeighIn] = useState(false);
  const [editWeek, setEditWeek] = useState(false);
  const [showConfetti, setShowConfetti] = useState(() => state.confettiArmed);
  const [daySheet, setDaySheet] = useState<{ ed: number; label: string } | null>(null);

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

  useEffect(() => {
    if (state.confettiArmed) consumeConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upNextLabel = restToday ? 'AFTER YOUR REST DAY' : plan.kind === 'trained' ? 'DONE TODAY · UP NEXT' : 'UP NEXT';

  return (
    <div className="pad stack gap-20" style={{ paddingBottom: 32 }}>
      {showConfetti && <Confetti onFinished={() => setShowConfetti(false)} />}

      {/* Header */}
      <div>
        <div className="label-medium muted">TODAY · {weekday}</div>
        <h1 className="display-medium" style={{ margin: '6px 0 0' }}>
          {restToday ? <>REST UP.<br />COME BACK<span className="accent"> STRONGER.</span></> : <>READY TO<br />GET IT<span className="accent">.</span></>}
        </h1>
      </div>

      {/* Stat strip */}
      <div className="stat-row">
        <div className="stat-pill" title={`Weeks in a row with at least ${plural(target, 'training day')}. Rest days never break it.`}>
          <div className="big">{streak.current > 0 ? <>{streak.current}<span className="unit">wk</span></> : '—'}</div>
          {/* Narrow phones: "Streak" alone fits a third of the width; the dash says the rest. */}
          <div className="label-small muted" style={{ marginTop: 4 }}>{streak.lost ? <>Streak<span className="hide-narrow"> lost</span></> : <><span className="hide-narrow">Week </span>streak</>}</div>
        </div>
        <div className="stat-pill" title={`Days with a workout or activity this week, out of your target of ${target}.`}>
          <div className="big">{streak.thisWeek}/{target}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>This week</div>
        </div>
        <button className="stat-pill" style={{ color: 'var(--fg)', font: 'inherit' }} onClick={() => setWeighIn(true)} aria-label="Log bodyweight">
          <div className="big row" style={{ justifyContent: 'center', gap: 4 }}>
            {bwLatest != null ? <span>{pillNumber(kgToDisplay(bwLatest, unit))}<span className="unit">{unit}</span></span> : <Plus size={20} />}
            {/* Neutral: whether gaining or losing is "good" depends on the user's goal. */}
            <TrendArrow prev={bwPrev} curr={bwLatest} goodDirection="none" />
          </div>
          <div className="label-small muted" style={{ marginTop: 4 }}>{bwLatest != null ? 'Weight' : 'Log weight'}</div>
        </button>
      </div>

      {/* Rest day card — only on a planned rest day with nothing logged yet */}
      {restToday && !activeSess && (
        <div className="card">
          <div className="label-medium accent mb-8">TODAY · REST DAY</div>
          <p className="body-medium muted" style={{ margin: 0 }}>
            {plan.reason === 'schedule'
              ? `Not one of your training days.${plan.nextTrainingWeekday != null ? ` Next up on ${WEEKDAY_NAME[plan.nextTrainingWeekday]}.` : ''} Eat well, sleep, keep it light.`
              : 'Your routine has a rest day here. Recovery is when the work pays off — your next workout is waiting below whenever you want it.'}
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
            {plural(activeSessSets, 'set')} logged{activeSessStarted ? ` · started ${formatElapsed(activeSessStarted, nowTick)} ago` : ''}
          </div>
          <div className="row gap-8 mt-16">
            <button
              className="big-cta grow"
              style={{ background: 'var(--on-accent)', color: 'var(--accent-primary)', minHeight: 52, fontSize: 'clamp(17px, 5.6vw, 22px)', whiteSpace: 'nowrap' }}
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
        <div
          className="card"
          style={
            restToday
              ? { position: 'relative', overflow: 'hidden' }
              : { position: 'relative', overflow: 'hidden', background: 'var(--accent-primary)', color: 'var(--on-accent)', borderColor: 'var(--accent-primary)' }
          }
        >
          <div className="watermark" style={{ color: restToday ? 'var(--fg)' : 'var(--on-accent)' }}>D{upNext.dayNumber}</div>
          <div className="label-medium" style={{ opacity: 0.7 }}>{upNextLabel}</div>
          <div className="headline-large" style={{ marginTop: 6 }}>DAY {upNext.dayNumber}</div>
          <div className="title-medium" style={{ opacity: 0.85 }}>{upNext.name}</div>
          <div className="body-small" style={{ opacity: 0.8, marginTop: 8 }}>
            {plural(upNextExs.length, 'exercise')} · ~{estimateDurationMin(upNextSets, state.prefs.restSeconds)} min · {plural(upNextSets, 'set')}
          </div>
          <div className="row gap-8 mt-16">
            <button
              className={restToday ? 'ghost-cta grow' : 'big-cta grow'}
              style={
                restToday
                  ? { minHeight: 52, whiteSpace: 'nowrap' }
                  : { background: 'var(--on-accent)', color: 'var(--accent-primary)', minHeight: 52, fontSize: 'clamp(17px, 5.6vw, 22px)', whiteSpace: 'nowrap' }
              }
              onClick={() => navigate(upNextExs.length === 0 ? `/day/${upNext.id}` : `/workout/${upNext.id}`)}
            >
              {upNextExs.length === 0 ? 'Add exercises' : restToday ? 'Train anyway' : 'Start workout'} <ArrowRight size={20} />
            </button>
            <button
              className="icon-btn"
              style={restToday ? { width: 52, height: 52 } : { background: 'var(--on-accent)', color: 'var(--accent-primary)', border: 'none', width: 52, height: 52 }}
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
      <CalendarCard workoutMap={workoutMap} activityMap={activityMap} restDays={restDayMap} today={today}
        canLogToday={!trainedToday && !!upNext}
        onToday={() => upNext && navigate(`/day/${upNext.id}`)}
        sessionsByDay={sessionsByDay}
        onDaySessions={(ed, label) => setDaySheet({ ed, label })} />

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
                    className="row gap-12 grow min0"
                    style={{ background: 'none', border: 'none', color: 'var(--fg)', textAlign: 'left', cursor: d.isRestDay ? 'default' : 'pointer' }}
                    disabled={d.isRestDay || editWeek}
                    onClick={() => !d.isRestDay && navigate(`/day/${d.id}`)}
                  >
                    <span className="display-small" style={{ flex: '0 0 34px', color: 'var(--fg3)' }}>{d.dayNumber}</span>
                    <div className="stack min0">
                      <span className="title-small">{d.isRestDay ? 'REST' : d.name}</span>
                      <span className="body-small muted">{d.isRestDay ? 'Recovery day' : `${plural(exs.length, 'exercise')} · ${plural(sets, 'set')}`}</span>
                    </div>
                  </button>
                  {editWeek ? (
                    <div className="row gap-4">
                      <button className="icon-btn bare" aria-label="Move up" disabled={i === 0} onClick={() => moveDay(split.id, d.dayNumber, -1)}><ChevronUp size={18} /></button>
                      <button className="icon-btn bare" aria-label="Move down" disabled={i === days.length - 1} onClick={() => moveDay(split.id, d.dayNumber, 1)}><ChevronDown size={18} /></button>
                      {!d.isRestDay && (
                        <button className="icon-btn bare hide-narrow" aria-label="Copy day" onClick={() => { duplicateDay(d.id); toast(`${d.name} copied`); }}><Swap size={16} /></button>
                      )}
                      <button className="icon-btn bare" aria-label="Remove day" style={{ color: 'var(--coral)' }} onClick={() => {
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
          unit={unit}
          hasNextDay={!!upNext}
          nextDayLabel={upNext ? `Day ${upNext.dayNumber} · ${upNext.name}` : null}
          onClose={() => setShowActivity(false)}
          onSave={(a) => {
            logActivity({
              activityType: a.activityType,
              durationMin: a.durationMin,
              notes: a.notes,
              distanceKm: a.distanceKm,
              workoutDayId: a.countAsToday && upNext ? upNext.id : null,
            });
            setShowActivity(false);
            toast('Activity logged');
          }}
        />
      )}

      {weighIn && <LogBodySheet unit={unit} onClose={() => setWeighIn(false)} onSave={(m) => { logBodyMetric(m); toast('Logged'); }} />}

      {daySheet && <DaySessionsSheet ed={daySheet.ed} label={daySheet.label} onClose={() => setDaySheet(null)} />}
    </div>
  );
}

function CalendarCard({
  workoutMap,
  activityMap,
  restDays,
  today,
  canLogToday,
  onToday,
  sessionsByDay,
  onDaySessions,
}: {
  workoutMap: Map<number, string>;
  activityMap: Map<number, string>;
  restDays: Set<number>;
  today: number;
  canLogToday: boolean;
  onToday: () => void;
  sessionsByDay: Map<number, Session[]>;
  onDaySessions: (ed: number, label: string) => void;
}) {
  // 0 = this month, -1 = last month, … Paging stops at the month of the first session.
  const [offset, setOffset] = useState(0);
  const now = new Date();
  const view = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const first = view;
  const firstEd = Math.min(...sessionsByDay.keys());
  const earliest = Number.isFinite(firstEd) ? new Date(firstEd * 86400000) : now;
  const canGoBack = year * 12 + month > earliest.getUTCFullYear() * 12 + earliest.getUTCMonth();
  // Sessions in the month on screen (rest-day logs aren't sessions), not the all-time total.
  let monthSessions = 0;
  for (const [ed, list] of sessionsByDay) {
    const d = new Date(ed * 86400000);
    if (d.getUTCFullYear() === year && d.getUTCMonth() === month) {
      monthSessions += list.filter((s) => s.notes !== REST_SESSION_NOTE).length;
    }
  }
  const startWeekday = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="card">
      <div className="row-between gap-8 mb-12">
        <div className="stack min0">
          <span className="title-medium">{MONTH_NAMES[month]} {year}</span>
          <span className="body-small muted">{plural(monthSessions, 'session')} this month</span>
        </div>
        <div className="row gap-4">
          <button className="icon-btn" disabled={!canGoBack} style={{ opacity: canGoBack ? 1 : 0.35 }} onClick={() => setOffset((o) => o - 1)} aria-label="Previous month">
            <ChevronLeft size={18} />
          </button>
          <button className="icon-btn" disabled={offset === 0} style={{ opacity: offset === 0 ? 0.35 : 1 }} onClick={() => setOffset((o) => Math.min(0, o + 1))} aria-label="Next month">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="cal-grid cal-weekdays" aria-hidden="true">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((w, i) => <span key={i}>{w}</span>)}
      </div>
      <div className="cal-grid">
        {cells.map((d, i) => {
          if (d == null) return <div key={i} className="cal-cell empty" />;
          const ed = epochDayLocal(new Date(year, month, d).getTime());
          const workout = workoutMap.get(ed);
          const activity = activityMap.get(ed);
          const done = workout != null || activity != null;
          // A logged rest day is real data, but it is not a completed workout —
          // mark it distinctly instead of filling the cell as if it were one.
          const rested = !done && restDays.has(ed);
          const isToday = ed === today;
          const daySessions = sessionsByDay.get(ed);
          const tag =
            workout != null
              ? activity != null
                ? `${workout}+`
                : workout
              : activity
              ? activity.slice(0, 3).toUpperCase()
              : rested
              ? 'REST'
              : '';
          const hasSessions = !!daySessions && daySessions.length > 0;
          const clickable = hasSessions || (isToday && canLogToday);
          return (
            <button
              key={i}
              className={`cal-cell ${done ? 'done' : ''} ${rested ? 'rested' : ''} ${isToday && !done && !rested ? 'today' : ''}`}
              disabled={!clickable}
              style={{ cursor: clickable ? 'pointer' : 'default' }}
              aria-label={`${MONTH_NAMES[month]} ${d}${tag ? `, ${tag}` : ''}`}
              onClick={() => {
                if (hasSessions) onDaySessions(ed, `${MONTH_NAMES[month]} ${d}`);
                else onToday();
              }}
            >
              <span>{d}</span>
              {tag && <span className="tag">{tag}</span>}
            </button>
          );
        })}
      </div>
      <div className="row gap-16 mt-12 wrap">
        <span className="row gap-6 body-small muted"><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--accent-primary)' }} /> Completed</span>
        <span className="row gap-6 body-small muted"><span style={{ width: 10, height: 10, borderRadius: 999, border: '2px solid var(--accent-primary)' }} /> Today</span>
        <span className="row gap-6 body-small muted"><span style={{ width: 10, height: 10, borderRadius: 999, background: 'var(--surface3)' }} /> Rest</span>
        <span className="row gap-6 body-small muted">
          <span
            className="tag"
            style={{
              position: 'static',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2px 5px',
              borderRadius: 4,
              background: 'var(--accent-primary)',
              color: 'var(--on-accent)',
            }}
          >
            RUN
          </span>
          Activity
        </span>
      </div>
    </div>
  );
}

/** Minutes as typed: digits and one decimal place ("30.5"), never a dropped point ("305"). */
function cleanMinutes(raw: string): string {
  const [whole, ...rest] = raw.replace(/[^\d.]/g, '').split('.');
  return rest.length ? `${whole.slice(0, 4)}.${rest.join('').slice(0, 1)}` : whole.slice(0, 4);
}

/** Distance as typed: up to two decimals. */
function cleanDistance(raw: string): string {
  const [whole, ...rest] = raw.replace(/[^\d.]/g, '').split('.');
  return rest.length ? `${whole.slice(0, 3)}.${rest.join('').slice(0, 2)}` : whole.slice(0, 3);
}

function LogActivityDialog({
  unit,
  hasNextDay,
  nextDayLabel,
  onClose,
  onSave,
}: {
  unit: Units;
  hasNextDay: boolean;
  nextDayLabel: string | null;
  onClose: () => void;
  onSave: (a: { activityType: string; durationMin: number | null; distanceKm: number | null; notes: string | null; countAsToday: boolean }) => void;
}) {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('');
  const [distance, setDistance] = useState('');
  const [notes, setNotes] = useState('');
  const [countAsToday, setCountAsToday] = useState(false);
  const showDistance = wantsDistance(name);
  const km = showDistance && Number(distance) > 0 ? displayToKm(Number(distance), unit) : null;
  const durationMin = Number(duration) > 0 ? Math.round(Number(duration) * 10) / 10 : null;
  const pace = formatPace(durationMin, km, unit);

  return (
    <Dialog onClose={onClose}>
      <div className="headline-small mb-16">Log activity</div>
      <div className="row wrap gap-6 mb-16">
        {ACTIVITY_CHIPS.map((c) => (
          <button key={c} className={`chip ${name === c ? 'selected' : ''}`} onClick={() => setName(c)}>{c}</button>
        ))}
      </div>
      <input className="field mb-12" placeholder="Activity name" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="row gap-8 mb-12">
        <input
          className="field"
          placeholder="Duration (min)"
          inputMode="decimal"
          value={duration}
          onChange={(e) => setDuration(cleanMinutes(e.target.value))}
        />
        {showDistance && (
          <input
            className="field"
            placeholder={`Distance (${distanceUnit(unit)})`}
            inputMode="decimal"
            value={distance}
            onChange={(e) => setDistance(cleanDistance(e.target.value))}
          />
        )}
      </div>
      {pace && <p className="body-small muted" style={{ margin: '-4px 0 12px' }}>Pace {pace}</p>}
      <textarea className="field mb-12" placeholder="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
      {hasNextDay && (
        <>
          <button className="row-between mb-16" style={{ width: '100%', background: 'none', border: 'none', color: 'var(--fg)' }} onClick={() => setCountAsToday((v) => !v)}>
            <span className="label-medium">COUNT AS TODAY'S WORKOUT</span>
            <span className={`switch ${countAsToday ? 'on' : ''}`}><span /></span>
          </button>
          {nextDayLabel && (
            <p className="body-small muted" style={{ margin: '-8px 0 16px' }}>Marks {nextDayLabel} as done in your rotation.</p>
          )}
        </>
      )}
      <div className="dialog-actions">
        <GhostCta onClick={onClose}>Cancel</GhostCta>
        <BigCta
          style={{ minHeight: 52 }}
          disabled={!name.trim()}
          onClick={() => onSave({
            activityType: name.trim(),
            durationMin,
            distanceKm: km,
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

function DaySessionsSheet({
  ed,
  label,
  onClose,
}: {
  ed: number;
  label: string;
  onClose: () => void;
}) {
  const navigate = useNavigate();
  const state = useStore();
  const deleteSession = useStore((s) => s.deleteSession);
  const unit = state.prefs.units;
  const sessions = sessionsByEpochDay(state).get(ed) ?? [];
  const ctx = statsCtx(state);

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">{label}</div>
      <div className="stack gap-8">
        {sessions.length === 0 && <div className="body-small muted">Nothing logged.</div>}
        {sessions.map((s: Session) => {
          const time = s.completedAt != null
            ? new Date(s.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : '';
          const open = () => { onClose(); navigate(`/session/${s.id}`); };

          if (s.notes === REST_SESSION_NOTE) {
            const wd = s.workoutDayId ? state.workoutDays[s.workoutDayId] : null;
            return (
              <div key={s.id} className="card row-between" style={{ padding: 14 }}>
                <div className="stack">
                  <span className="title-small">Rest day</span>
                  {wd && <span className="body-small muted">{wd.name}</span>}
                </div>
                <button className="icon-btn bare" style={{ color: 'var(--coral)' }} aria-label="Remove rest day" onClick={() => deleteSession(s.id)}>
                  <Trash size={16} />
                </button>
              </div>
            );
          }

          // Imported workouts carry sets but no routine day; show them as workouts too.
          const logs = sessionLogs(state, s.id);
          if (!s.activityType && (s.workoutDayId != null || logs.length > 0)) {
            const wd = s.workoutDayId ? state.workoutDays[s.workoutDayId] : null;
            const vol = Math.round(kgToDisplay(volumeKg(logs, ctx), unit));
            return (
              <button key={s.id} className="card row-between" style={{ padding: 14, color: 'var(--fg)', textAlign: 'left' }} onClick={open}>
                <div className="stack min0">
                  <span className="title-small">{wd?.name ?? s.notes ?? 'Workout'}</span>
                  <span className="body-small muted">{plural(logs.length, 'set')} · {vol.toLocaleString()} {unit} · {time}</span>
                </div>
                <ChevronRight size={18} className="muted" />
              </button>
            );
          }

          const bits = [
            s.durationMin ? formatMinutes(s.durationMin) : null,
            s.distanceKm ? formatDistance(s.distanceKm, unit) : null,
            formatPace(s.durationMin, s.distanceKm, unit),
            time,
          ].filter(Boolean);
          return (
            <button key={s.id} className="card row-between" style={{ padding: 14, color: 'var(--fg)', textAlign: 'left' }} onClick={open}>
              <div className="stack min0">
                <span className="title-small">{s.activityType ?? 'Activity'}</span>
                <span className="body-small muted">{bits.join(' · ')}</span>
                {s.notes && <span className="body-small muted ellipsis">{s.notes}</span>}
              </div>
              <ChevronRight size={18} className="muted" />
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
