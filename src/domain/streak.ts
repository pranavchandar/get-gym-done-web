import type { Session } from '../types';
import { epochDayLocal, todayEpochDay } from './dates';

/**
 * Distinct local epoch-days of completed sessions, DESC. Days after `today` are
 * dropped: a future-dated session (clock skew, or a backup imported from a device
 * in a later timezone) would otherwise anchor the streak ahead of the real data
 * and hide the days that actually count.
 */
function completedEpochDaysDesc(sessions: Session[], today: number): number[] {
  const set = new Set<number>();
  for (const s of sessions) {
    if (s.completedAt == null) continue;
    const ed = epochDayLocal(s.completedAt);
    if (ed > today) continue;
    set.add(ed);
  }
  return [...set].sort((a, b) => b - a);
}

/**
 * Current streak in calendar days, bridging scheduled rest gaps up to maxRestGap.
 * Empty -> 0. Dead if today - mostRecent > maxRestGap + 1.
 */
export function currentStreakDays(
  sessions: Session[],
  maxRestGap: number,
  now = Date.now(),
): number {
  const today = todayEpochDay(now);
  const days = completedEpochDaysDesc(sessions, today);
  if (days.length === 0) return 0;
  const mostRecent = days[0];
  if (today - mostRecent > maxRestGap + 1) return 0;
  let streak = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = days[i - 1] - days[i];
    if (gap >= 1 && gap <= maxRestGap + 1) {
      streak += gap;
    } else {
      break;
    }
  }
  return streak;
}

/** Longest streak ever (never expires), same bridging walked ascending. */
export function longestStreakDays(
  sessions: Session[],
  maxRestGap: number,
  now = Date.now(),
): number {
  const days = completedEpochDaysDesc(sessions, todayEpochDay(now))
    .slice()
    .sort((a, b) => a - b);
  if (days.length === 0) return 0;
  let best = 1;
  let run = 1;
  for (let i = 1; i < days.length; i++) {
    const gap = days[i] - days[i - 1];
    if (gap >= 1 && gap <= maxRestGap + 1) {
      run += gap;
    } else {
      run = 1;
    }
    if (run > best) best = run;
  }
  return best;
}
