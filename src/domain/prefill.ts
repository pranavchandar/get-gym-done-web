import type { SetLog } from '../types';

const EPS = 1e-6;

/**
 * What to pre-fill for set `setNumber` of an exercise, or null when there is nothing to
 * go on yet (a brand-new exercise before its first set).
 *
 * - A set done before fills from last session's same set: a warm-up ramp logs itself.
 * - If the set just before it in this workout was logged at a different weight than last
 *   time, that change carries forward: straight sets copy the new weight; a ramp or
 *   back-offs shift by the same amount (top set +10 → back-offs +10).
 * - A set with no history copies the set just logged in this workout.
 *
 * `current` = this workout's logged sets of the exercise; `previous` = the sets of its
 * last completed workout.
 */
export function prefillSet(
  setNumber: number,
  current: SetLog[],
  previous: SetLog[],
): { weightKg: number; reps: number } | null {
  const bySet = (a: SetLog, b: SetLog) => a.setNumber - b.setNumber;
  const history = (n: number) => previous.find((l) => l.setNumber === n);
  const done = [...current].sort(bySet);
  const before = done.filter((l) => l.setNumber < setNumber).at(-1) ?? done.at(-1);

  const same = history(setNumber);
  if (same) {
    const beforeHistory = before ? history(before.setNumber) : undefined;
    if (before && beforeHistory && Math.abs(before.weightKg - beforeHistory.weightKg) > EPS) {
      const straight = Math.abs(same.weightKg - beforeHistory.weightKg) < EPS;
      const weightKg = straight
        ? before.weightKg
        : Math.max(0, same.weightKg + before.weightKg - beforeHistory.weightKg);
      return { weightKg, reps: same.reps };
    }
    return { weightKg: same.weightKg, reps: same.reps };
  }
  if (before) return { weightKg: before.weightKg, reps: before.reps };
  const last = [...previous].sort(bySet).at(-1);
  return last ? { weightKg: last.weightKg, reps: last.reps } : null;
}
