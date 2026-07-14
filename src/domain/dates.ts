/** Number of days since the Unix epoch for the LOCAL calendar date of `ts`. */
export function epochDayLocal(ts: number): number {
  const d = new Date(ts);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function todayEpochDay(now = Date.now()): number {
  return epochDayLocal(now);
}

/** Start-of-local-day millis for an epoch-day index. */
export function epochDayToMillis(epochDay: number): number {
  const utc = epochDay * 86400000;
  const d = new Date(utc);
  // Reconstruct a local Date from the UTC Y/M/D so we get local midnight.
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()).getTime();
}

export const WEEKDAY_SHORT = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
export const WEEKDAY_FULL = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];
export const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

export function formatDateShort(ts: number): string {
  const d = new Date(ts);
  return `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
}
