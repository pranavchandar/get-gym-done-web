import type { WorkoutDay } from '../types';

/** Raw next day number in sequence, ignoring rest days. */
export function nextDayNumber(lastCompletedDayNumber: number | null, count: number): number {
  if (count <= 0) return 1;
  if (lastCompletedDayNumber == null) return 1;
  return (lastCompletedDayNumber % count) + 1;
}

function lowestTrainable(trainable: WorkoutDay[]): WorkoutDay {
  return trainable.reduce((a, b) => (b.dayNumber < a.dayNumber ? b : a));
}

/**
 * The next trainable (non-rest) day given the last completed day number.
 * Skips rest days, wraps around, falls back to the lowest-numbered trainable day.
 */
export function nextWorkoutDay(
  days: WorkoutDay[],
  lastCompletedDayNumber: number | null,
): WorkoutDay | null {
  const trainable = days.filter((d) => !d.isRestDay);
  if (trainable.length === 0) return null;
  const maxNumber = Math.max(...days.map((d) => d.dayNumber));
  if (lastCompletedDayNumber == null) {
    return lowestTrainable(trainable);
  }
  let n = lastCompletedDayNumber;
  for (let step = 0; step < maxNumber; step++) {
    n = (n % maxNumber) + 1;
    const day = days.find((d) => d.dayNumber === n);
    if (day && !day.isRestDay) return day;
  }
  return lowestTrainable(trainable);
}

/**
 * Longest cyclic run of rest days. Duplicates the flag list to handle wrap-around.
 * 0 if no rest days; n (cycle length) if every day is a rest day.
 */
export function maxConsecutiveRestDays(days: WorkoutDay[]): number {
  const sorted = [...days].sort((a, b) => a.dayNumber - b.dayNumber);
  const flags = sorted.map((d) => d.isRestDay);
  const n = flags.length;
  if (n === 0) return 0;
  if (flags.every((f) => f)) return n;
  const doubled = flags.concat(flags);
  let max = 0;
  let run = 0;
  for (const f of doubled) {
    if (f) {
      run++;
      if (run > max) max = run;
    } else {
      run = 0;
    }
  }
  return Math.min(max, n);
}
