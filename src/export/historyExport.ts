import type { StoreData } from '../store/store';
import type { Session, SetLog, Units } from '../types';
import { REST_SESSION_NOTE } from '../types';
import { kgToDisplay, formatWeight, kmToDisplay, distanceUnit } from '../domain/units';
import { statsCtx, logsBySession, workingSets, volumeKg, setLoadKg, bestE1rmOf, loadKind } from '../domain/stats';
import { trainingEpochDays, weekStartOf, weeklyTargetFor } from '../domain/schedule';
import { daysOf } from '../store/selectors';
import { epochDayLocal, formatDateShort } from '../domain/dates';
import { formatSet, plural, formatMinutes } from '../domain/format';
import { sessionDurationMin } from '../domain/summary';
import { PdfDoc, PAGE_W, PAGE_H, fitText, textWidth } from './pdf';

const p2 = (n: number) => String(n).padStart(2, '0');
const isoDate = (t: number) => {
  const d = new Date(t);
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
};
const isoTime = (t: number) => {
  const d = new Date(t);
  return `${p2(d.getHours())}:${p2(d.getMinutes())}`;
};
const csvCell = (v: string | number | null | undefined) => {
  const s = v == null ? '' : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const round = (v: number, places = 2) => Math.round(v * 10 ** places) / 10 ** places;

function completedSessions(state: StoreData): Session[] {
  return Object.values(state.sessions)
    .filter((s) => s.completedAt != null && s.notes !== REST_SESSION_NOTE)
    .sort((a, b) => (a.completedAt as number) - (b.completedAt as number));
}

function workoutName(state: StoreData, s: Session): string {
  if (s.activityType) return s.activityType;
  const day = s.workoutDayId ? state.workoutDays[s.workoutDayId] : null;
  return day?.name ?? s.notes?.replace(/^Imported from [^·]+· ?/, '') ?? 'Workout';
}

/** Every set and activity as one spreadsheet row — opens in Excel, Numbers or Sheets. */
export function historyCsv(state: StoreData): Blob {
  const unit = state.prefs.units;
  const header = ['date', 'time', 'workout', 'exercise', 'set', 'set_type', `weight_${unit}`, 'reps', 'seconds', 'band', 'reps_in_reserve', 'duration_min', `distance_${distanceUnit(unit)}`, 'notes'];
  const rows: (string | number | null)[][] = [header];
  const bySession = logsBySession(state.setLogs);
  for (const s of completedSessions(state)) {
    const at = s.completedAt as number;
    const name = workoutName(state, s);
    const logs = (bySession.get(s.id) ?? []).slice().sort((a, b) => a.completedAt - b.completedAt);
    if (!logs.length) {
      rows.push([isoDate(at), isoTime(at), name, '', '', '', '', '', '', '', '', s.durationMin ?? '', s.distanceKm != null ? round(kmToDisplay(s.distanceKm, unit)) : '', s.notes ?? '']);
      continue;
    }
    const duration = sessionDurationMin(s, logs);
    logs.forEach((l, i) => {
      const ex = state.exercises[l.exerciseId];
      const timed = !!ex?.timed;
      rows.push([
        isoDate(at),
        isoTime(at),
        name,
        ex?.name ?? 'Exercise',
        l.setNumber,
        l.tag ?? 'working',
        loadKind(ex) === 'band' ? '' : round(kgToDisplay(l.weightKg, unit)),
        timed ? '' : l.reps,
        timed ? l.reps : '',
        l.band ?? '',
        l.rir ?? '',
        i === 0 ? duration ?? '' : '',
        '',
        i === 0 && s.workoutDayId ? s.notes ?? '' : '',
      ]);
    });
  }
  const text = rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  return new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
}

// ---------------------------------------------------------------- PDF progress report

const MARGIN = 48;
const BOTTOM = 56;

/**
 * A printable progress report for a coach or physio: adherence, bodyweight, how each lift
 * moved, and the session log for the last `weeks` weeks.
 */
export function progressReportPdf(state: StoreData, weeks = 12, now = Date.now()): Blob {
  const unit: Units = state.prefs.units;
  const ctx = statsCtx(state);
  const bySession = logsBySession(state.setLogs);
  const today = epochDayLocal(now);
  const fromEd = weekStartOf(today) - (weeks - 1) * 7;
  const inRange = completedSessions(state).filter((s) => epochDayLocal(s.completedAt as number) >= fromEd);
  const doc = new PdfDoc();
  let y = PAGE_H - MARGIN;
  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) {
      doc.newPage();
      y = PAGE_H - MARGIN;
    }
  };
  const line = (text: string, opts: { size?: number; bold?: boolean; gray?: number; x?: number; gap?: number } = {}) => {
    const size = opts.size ?? 10;
    ensure(size + 4);
    doc.text(fitText(text, PAGE_W - MARGIN - (opts.x ?? MARGIN), size, opts.bold ? 'bold' : 'regular'), opts.x ?? MARGIN, y, { size, font: opts.bold ? 'bold' : 'regular', gray: opts.gray ?? 0 });
    y -= opts.gap ?? size + 5;
  };
  /** Several lines when the text is wider than the page, so no set is cut off. */
  const para = (text: string, opts: { size: number; x: number; gray: number; gap: number }) => {
    const max = PAGE_W - MARGIN - opts.x;
    let cur = '';
    for (const word of text.split(' ')) {
      const next = cur ? `${cur} ${word}` : word;
      if (cur && textWidth(next, opts.size, 'regular') > max) {
        line(cur, opts);
        cur = `  ${word}`;
      } else cur = next;
    }
    if (cur) line(cur, opts);
  };
  const section = (title: string) => {
    y -= 10;
    ensure(40);
    doc.rect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 0.8, 0.75);
    y -= 18;
    line(title.toUpperCase(), { size: 11, bold: true, gap: 18 });
  };

  const name = state.prefs.handle || 'Athlete';
  line(`${name} - training report`, { size: 20, bold: true, gap: 22 });
  const startDate = new Date(fromEd * 86400000);
  line(`Last ${weeks} weeks: ${formatDateShort(new Date(startDate.getUTCFullYear(), startDate.getUTCMonth(), startDate.getUTCDate()).getTime())} - ${formatDateShort(now)} ${new Date(now).getFullYear()} - generated by Get Gym Done`, { size: 9, gray: 0.4, gap: 8 });

  // Summary
  section('Summary');
  const days = trainingEpochDays(state.sessions, state.workoutDays, today);
  const target = weeklyTargetFor(state.prefs, daysOf(state, state.prefs.activeSplitId));
  let hitWeeks = 0;
  for (let w = 0; w < weeks; w++) {
    const ws = fromEd + w * 7;
    let n = 0;
    for (let d = ws; d < ws + 7; d++) if (days.has(d)) n++;
    if (n >= target) hitWeeks++;
  }
  const workouts = inRange.filter((s) => !s.activityType);
  const activities = inRange.filter((s) => s.activityType);
  const vol = volumeKg(workouts.flatMap((s) => bySession.get(s.id) ?? []), ctx);
  const durations = workouts.map((s) => sessionDurationMin(s, bySession.get(s.id) ?? [])).filter((d): d is number => d != null);
  line(`${plural(workouts.length, 'workout')} and ${plural(activities.length, 'activity', 'activities')} - ${hitWeeks} of ${weeks} weeks hit the target of ${plural(target, 'training day')}.`);
  line(`Total volume ${Math.round(kgToDisplay(vol, unit)).toLocaleString()} ${unit}${durations.length ? ` - average workout ${formatMinutes(durations.reduce((a, b) => a + b, 0) / durations.length)}` : ''}.`);
  const bw = Object.values(state.bodyMetrics)
    .filter((r) => r.bodyweightKg != null && epochDayLocal(r.recordedAt) >= fromEd)
    .sort((a, b) => a.recordedAt - b.recordedAt);
  if (bw.length) {
    const first = bw[0].bodyweightKg as number;
    const last = bw[bw.length - 1].bodyweightKg as number;
    const diff = kgToDisplay(last - first, unit);
    line(`Bodyweight ${formatWeight(first, unit)} -> ${formatWeight(last, unit)} ${unit} (${diff >= 0 ? '+' : '-'}${Math.abs(Math.round(diff * 10) / 10)} ${unit}) over ${plural(bw.length, 'weigh-in')}.`);
  }

  // Lifts
  const perEx = new Map<string, { sessions: { at: number; top: SetLog }[] }>();
  for (const s of workouts) {
    const byEx = new Map<string, SetLog>();
    for (const l of workingSets(bySession.get(s.id) ?? [])) {
      const cur = byEx.get(l.exerciseId);
      const lw = setLoadKg(l, ctx) ?? l.reps;
      const cw = cur ? setLoadKg(cur, ctx) ?? cur.reps : -1;
      if (!cur || lw > cw || (lw === cw && l.reps > cur.reps)) byEx.set(l.exerciseId, l);
    }
    for (const [exId, top] of byEx) {
      const e = perEx.get(exId) ?? { sessions: [] };
      e.sessions.push({ at: s.completedAt as number, top });
      perEx.set(exId, e);
    }
  }
  if (perEx.size) {
    section('Lifts (top working set, first -> latest)');
    const cols = [MARGIN, MARGIN + 190, MARGIN + 250, MARGIN + 370, PAGE_W - MARGIN - 70];
    ensure(16);
    ['Exercise', 'Sessions', 'First', 'Latest', 'Best e1RM'].forEach((h, i) => doc.text(h, cols[i], y, { size: 8, font: 'bold', gray: 0.4 }));
    y -= 14;
    const rows = [...perEx.entries()].sort((a, b) => b[1].sessions.length - a[1].sessions.length);
    for (const [exId, e] of rows) {
      ensure(14);
      const ex = state.exercises[exId];
      const first = e.sessions[0].top;
      const last = e.sessions[e.sessions.length - 1].top;
      const best = bestE1rmOf(e.sessions.map((x) => x.top), ctx);
      doc.text(fitText(ex?.name ?? 'Exercise', 182, 9, 'regular'), cols[0], y, { size: 9 });
      doc.text(String(e.sessions.length), cols[1], y, { size: 9 });
      doc.text(fitText(formatSet(first, ex, unit), 112, 9, 'regular'), cols[2], y, { size: 9 });
      doc.text(fitText(formatSet(last, ex, unit), 112, 9, 'regular'), cols[3], y, { size: 9 });
      doc.text(best ? `${formatWeight(best.est, unit)} ${unit}` : '-', cols[4], y, { size: 9 });
      y -= 13;
    }
  }

  // Session log
  section('Session log');
  for (const s of [...inRange].reverse()) {
    const at = s.completedAt as number;
    const logs = (bySession.get(s.id) ?? []).slice().sort((a, b) => a.setNumber - b.setNumber || a.completedAt - b.completedAt);
    const head = `${new Date(at).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} - ${workoutName(state, s)}`;
    const dur = s.activityType ? s.durationMin : sessionDurationMin(s, logs);
    const extra = [dur ? formatMinutes(dur) : null, s.distanceKm ? `${round(kmToDisplay(s.distanceKm, unit))} ${distanceUnit(unit)}` : null].filter(Boolean).join(' - ');
    ensure(30);
    line(`${head}${extra ? ` (${extra})` : ''}`, { size: 10, bold: true, gap: 13 });
    const byEx = new Map<string, SetLog[]>();
    for (const l of logs) {
      const arr = byEx.get(l.exerciseId);
      if (arr) arr.push(l);
      else byEx.set(l.exerciseId, [l]);
    }
    for (const [exId, exLogs] of byEx) {
      const ex = state.exercises[exId];
      const sets = exLogs.map((l) => formatSet(l, ex, unit) + (l.tag === 'warmup' ? ' (w)' : '')).join(', ');
      para(`${ex?.name ?? 'Exercise'}: ${sets}`, { size: 8.5, x: MARGIN + 10, gray: 0.15, gap: 11 });
    }
    if (s.notes && (s.workoutDayId || s.activityType)) para(`Note: ${s.notes.replace(/\s+/g, ' ')}`, { size: 8.5, x: MARGIN + 10, gray: 0.4, gap: 11 });
    y -= 4;
  }
  if (!inRange.length) line('No sessions in this period.', { gray: 0.4 });

  return doc.build(`${name} training report`);
}
