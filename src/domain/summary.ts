import type { Session, SetLog } from '../types';
import type { StoreData } from '../store/store';
import { REST_SESSION_NOTE } from '../types';
import { statsCtx, volumeKg, workingSets, sessionRecords, logsBySession } from './stats';
import type { RecordHit, StatsCtx } from './stats';

export interface VolumeComparison {
  pct: number;
  /** the earlier session compared against */
  against: Session;
  /** exercises both sessions share — the only ones compared */
  shared: number;
}

export interface SessionSummary {
  session: Session;
  logs: SetLog[];
  workingSetCount: number;
  exerciseIds: string[];
  volumeKg: number;
  durationMin: number | null;
  comparison: VolumeComparison | null;
  records: RecordHit[];
}

/**
 * Minutes from starting to finishing. A workout opened well before its first set (at home,
 * on the commute) is timed from shortly before that set.
 */
export function sessionDurationMin(session: Session, logs: SetLog[]): number | null {
  if (session.completedAt == null) return null;
  if (session.activityType && session.durationMin) return session.durationMin;
  const firstSet = logs.length ? Math.min(...logs.map((l) => l.completedAt)) : null;
  const start = firstSet != null ? Math.max(session.startedAt, firstSet - 10 * 60000) : session.startedAt;
  const min = (session.completedAt - start) / 60000;
  return min >= 1 ? Math.round(min) : null;
}

/**
 * Volume change against the last comparable session: the previous time this routine day
 * was done, else the latest earlier workout sharing at least half the exercises. Only the
 * shared exercises are compared, so a swapped-out lift doesn't read as a 40% drop.
 */
export function compareVolume(
  session: Session,
  logs: SetLog[],
  sessions: Record<string, Session>,
  bySession: Map<string, SetLog[]>,
  ctx: StatsCtx,
): VolumeComparison | null {
  if (session.completedAt == null) return null;
  const mine = workingSets(logs);
  const exIds = new Set(mine.map((l) => l.exerciseId));
  if (!exIds.size) return null;
  const need = Math.max(1, Math.ceil(exIds.size / 2));
  const earlier = Object.values(sessions)
    .filter((o) => o.id !== session.id && o.completedAt != null && o.completedAt < (session.completedAt as number) && o.notes !== REST_SESSION_NOTE)
    .sort((a, b) => (b.completedAt as number) - (a.completedAt as number));
  const overlap = (o: Session) => {
    const theirs = new Set(workingSets(bySession.get(o.id) ?? []).map((l) => l.exerciseId));
    return [...exIds].filter((id) => theirs.has(id));
  };
  let pick: { o: Session; shared: string[] } | null = null;
  if (session.workoutDayId) {
    const sameDay = earlier.find((o) => o.workoutDayId === session.workoutDayId && overlap(o).length >= need);
    if (sameDay) pick = { o: sameDay, shared: overlap(sameDay) };
  }
  if (!pick) {
    for (const o of earlier) {
      const shared = overlap(o);
      if (shared.length >= need) {
        pick = { o, shared };
        break;
      }
    }
  }
  if (!pick) return null;
  const sharedSet = new Set(pick.shared);
  const now = volumeKg(mine.filter((l) => sharedSet.has(l.exerciseId)), ctx);
  const before = volumeKg(workingSets(bySession.get(pick.o.id) ?? []).filter((l) => sharedSet.has(l.exerciseId)), ctx);
  if (before <= 0) return null;
  return { pct: ((now - before) / before) * 100, against: pick.o, shared: pick.shared.length };
}

export function summarizeSession(state: StoreData, sessionId: string): SessionSummary | null {
  const session = state.sessions[sessionId];
  if (!session) return null;
  const ctx = statsCtx(state);
  const bySession = logsBySession(state.setLogs);
  const logs = (bySession.get(sessionId) ?? []).slice().sort((a, b) => a.completedAt - b.completedAt);
  const exerciseIds = [...new Set(logs.map((l) => l.exerciseId))];
  return {
    session,
    logs,
    workingSetCount: workingSets(logs).length,
    exerciseIds,
    volumeKg: volumeKg(logs, ctx),
    durationMin: sessionDurationMin(session, logs),
    comparison: compareVolume(session, logs, state.sessions, bySession, ctx),
    records: sessionRecords(sessionId, state.sessions, state.setLogs, ctx),
  };
}
