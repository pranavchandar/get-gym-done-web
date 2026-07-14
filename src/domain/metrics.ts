import type { Session, SetLog } from '../types';
import { REST_SESSION_NOTE } from '../types';

/** Completed sessions (completedAt != null), ascending by completedAt. */
export function completedSessions(sessions: Session[]): Session[] {
  return sessions
    .filter((s) => s.completedAt != null)
    .sort((a, b) => (a.completedAt as number) - (b.completedAt as number));
}

export function totalVolumeKg(setLogs: SetLog[]): number {
  let sum = 0;
  for (const s of setLogs) sum += s.weightKg * s.reps;
  return sum;
}

/** A "training" session is a completed session that is not a rest log. */
export function isTrainingSession(s: Session): boolean {
  return s.completedAt != null && s.notes !== REST_SESSION_NOTE;
}

/** Compact number format: 1.2M / 3.4k / plain int. */
export function compactNumber(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return trimTrailing(n / 1_000_000) + 'M';
  if (abs >= 1_000) return trimTrailing(n / 1_000) + 'k';
  return String(Math.round(n));
}

function trimTrailing(v: number): string {
  const r = Math.round(v * 10) / 10;
  return Number.isInteger(r) ? String(r) : r.toFixed(1);
}

/** Max top-set weight of an exercise within a set of logs. */
export function maxWeight(logs: SetLog[]): number {
  let m = 0;
  for (const l of logs) if (l.weightKg > m) m = l.weightKg;
  return m;
}

/**
 * Number of exercises in `sessionLogs` whose max weight beats every prior session's
 * max for that exercise. priorLogsByExercise = all logs from strictly earlier
 * completed sessions, grouped by exerciseId.
 */
export function countPRs(
  sessionLogs: SetLog[],
  priorMaxByExercise: Map<string, number>,
): number {
  const thisMax = new Map<string, number>();
  for (const l of sessionLogs) {
    thisMax.set(l.exerciseId, Math.max(thisMax.get(l.exerciseId) ?? 0, l.weightKg));
  }
  let count = 0;
  for (const [exId, w] of thisMax) {
    const prior = priorMaxByExercise.get(exId);
    if (w > 0 && (prior == null || w > prior)) count++;
  }
  return count;
}
