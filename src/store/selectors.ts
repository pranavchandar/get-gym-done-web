import type { StoreData } from './store';
import type { WorkoutDay, Split, Exercise, SetLog, Session, BodyMetric } from '../types';
import { nextWorkoutDay } from '../domain/rotation';
import { epochDayLocal } from '../domain/dates';

export function activeSplit(s: StoreData): Split | null {
  return s.prefs.activeSplitId ? s.splits[s.prefs.activeSplitId] ?? null : null;
}

export function daysOf(s: StoreData, splitId: string | null): WorkoutDay[] {
  if (!splitId) return [];
  return Object.values(s.workoutDays)
    .filter((d) => d.splitId === splitId)
    .sort((a, b) => a.dayNumber - b.dayNumber);
}

export function activeDays(s: StoreData): WorkoutDay[] {
  return daysOf(s, s.prefs.activeSplitId);
}

export function exercise(s: StoreData, id: string): Exercise | undefined {
  return s.exercises[id];
}

export function dayExercisesOf(s: StoreData, dayId: string) {
  return Object.values(s.dayExercises)
    .filter((d) => d.workoutDayId === dayId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}

export function sessionLogs(s: StoreData, sessionId: string): SetLog[] {
  return Object.values(s.setLogs).filter((l) => l.sessionId === sessionId);
}

export function allCompletedSessions(s: StoreData): Session[] {
  return Object.values(s.sessions)
    .filter((se) => se.completedAt != null)
    .sort((a, b) => (a.completedAt as number) - (b.completedAt as number));
}

/** Last completed session (with a day in the active split) day number → drives rotation. */
export function lastCompletedDayNumber(s: StoreData): number | null {
  const days = activeDays(s);
  const dayIds = new Set(days.map((d) => d.id));
  let best: Session | null = null;
  for (const se of Object.values(s.sessions)) {
    if (se.completedAt == null || se.workoutDayId == null) continue;
    if (!dayIds.has(se.workoutDayId)) continue;
    if (!best || (se.completedAt as number) > (best.completedAt as number)) best = se;
  }
  if (!best || best.workoutDayId == null) return null;
  return s.workoutDays[best.workoutDayId]?.dayNumber ?? null;
}

export function nextDay(s: StoreData): WorkoutDay | null {
  return nextWorkoutDay(activeDays(s), lastCompletedDayNumber(s));
}

/** Completed set-log history of one exercise (completed sessions only). */
export function completedHistoryForExercise(s: StoreData, exerciseId: string): SetLog[] {
  const completedIds = new Set(
    Object.values(s.sessions).filter((se) => se.completedAt != null).map((se) => se.id),
  );
  return Object.values(s.setLogs).filter((l) => l.exerciseId === exerciseId && completedIds.has(l.sessionId));
}

/** Logs from the most recent completed session that recorded this exercise. */
export function lastCompletedLogsForExercise(s: StoreData, exerciseId: string): SetLog[] {
  const bySession = new Map<string, SetLog[]>();
  const completed = new Map<string, number>();
  for (const se of Object.values(s.sessions)) {
    if (se.completedAt != null) completed.set(se.id, se.completedAt);
  }
  for (const l of Object.values(s.setLogs)) {
    if (l.exerciseId !== exerciseId) continue;
    if (!completed.has(l.sessionId)) continue;
    const arr = bySession.get(l.sessionId);
    if (arr) arr.push(l);
    else bySession.set(l.sessionId, [l]);
  }
  let bestId: string | null = null;
  let bestAt = -Infinity;
  for (const id of bySession.keys()) {
    const at = completed.get(id) ?? 0;
    if (at > bestAt) {
      bestAt = at;
      bestId = id;
    }
  }
  if (!bestId) return [];
  return (bySession.get(bestId) ?? []).sort((a, b) => a.setNumber - b.setNumber);
}

export function customSplits(s: StoreData): Split[] {
  return Object.values(s.splits).filter((sp) => sp.isCustom);
}

export function completedCountForDay(s: StoreData, dayId: string): number {
  return Object.values(s.sessions).filter(
    (se) => se.workoutDayId === dayId && se.completedAt != null && se.notes !== 'rest',
  ).length;
}

export function bodyMetricsSorted(s: StoreData): BodyMetric[] {
  return Object.values(s.bodyMetrics).sort((a, b) => a.recordedAt - b.recordedAt);
}

/** epoch-day -> day number trained (completed sessions with a workoutDayId). */
export function completedByEpochDay(s: StoreData): Map<number, number> {
  const map = new Map<number, number>();
  for (const se of Object.values(s.sessions)) {
    if (se.completedAt == null || se.workoutDayId == null) continue;
    const wd = s.workoutDays[se.workoutDayId];
    if (!wd) continue;
    map.set(epochDayLocal(se.completedAt), wd.dayNumber);
  }
  return map;
}

/** epoch-day -> activity type for day-less activity logs. */
export function activityByEpochDay(s: StoreData): Map<number, string> {
  const map = new Map<number, string>();
  for (const se of Object.values(s.sessions)) {
    if (se.completedAt == null || se.workoutDayId != null) continue;
    if (se.notes === 'rest') continue;
    map.set(epochDayLocal(se.completedAt), se.activityType ?? 'Activity');
  }
  return map;
}
