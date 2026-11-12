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

/** Rough session duration: each set ≈ rest interval + ~40s of lifting. */
export function estimateDurationMin(totalSets: number, restSeconds: number): number {
  if (totalSets <= 0) return 0;
  return Math.max(5, Math.round((totalSets * (restSeconds + 40)) / 60));
}
