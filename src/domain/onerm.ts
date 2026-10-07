import type { SetLog } from '../types';

// Estimated one-rep max, Epley: w · (1 + r/30). All the common estimators agree at low
// reps and diverge as reps climb, so past REP_CAP we refuse to guess rather than print
// a number that measures work capacity instead of strength.

export const REP_CAP = 12;

/** Estimated 1RM (kg) from one set, or null when the set can't support an estimate. */
export function estimate1RM(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps)) return null;
  if (weightKg <= 0 || reps < 1 || reps > REP_CAP) return null;
  const r = Math.round(reps);
  // A single is the measurement, not an estimate.
  const est = r === 1 ? weightKg : weightKg * (1 + r / 30);
  return Math.round(est * 10) / 10;
}

/** Weight (kg) you'd expect to move for `reps` given a 1RM — inverse Epley. */
export function weightForReps(oneRmKg: number, reps: number): number {
  if (reps <= 1) return oneRmKg;
  return oneRmKg / (1 + reps / 30);
}

export interface BestSet {
  est: number;
  weightKg: number;
  reps: number;
  at: number;
}

/** The set among `logs` with the highest estimate — names the set it came from. */
export function bestSetOf(logs: SetLog[]): BestSet | null {
  let best: BestSet | null = null;
  for (const l of logs) {
    const est = estimate1RM(l.weightKg, l.reps);
    if (est != null && (!best || est > best.est)) {
      best = { est, weightKg: l.weightKg, reps: Math.round(l.reps), at: l.completedAt };
    }
  }
  return best;
}
