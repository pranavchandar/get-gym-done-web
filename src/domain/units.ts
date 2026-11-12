import type { Units } from '../types';

export const KG_PER_LB = 0.45359237;

export function parseUnit(raw: string | null | undefined): Units {
  return (raw ?? '').toLowerCase() === 'lbs' ? 'lbs' : 'kg';
}

export function kgToDisplay(kg: number, unit: Units): number {
  return unit === 'lbs' ? kg / KG_PER_LB : kg;
}

export function displayToKg(value: number, unit: Units): number {
  return unit === 'lbs' ? value * KG_PER_LB : value;
}

export function displayStep(unit: Units): number {
  return unit === 'lbs' ? 5.0 : 2.5;
}

/** Round a display value to a sensible precision for the unit. */
export function roundDisplay(value: number, unit: Units): number {
  // lbs to 0.1, not the 0.5 plate grid: a 218.4 lb weigh-in must read 218.4, and a typed
  // weight is kept as typed.
  return unit === 'lbs' ? Math.round(value * 10) / 10 : Math.round(value * 100) / 100;
}

const BAR_EQUIPMENT = new Set(['Barbell', 'EZ Bar', 'Trap Bar', 'Smith Machine', 'T-Bar']);

/**
 * Starting weight (display units) for an exercise with no history at all: the empty bar
 * for bar lifts, light dumbbells, a light stack on cables and machines, and nothing for
 * bodyweight, bands and the rest. Only set 1 ever sees it: later sets copy what you log.
 */
export function defaultStartDisplayWeight(unit: Units, equipment: string): number {
  const lbs = unit === 'lbs';
  if (BAR_EQUIPMENT.has(equipment)) return lbs ? 45 : 20;
  if (equipment === 'Dumbbell' || equipment === 'Kettlebell') return lbs ? 15 : 8;
  if (equipment === 'Cable' || equipment === 'Machine') return lbs ? 20 : 10;
  return 0;
}

/** Format a weight (stored kg) for display, trimming trailing zeros. */
export function formatWeight(kg: number, unit: Units): string {
  const v = roundDisplay(kgToDisplay(kg, unit), unit);
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toFixed(2)));
}

/** One decimal at most: a stat pill is a third of a phone's width. */
export function pillNumber(v: number): string {
  return String(Math.round(v * 10) / 10);
}

export function unitLabel(unit: Units): string {
  return unit;
}

export const KM_PER_MI = 1.609344;
/** Distances follow the weight unit: lbs → miles, kg → kilometres. */
export const distanceUnit = (unit: Units) => (unit === 'lbs' ? 'mi' : 'km');
export const kmToDisplay = (km: number, unit: Units) => (unit === 'lbs' ? km / KM_PER_MI : km);
export const displayToKm = (v: number, unit: Units) => (unit === 'lbs' ? v * KM_PER_MI : v);

/** "8:30 /mi" from minutes and a distance in km, or null without both. */
export function formatPace(durationMin: number | null | undefined, km: number | null | undefined, unit: Units): string | null {
  if (!durationMin || !km || km <= 0) return null;
  const perUnit = durationMin / kmToDisplay(km, unit);
  const m = Math.floor(perUnit);
  const s = Math.round((perUnit - m) * 60);
  return `${s === 60 ? m + 1 : m}:${String(s === 60 ? 0 : s).padStart(2, '0')} /${distanceUnit(unit)}`;
}

export function formatDistance(km: number, unit: Units): string {
  const v = kmToDisplay(km, unit);
  return `${Math.round(v * 100) / 100} ${distanceUnit(unit)}`;
}
