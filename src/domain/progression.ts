import type { Exercise, SetLog, Units } from '../types';
import { displayToKg } from './units';
import { isWarmup, loadKind } from './stats';
import { epochDayLocal } from './dates';

/** After this many days away from an exercise, suggest easing back in rather than adding weight. */
export const LAYOFF_DAYS = 14;
const EPS = 1e-3;
const LOWER_BODY = new Set(['Quads', 'Hamstrings', 'Glutes', 'Posterior Chain', 'Adductors', 'Abductors']);

/**
 * The smallest sensible jump for an exercise, in display units: what you'd actually add
 * at the gym. Bigger for lower-body barbell lifts and machine stacks, kettlebells go up a
 * bell at a time.
 */
export function incrementDisplay(ex: Pick<Exercise, 'equipment' | 'primaryMuscle'> | undefined, unit: Units): number {
  const lbs = unit === 'lbs';
  const eq = ex?.equipment ?? '';
  if (eq === 'Kettlebell') return lbs ? 10 : 4;
  if (eq === 'Dumbbell') return lbs ? 5 : 2;
  if (eq === 'Machine') return lbs ? 10 : 5;
  if ((eq === 'Barbell' || eq === 'Trap Bar') && LOWER_BODY.has(ex?.primaryMuscle ?? '')) return lbs ? 10 : 5;
  return lbs ? 5 : 2.5;
}

export interface Suggestion {
  /** bump: add weight; ease: back off after time away */
  kind: 'bump' | 'ease';
  /** top working weight of the last session (kg; for bodyweight moves the added load) */
  currentWeightKg: number;
  /** lowest reps across the qualifying sets */
  reps: number;
  suggestedWeightKg: number;
  /** days since the exercise was last done */
  daysOff: number;
}

/**
 * Double progression. history = every set of ONE exercise from completed sessions.
 *
 * - bump when, in the latest session, every working set at the top weight reached the top
 *   of the rep range, and that is backed up by either two or more such sets or the session
 *   before doing the same;
 * - ease (about 10% lighter) when the exercise hasn't been done for LAYOFF_DAYS;
 * - nothing for bands and timed holds, or bodyweight moves done without added weight.
 */
export function progressionAdvice(
  history: SetLog[],
  ex: Pick<Exercise, 'equipment' | 'primaryMuscle' | 'timed'> | undefined,
  repsHigh: number,
  unit: Units,
  now = Date.now(),
): Suggestion | null {
  const kind = loadKind(ex);
  if (kind === 'band' || kind === 'time') return null;
  const work = history.filter((l) => !isWarmup(l));
  if (!work.length) return null;

  const groups = new Map<string, SetLog[]>();
  for (const l of work) {
    const arr = groups.get(l.sessionId);
    if (arr) arr.push(l);
    else groups.set(l.sessionId, [l]);
  }
  const sessions = [...groups.values()]
    .map((logs) => ({ logs, at: Math.max(...logs.map((l) => l.completedAt)) }))
    .sort((a, b) => b.at - a.at);

  const latest = sessions[0];
  const top = Math.max(...latest.logs.map((l) => l.weightKg));
  if (kind === 'bodyweight' && top <= EPS) return null;
  if (top <= EPS) return null;

  const step = displayToKg(incrementDisplay(ex, unit), unit);
  const daysOff = epochDayLocal(now) - epochDayLocal(latest.at);
  if (daysOff >= LAYOFF_DAYS) {
    const eased = Math.max(0, Math.round((top * 0.9) / step) * step);
    if (eased >= top - EPS) return null;
    return { kind: 'ease', currentWeightKg: top, reps: Math.min(...latest.logs.map((l) => l.reps)), suggestedWeightKg: eased, daysOff };
  }

  const threshold = Math.max(repsHigh, 1);
  const qualifies = (logs: SetLog[], weight: number) => {
    const atTop = logs.filter((l) => Math.abs(l.weightKg - weight) < EPS);
    return atTop.length > 0 && atTop.every((l) => l.reps >= threshold) ? atTop : null;
  };
  const hit = qualifies(latest.logs, top);
  if (!hit) return null;
  const prev = sessions[1];
  const backedUp = hit.length >= 2 || (prev != null && qualifies(prev.logs, top) != null);
  if (!backedUp) return null;
  return {
    kind: 'bump',
    currentWeightKg: top,
    reps: Math.min(...hit.map((l) => l.reps)),
    suggestedWeightKg: top + step,
    daysOff,
  };
}

/** Plates per side to load `totalDisplay` on a standard bar, heaviest first; null if it can't be built. */
export function platesPerSide(totalDisplay: number, unit: Units): { bar: number; plates: number[]; exact: boolean } | null {
  const bar = unit === 'lbs' ? 45 : 20;
  const sizes = unit === 'lbs' ? [45, 35, 25, 10, 5, 2.5] : [25, 20, 15, 10, 5, 2.5, 1.25];
  if (totalDisplay < bar - 1e-6) return null;
  let side = (totalDisplay - bar) / 2;
  const plates: number[] = [];
  for (const p of sizes) {
    while (side >= p - 1e-6) {
      plates.push(p);
      side -= p;
    }
  }
  return { bar, plates, exact: side < 1e-3 };
}
