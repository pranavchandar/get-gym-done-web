import type { SetLog } from '../types';

export interface WeightSuggestion {
  /** The weight (kg) you hit across the recent sessions. */
  currentWeightKg: number;
  /** Lowest reps hit in the qualifying bucket. */
  reps: number;
  /** Suggested next weight (kg) = currentWeightKg + incrementKg. */
  suggestedWeightKg: number;
}

/**
 * Progression advice. history = every completed SetLog of ONE exercise (completed
 * sessions only, excluding the in-progress one).
 *
 * Group by sessionId, order groups by max(completedAt) desc, take `sessions` most
 * recent. Need at least `sessions` groups. Bucket by setNumber across those sessions;
 * a bucket qualifies if it appears in every session, all weights equal (±1e-3) and all
 * reps >= max(repsHigh, 1). Pick the heaviest qualifying weight; reps reported = min
 * reps in that bucket. Suggest weight + incrementKg. null if nothing qualifies.
 */
export function weightIncreaseSuggestion(
  history: SetLog[],
  repsHigh: number,
  incrementKg: number,
  sessions = 2,
): WeightSuggestion | null {
  if (history.length === 0) return null;

  const groups = new Map<string, SetLog[]>();
  for (const log of history) {
    const arr = groups.get(log.sessionId);
    if (arr) arr.push(log);
    else groups.set(log.sessionId, [log]);
  }

  const groupList = [...groups.values()]
    .map((logs) => ({ logs, maxAt: Math.max(...logs.map((l) => l.completedAt)) }))
    .sort((a, b) => b.maxAt - a.maxAt);

  if (groupList.length < sessions) return null;

  const recent = groupList.slice(0, sessions);
  const threshold = Math.max(repsHigh, 1);

  const setNumbers = new Set<number>();
  for (const g of recent) for (const l of g.logs) setNumbers.add(l.setNumber);

  let bestWeight = Number.NEGATIVE_INFINITY;
  let bestReps = 0;

  for (const setNum of setNumbers) {
    const perSession = recent.map((g) => g.logs.filter((l) => l.setNumber === setNum));
    // A set position missing from any session is ignored entirely.
    if (perSession.some((arr) => arr.length === 0)) continue;
    const all = perSession.flat();
    const w0 = all[0].weightKg;
    if (!all.every((l) => Math.abs(l.weightKg - w0) < 1e-3)) continue;
    if (!all.every((l) => l.reps >= threshold)) continue;
    if (w0 > bestWeight) {
      bestWeight = w0;
      bestReps = Math.min(...all.map((l) => l.reps));
    }
  }

  if (bestWeight === Number.NEGATIVE_INFINITY) return null;
  return {
    currentWeightKg: bestWeight,
    reps: bestReps,
    suggestedWeightKg: bestWeight + incrementKg,
  };
}
