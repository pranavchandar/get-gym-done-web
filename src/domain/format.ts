import type { Exercise, SetLog, Units } from '../types';
import { BAND_LEVELS } from '../types';
import { formatWeight } from './units';
import { loadKind } from './stats';
import type { RecordHit } from './stats';

/** "1 set", "3 sets", "1 exercise" — never "1 sets". */
export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** Minutes as "45 min" / "1 h 5 min". */
export function formatMinutes(min: number): string {
  const m = Math.max(0, Math.round(min));
  if (m < 60) return `${m} min`;
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}

/** Seconds as "45 s" / "1:30". */
export function formatSeconds(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export function bandLabel(level: number | null | undefined): string {
  if (level == null || level < 1) return 'Band';
  return `${BAND_LEVELS[Math.min(BAND_LEVELS.length, Math.round(level)) - 1]} band`;
}

/**
 * The load part of a set as people say it: "135 lbs", "BW", "BW +25 lbs", "BW −20 lbs"
 * (assisted), "Medium band". Empty for timed holds.
 */
export function formatLoad(weightKg: number, ex: Pick<Exercise, 'equipment' | 'timed'> | undefined, unit: Units, band?: number | null): string {
  const kind = loadKind(ex);
  if (kind === 'time') {
    if (weightKg <= 0) return '';
    return ex?.equipment === 'Bodyweight' ? `+${formatWeight(weightKg, unit)} ${unit}` : `${formatWeight(weightKg, unit)} ${unit}`;
  }
  if (kind === 'band') return bandLabel(band);
  if (kind === 'bodyweight') {
    if (Math.abs(weightKg) < 1e-6) return 'BW';
    return weightKg > 0 ? `BW +${formatWeight(weightKg, unit)} ${unit}` : `BW −${formatWeight(-weightKg, unit)} ${unit}`;
  }
  return `${formatWeight(weightKg, unit)} ${unit}`;
}

/** A whole set: "135 lbs × 8", "BW × 12", "Medium band × 15", "45 s hold". */
export function formatSet(l: Pick<SetLog, 'weightKg' | 'reps' | 'band'>, ex: Pick<Exercise, 'equipment' | 'timed'> | undefined, unit: Units): string {
  if (ex?.timed) {
    const extra = formatLoad(l.weightKg, ex, unit);
    return `${formatSeconds(l.reps)} hold${extra ? ` · ${extra}` : ''}`;
  }
  return `${formatLoad(l.weightKg, ex, unit, l.band)} × ${l.reps}`;
}

/** One line per record: "Heaviest · 225 lbs × 5", "Rep record · 185 lbs × 9 (was 8)". */
export function describeRecord(r: RecordHit, ex: Pick<Exercise, 'equipment' | 'timed'> | undefined, unit: Units): string {
  switch (r.kind) {
    case 'weight':
      return `Heaviest · ${formatSet(r.log, ex, unit)}`;
    case 'reps':
      return `Rep record · ${formatSet(r.log, ex, unit)}${r.previous != null ? ` (was ${r.previous})` : ''}`;
    case 'e1rm':
      return `Est. 1RM · ${formatWeight(r.value, unit)} ${unit}${r.previous != null ? ` (was ${formatWeight(r.previous, unit)})` : ''}`;
    case 'time':
      return `Longest hold · ${formatSeconds(r.value)}${r.previous != null ? ` (was ${formatSeconds(r.previous)})` : ''}`;
  }
}

/** Activities where a distance means something. */
const DISTANCE_ACTIVITIES = new Set(['running', 'walking', 'cycling', 'swimming', 'hiking', 'rowing', 'run', 'walk', 'ride', 'swim', 'hike']);
export function wantsDistance(activity: string): boolean {
  return DISTANCE_ACTIVITIES.has(activity.trim().toLowerCase());
}
