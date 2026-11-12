import type { Session, UserPrefs, WorkoutDay } from '../types';
import { REST_SESSION_NOTE } from '../types';
import { epochDayLocal } from './dates';

// Streaks count weeks, not days: a lifter on a 4-day plan who takes their planned rest
// days is on track, and a day-by-day streak told them "Streak lost" every rest day.
// A week counts when it holds at least `target` training days.

/** Weekday of a local epoch-day, 0 = Sunday (epoch-day 0 was a Thursday). */
export const weekdayOf = (ed: number) => (((ed + 4) % 7) + 7) % 7;
/** First day (Sunday) of the week holding `ed` — the calendar's weeks. */
export const weekStartOf = (ed: number) => ed - weekdayOf(ed);

/** Whether a completed session is training: anything but a rest-day log. */
export function isTrainingDay(s: Session, workoutDays: Record<string, WorkoutDay>): boolean {
  if (s.completedAt == null || s.notes === REST_SESSION_NOTE) return false;
  if (s.workoutDayId != null && workoutDays[s.workoutDayId]?.isRestDay && !s.activityType) return false;
  return true;
}

/** Local epoch-days with a workout (routine or imported) or an activity. */
export function trainingEpochDays(sessions: Record<string, Session>, workoutDays: Record<string, WorkoutDay>, today?: number): Set<number> {
  const set = new Set<number>();
  for (const s of Object.values(sessions)) {
    if (!isTrainingDay(s, workoutDays)) continue;
    const ed = epochDayLocal(s.completedAt as number);
    if (today != null && ed > today) continue; // future-dated (clock skew, imports from ahead)
    set.add(ed);
  }
  return set;
}

/** Training days a week the streak asks for: the user's choice, else what the routine implies. */
export function weeklyTargetFor(prefs: Pick<UserPrefs, 'weeklyTarget' | 'trainingWeekdays'>, days: WorkoutDay[]): number {
  if (prefs.weeklyTarget != null && prefs.weeklyTarget >= 1) return Math.min(7, Math.round(prefs.weeklyTarget));
  if (prefs.trainingWeekdays && prefs.trainingWeekdays.length) return prefs.trainingWeekdays.length;
  const cycle = days.length;
  const trainable = days.filter((d) => !d.isRestDay).length;
  if (!cycle || !trainable) return 3;
  // A 7-day cycle maps straight onto a week; shorter or longer cycles are scaled to one.
  return Math.max(1, Math.min(7, cycle >= 7 ? Math.round((trainable * 7) / cycle) : trainable));
}

export interface WeekStreak {
  /** consecutive weeks that hit the target, counting this week once it is hit */
  current: number;
  longest: number;
  /** training days so far this week */
  thisWeek: number;
  target: number;
  /** last week missed and this week isn't there yet (with some history before) */
  lost: boolean;
}

export function weekStreak(trainingDays: Set<number>, target: number, today: number): WeekStreak {
  const perWeek = new Map<number, number>();
  for (const ed of trainingDays) {
    const ws = weekStartOf(ed);
    perWeek.set(ws, (perWeek.get(ws) ?? 0) + 1);
  }
  const thisWs = weekStartOf(today);
  const hit = (ws: number) => (perWeek.get(ws) ?? 0) >= target;
  const thisWeek = perWeek.get(thisWs) ?? 0;

  let current = 0;
  let ws = hit(thisWs) ? thisWs : thisWs - 7; // an unfinished week doesn't break the streak
  while (hit(ws)) {
    current++;
    ws -= 7;
  }

  let longest = 0;
  if (perWeek.size) {
    const first = Math.min(...perWeek.keys());
    let run = 0;
    for (let w = first; w <= thisWs; w += 7) {
      if (hit(w)) {
        run++;
        longest = Math.max(longest, run);
      } else if (w !== thisWs) run = 0;
    }
  }
  const hasHistory = [...perWeek.keys()].some((w) => w < thisWs);
  return { current, longest, thisWeek, target, lost: current === 0 && hasHistory };
}

export type TodayPlan =
  | { kind: 'trained' }
  | { kind: 'rest'; reason: 'schedule' | 'rotation'; nextTrainingWeekday: number | null }
  | { kind: 'train' };

/**
 * What today is for. Rest days are never logged automatically any more: a rest day is just
 * a day without training, and the rotation's rest days are "used up" by days passing.
 *
 * - trained already today → trained;
 * - with fixed training weekdays, any other weekday is a rest day;
 * - otherwise a rotation rest day applies only right after the workout before it: the
 *   rest is taken by the days that have passed since, so a lifter who comes back after a
 *   few days off is offered their next workout, not told to rest.
 */
export function todayPlan(args: {
  today: number;
  trainedToday: boolean;
  /** local epoch-day of the last completed routine workout */
  lastRoutineEd: number | null;
  /** consecutive rest days in the rotation right after the last routine workout */
  restRun: number;
  weekdays: number[] | null | undefined;
}): TodayPlan {
  const { today, trainedToday, lastRoutineEd, restRun, weekdays } = args;
  if (trainedToday) return { kind: 'trained' };
  if (weekdays && weekdays.length) {
    const wd = weekdayOf(today);
    if (weekdays.includes(wd)) return { kind: 'train' };
    let next: number | null = null;
    for (let i = 1; i <= 7; i++) {
      if (weekdays.includes((wd + i) % 7)) {
        next = (wd + i) % 7;
        break;
      }
    }
    return { kind: 'rest', reason: 'schedule', nextTrainingWeekday: next };
  }
  if (restRun > 0 && lastRoutineEd != null && today - lastRoutineEd <= restRun) {
    return { kind: 'rest', reason: 'rotation', nextTrainingWeekday: null };
  }
  return { kind: 'train' };
}

/** Rest days in the rotation right after day `lastDayNumber` (wrapping around). */
export function restRunAfter(days: WorkoutDay[], lastDayNumber: number | null): number {
  if (lastDayNumber == null || !days.length) return 0;
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const idx = sorted.findIndex((d) => d.dayNumber === lastDayNumber);
  if (idx < 0) return 0;
  let run = 0;
  for (let i = 1; i < sorted.length; i++) {
    const d = sorted[(idx + i) % sorted.length];
    if (!d.isRestDay) break;
    run++;
  }
  return run;
}
