import type { BodyMetric, Exercise, Session, SetLog } from '../types';
import { REST_SESSION_NOTE } from '../types';
import { estimate1RM } from './onerm';
import { epochDayLocal } from './dates';

// Training maths shared by every screen, so a number means the same thing everywhere:
// - warm-up sets never count (volume, records, 1RM, suggestions);
// - a bodyweight move's load is your bodyweight plus what you added (minus assistance),
//   using the weigh-in nearest before the set;
// - bands and timed holds have no load: their records are reps and seconds.

export type LoadKind = 'weight' | 'bodyweight' | 'band' | 'time';

export function loadKind(ex: Pick<Exercise, 'equipment' | 'timed'> | undefined): LoadKind {
  if (!ex) return 'weight';
  if (ex.timed) return 'time';
  if (ex.equipment === 'Band') return 'band';
  // "Weighted" (dips, pull-ups with a belt) and "Assisted" moves are bodyweight plus or
  // minus a load.
  if (ex.equipment === 'Bodyweight' || ex.equipment === 'Weighted' || ex.equipment === 'Assisted') return 'bodyweight';
  return 'weight';
}

export const isWarmup = (l: SetLog) => l.tag === 'warmup';
export const workingSets = (logs: SetLog[]) => logs.filter((l) => !isWarmup(l));

/** Bodyweight (kg) on a given moment: last weigh-in that day or before, else the first after. */
export function bodyweightLookup(metrics: BodyMetric[]): (t: number) => number | null {
  const rows = metrics
    .filter((r) => r.bodyweightKg != null)
    .map((r) => ({ ed: epochDayLocal(r.recordedAt), at: r.recordedAt, kg: r.bodyweightKg as number }))
    .sort((a, b) => a.at - b.at);
  return (t) => {
    if (!rows.length) return null;
    const ed = epochDayLocal(t);
    let lo = 0;
    let hi = rows.length - 1;
    let found = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (rows[mid].ed <= ed) {
        found = mid;
        lo = mid + 1;
      } else hi = mid - 1;
    }
    return found >= 0 ? rows[found].kg : rows[0].kg;
  };
}

export interface StatsCtx {
  exercises: Record<string, Exercise>;
  bwAt: (t: number) => number | null;
}

export function statsCtx(s: { exercises: Record<string, Exercise>; bodyMetrics: Record<string, BodyMetric> }): StatsCtx {
  return { exercises: s.exercises, bwAt: bodyweightLookup(Object.values(s.bodyMetrics)) };
}

export const kindOf = (exerciseId: string, ctx: StatsCtx) => loadKind(ctx.exercises[exerciseId]);

/**
 * The load a set moved (kg), or null when it has none to speak of: bands, holds, and
 * bodyweight moves before any weigh-in.
 */
export function setLoadKg(l: SetLog, ctx: StatsCtx): number | null {
  const kind = kindOf(l.exerciseId, ctx);
  if (kind === 'band' || kind === 'time') return null;
  if (kind === 'bodyweight') {
    const bw = ctx.bwAt(l.completedAt);
    return bw == null ? null : Math.max(0, bw + l.weightKg);
  }
  return l.weightKg;
}

/** Load × reps of one working set (warm-ups and holds are 0). */
export function setVolumeKg(l: SetLog, ctx: StatsCtx): number {
  if (isWarmup(l)) return 0;
  const kind = kindOf(l.exerciseId, ctx);
  if (kind === 'time') return 0;
  const load = setLoadKg(l, ctx);
  // A bodyweight move without a weigh-in still counts what was added on top.
  if (load == null) return kind === 'bodyweight' ? Math.max(0, l.weightKg) * l.reps : 0;
  return load * l.reps;
}

export function volumeKg(logs: SetLog[], ctx: StatsCtx): number {
  let sum = 0;
  for (const l of logs) sum += setVolumeKg(l, ctx);
  return sum;
}

export interface BestE1rm {
  est: number;
  /** effective load of the set it came from (kg) */
  loadKg: number;
  /** what was on the bar / added (kg) — for a bodyweight move, the added load */
  weightKg: number;
  reps: number;
  at: number;
}

/** Estimated 1RM of one working set from its effective load, or null. */
export function setE1rm(l: SetLog, ctx: StatsCtx): number | null {
  if (isWarmup(l)) return null;
  const load = setLoadKg(l, ctx);
  return load == null ? null : estimate1RM(load, l.reps);
}

export function bestE1rmOf(logs: SetLog[], ctx: StatsCtx): BestE1rm | null {
  let best: BestE1rm | null = null;
  for (const l of logs) {
    const est = setE1rm(l, ctx);
    if (est != null && (!best || est > best.est)) {
      best = { est, loadKg: setLoadKg(l, ctx) as number, weightKg: l.weightKg, reps: Math.round(l.reps), at: l.completedAt };
    }
  }
  return best;
}

// ------------------------------------------------------------------ records

export type RecordKind = 'weight' | 'reps' | 'e1rm' | 'time';

export interface RecordHit {
  exerciseId: string;
  kind: RecordKind;
  /** the set that set it */
  log: SetLog;
  /** load (kg) for weight/reps records, e1RM (kg) for e1rm, seconds for time */
  value: number;
  previous: number | null;
}

const EPS = 0.01;

/** A comparable "weight" for rep records: effective load, else band level, else added load. */
function repKey(l: SetLog, ctx: StatsCtx): number {
  const load = setLoadKg(l, ctx);
  if (load != null) return load;
  if (kindOf(l.exerciseId, ctx) === 'band') return l.band ?? 0;
  return l.weightKg;
}

/**
 * Records `logs` (one session, one exercise) set against `prior` (every earlier working
 * set of that exercise). The first time you do an exercise sets nothing: there is nothing
 * to beat yet. At most one record of each kind.
 */
export function recordsOf(logs: SetLog[], prior: SetLog[], ctx: StatsCtx): RecordHit[] {
  const now = workingSets(logs);
  const before = workingSets(prior);
  if (!now.length || !before.length) return [];
  const exerciseId = now[0].exerciseId;
  const kind = kindOf(exerciseId, ctx);
  const out: RecordHit[] = [];

  if (kind === 'time') {
    const best = now.reduce((a, b) => (b.reps > a.reps ? b : a));
    const prev = Math.max(...before.map((l) => l.reps));
    if (best.reps > prev) out.push({ exerciseId, kind: 'time', log: best, value: best.reps, previous: prev });
    return out;
  }

  // Heaviest load
  const loads = now.map((l) => ({ l, w: setLoadKg(l, ctx) })).filter((x): x is { l: SetLog; w: number } => x.w != null && x.w > 0);
  const priorLoads = before.map((l) => setLoadKg(l, ctx)).filter((w): w is number => w != null);
  if (loads.length && priorLoads.length) {
    const top = loads.reduce((a, b) => (b.w > a.w || (Math.abs(b.w - a.w) < EPS && b.l.reps > a.l.reps) ? b : a));
    const prev = Math.max(...priorLoads);
    if (top.w > prev + EPS) out.push({ exerciseId, kind: 'weight', log: top.l, value: top.w, previous: prev });
  }

  // Most reps at a weight you have done before (heavier counts as "at" it)
  let repHit: RecordHit | null = null;
  for (const l of now) {
    const k = repKey(l, ctx);
    const comparable = before.filter((p) => repKey(p, ctx) >= k - EPS);
    if (!comparable.length) continue; // a new heaviest weight is a weight record, not a rep one
    const prev = Math.max(...comparable.map((p) => p.reps));
    if (l.reps > prev && (!repHit || k > repHit.value + EPS || (Math.abs(k - repHit.value) < EPS && l.reps > repHit.log.reps))) {
      repHit = { exerciseId, kind: 'reps', log: l, value: k, previous: prev };
    }
  }
  if (repHit) out.push(repHit);

  // Estimated 1RM
  const best = bestE1rmOf(now, ctx);
  const priorBest = bestE1rmOf(before, ctx);
  if (best && priorBest && best.est > priorBest.est + EPS) {
    const log = now.find((l) => l.completedAt === best.at) ?? now[0];
    out.push({ exerciseId, kind: 'e1rm', log, value: best.est, previous: priorBest.est });
  }
  return out;
}

/** Completed sessions that hold training (not rest-day logs), oldest first. */
export function trainingSessions(sessions: Record<string, Session>): Session[] {
  return Object.values(sessions)
    .filter((s) => s.completedAt != null && s.notes !== REST_SESSION_NOTE)
    .sort((a, b) => (a.completedAt as number) - (b.completedAt as number));
}

/** Set logs grouped by session id. */
export function logsBySession(setLogs: Record<string, SetLog>): Map<string, SetLog[]> {
  const m = new Map<string, SetLog[]>();
  for (const l of Object.values(setLogs)) {
    const arr = m.get(l.sessionId);
    if (arr) arr.push(l);
    else m.set(l.sessionId, [l]);
  }
  return m;
}

/** Every record set in `sessionId`, judged against all completed sessions before it. */
export function sessionRecords(
  sessionId: string,
  sessions: Record<string, Session>,
  setLogs: Record<string, SetLog>,
  ctx: StatsCtx,
): RecordHit[] {
  const session = sessions[sessionId];
  if (!session || session.completedAt == null) return [];
  const at = session.completedAt;
  const earlier = new Set(
    Object.values(sessions)
      .filter((o) => o.completedAt != null && o.id !== sessionId && o.completedAt < at)
      .map((o) => o.id),
  );
  const mine = Object.values(setLogs).filter((l) => l.sessionId === sessionId);
  const out: RecordHit[] = [];
  for (const exId of new Set(mine.map((l) => l.exerciseId))) {
    const prior = Object.values(setLogs).filter((l) => l.exerciseId === exId && earlier.has(l.sessionId));
    out.push(...recordsOf(mine.filter((l) => l.exerciseId === exId), prior, ctx));
  }
  return out;
}

export interface ExerciseBests {
  exerciseId: string;
  kind: LoadKind;
  /** heaviest working set by effective load */
  heaviest: { log: SetLog; loadKg: number } | null;
  /** most reps in one set (bands, bodyweight without a weigh-in) or longest hold (s) */
  mostReps: SetLog | null;
  e1rm: BestE1rm | null;
  /** running best after each session, oldest first — the record line */
  curve: { at: number; value: number }[];
  sessions: number;
}

/**
 * Bests per exercise over the given (completed) sessions. The curve follows the measure
 * that fits the exercise: load for weighted moves, reps for bands, seconds for holds.
 */
export function exerciseBests(sessionsAsc: Session[], bySession: Map<string, SetLog[]>, ctx: StatsCtx): ExerciseBests[] {
  const map = new Map<string, ExerciseBests>();
  for (const se of sessionsAsc) {
    const logs = workingSets(bySession.get(se.id) ?? []);
    const byEx = new Map<string, SetLog[]>();
    for (const l of logs) {
      const arr = byEx.get(l.exerciseId);
      if (arr) arr.push(l);
      else byEx.set(l.exerciseId, [l]);
    }
    for (const [exId, exLogs] of byEx) {
      let b = map.get(exId);
      if (!b) {
        b = { exerciseId: exId, kind: kindOf(exId, ctx), heaviest: null, mostReps: null, e1rm: null, curve: [], sessions: 0 };
        map.set(exId, b);
      }
      b.sessions++;
      for (const l of exLogs) {
        const w = setLoadKg(l, ctx);
        if (w != null && (!b.heaviest || w > b.heaviest.loadKg + EPS || (Math.abs(w - b.heaviest.loadKg) < EPS && l.reps > b.heaviest.log.reps))) {
          b.heaviest = { log: l, loadKg: w };
        }
        if (!b.mostReps || l.reps > b.mostReps.reps) b.mostReps = l;
      }
      const e = bestE1rmOf(exLogs, ctx);
      if (e && (!b.e1rm || e.est > b.e1rm.est)) b.e1rm = e;
      const value = b.heaviest ? b.heaviest.loadKg : b.mostReps ? b.mostReps.reps : 0;
      b.curve.push({ at: se.completedAt as number, value });
    }
  }
  return [...map.values()];
}

/** Whether an exercise's records are measured by load (vs reps or seconds). */
export function measuredByLoad(b: Pick<ExerciseBests, 'heaviest' | 'kind'>): boolean {
  return b.kind !== 'time' && b.heaviest != null;
}
