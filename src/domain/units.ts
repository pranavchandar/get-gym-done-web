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

/** The progression increment expressed in kg (2.5kg or 5lb worth of kg). */
export function incrementKgFor(unit: Units): number {
  return displayToKg(displayStep(unit), unit);
}

/** Round a display value to a sensible precision for the unit. */
export function roundDisplay(value: number, unit: Units): number {
  return unit === 'lbs' ? Math.round(value * 2) / 2 : Math.round(value * 100) / 100;
}

/** Default prefill weight in display units — snapped to the unit's plate grid. */
export function defaultStartDisplayWeight(unit: Units): number {
  return unit === 'lbs' ? 45 : 20;
}

/** Format a weight (stored kg) for display, trimming trailing zeros. */
export function formatWeight(kg: number, unit: Units): string {
  const v = roundDisplay(kgToDisplay(kg, unit), unit);
  if (Number.isInteger(v)) return String(v);
  return String(parseFloat(v.toFixed(2)));
}

export function unitLabel(unit: Units): string {
  return unit;
}
