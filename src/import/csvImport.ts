import type { Exercise, Session, SetLog, Units } from '../types';
import { KG_PER_LB } from '../domain/units';
import type { LibraryEntry } from '../data/library';
import { libraryToExercise } from '../data/library';

// Bring history over from other trackers: Strong, Hevy and FitNotes CSV exports.
// Each workout becomes a completed session (not tied to a routine day, so your
// rotation is untouched); exercise names are matched against the catalog and the
// library, and anything unrecognised becomes a custom exercise — nothing is dropped.
// Session ids are derived from the source and start time, so re-importing the same
// file adds nothing twice.

export type CsvSource = 'strong' | 'hevy' | 'fitnotes';

export const SOURCE_LABEL: Record<CsvSource, string> = { strong: 'Strong', hevy: 'Hevy', fitnotes: 'FitNotes' };

interface RawSet {
  workoutKey: string;
  startedAt: number;
  endedAt: number | null;
  workoutName: string | null;
  exerciseName: string;
  category: string | null;
  weight: number; // in the source unit (see weightUnit)
  weightUnit: Units | null; // null = the file doesn't say
  reps: number;
}

export interface ParsedImport {
  source: CsvSource;
  sets: RawSet[];
  /** True when weights carry no unit and the user has to say which it is. */
  needsUnit: boolean;
  skipped: number;
}

// ---------------------------------------------------------------- CSV parsing

/** RFC 4180-ish parser; delimiter sniffed from the header line (`,` or `;`). */
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, '');
  const nl = src.search(/\r?\n/);
  const firstLine = nl < 0 ? src : src.slice(0, nl);
  const delim = (firstLine.match(/;/g)?.length ?? 0) > (firstLine.match(/,/g)?.length ?? 0) ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === delim) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      if (row.some((f) => f !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f !== '')) rows.push(row);
  return rows;
}

const num = (s: string | undefined) => {
  if (s == null) return NaN;
  const t = s.trim().replace(',', '.');
  return t === '' ? NaN : Number(t);
};

const MONTHS: Record<string, number> = {
  jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
};

/** Local-time parse of the date shapes these apps write. NaN when unrecognised. */
export function parseDate(s: string): number {
  const t = s.trim();
  // 2024-01-10 18:03:12 / 2024-01-10T18:03 / 2024-01-10
  let m = t.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (m) {
    const hasTime = m[4] != null;
    return new Date(+m[1], +m[2] - 1, +m[3], hasTime ? +m[4] : 12, hasTime ? +m[5] : 0, m[6] ? +m[6] : 0).getTime();
  }
  // Hevy: "10 Jan 2024, 18:00"
  m = t.match(/^(\d{1,2}) ([A-Za-z]{3})[a-z]* (\d{4}),? (\d{1,2}):(\d{2})/);
  if (m && MONTHS[m[2].toLowerCase()] != null) {
    return new Date(+m[3], MONTHS[m[2].toLowerCase()], +m[1], +m[4], +m[5]).getTime();
  }
  const fallback = Date.parse(t);
  return Number.isFinite(fallback) ? fallback : NaN;
}

/** Strong's "1h 5m" / "45m" / "3600" duration, in ms. */
function parseDuration(s: string | undefined): number | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d+$/.test(t)) return +t * 1000;
  const h = t.match(/(\d+)\s*h/);
  const mm = t.match(/(\d+)\s*m/);
  if (!h && !mm) return null;
  return ((h ? +h[1] : 0) * 60 + (mm ? +mm[1] : 0)) * 60000;
}

// ---------------------------------------------------------------- format detection

export function parseImport(text: string): ParsedImport {
  const rows = parseCsv(text);
  if (rows.length < 2) throw new Error('That file has no workout rows.');
  const header = rows[0].map((h) => h.trim());
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const body = rows.slice(1);
  const get = (r: string[], i: number) => (i >= 0 ? r[i] ?? '' : '');

  const sets: RawSet[] = [];
  let skipped = 0;

  if (col('exercise_title') >= 0 && col('start_time') >= 0) {
    // Hevy
    const [cTitle, cStart, cEnd, cEx, cType, cKg, cLbs, cReps] = [
      col('title'), col('start_time'), col('end_time'), col('exercise_title'), col('set_type'),
      col('weight_kg'), col('weight_lbs'), col('reps'),
    ];
    for (const r of body) {
      const startedAt = parseDate(get(r, cStart));
      const reps = num(get(r, cReps));
      const kg = num(get(r, cKg));
      const lbs = num(get(r, cLbs));
      // Warm-ups aren't working sets; cardio/timed rows carry no reps.
      if (!Number.isFinite(startedAt) || !(reps > 0) || get(r, cType).toLowerCase() === 'warmup') {
        skipped++;
        continue;
      }
      const end = parseDate(get(r, cEnd));
      sets.push({
        workoutKey: get(r, cStart),
        startedAt,
        endedAt: Number.isFinite(end) ? end : null,
        workoutName: get(r, cTitle) || null,
        exerciseName: get(r, cEx).trim(),
        category: null,
        weight: Number.isFinite(kg) ? kg : Number.isFinite(lbs) ? lbs : 0,
        weightUnit: Number.isFinite(kg) ? 'kg' : Number.isFinite(lbs) ? 'lbs' : 'kg',
        reps,
      });
    }
    return { source: 'hevy', sets, needsUnit: false, skipped };
  }

  if (col('exercise name') >= 0 && col('set order') >= 0) {
    // Strong
    const [cDate, cName, cDur, cEx, cOrder, cW, cReps, cUnit] = [
      col('date'), col('workout name'), col('duration'), col('exercise name'), col('set order'),
      col('weight'), col('reps'), col('weight unit'),
    ];
    for (const r of body) {
      const startedAt = parseDate(get(r, cDate));
      const reps = num(get(r, cReps));
      if (!Number.isFinite(startedAt) || !(reps > 0) || !/^\d+$/.test(get(r, cOrder).trim())) {
        skipped++; // rest-timer rows, notes rows, cardio
        continue;
      }
      const dur = parseDuration(get(r, cDur));
      const unit = get(r, cUnit).toLowerCase();
      const w = num(get(r, cW));
      sets.push({
        workoutKey: get(r, cDate),
        startedAt,
        endedAt: dur != null ? startedAt + dur : null,
        workoutName: get(r, cName) || null,
        exerciseName: get(r, cEx).trim(),
        category: null,
        weight: Number.isFinite(w) ? w : 0,
        weightUnit: unit.startsWith('lb') ? 'lbs' : unit.startsWith('kg') ? 'kg' : null,
        reps,
      });
    }
    return { source: 'strong', sets, needsUnit: sets.some((s) => s.weightUnit == null), skipped };
  }

  const cWkg = col('weight (kgs)');
  const cWlb = col('weight (lbs)');
  if (col('exercise') >= 0 && col('date') >= 0 && (cWkg >= 0 || cWlb >= 0 || col('weight') >= 0)) {
    // FitNotes
    const [cDate, cEx, cCat, cReps] = [col('date'), col('exercise'), col('category'), col('reps')];
    const cW = cWkg >= 0 ? cWkg : cWlb >= 0 ? cWlb : col('weight');
    const unit: Units | null = cWkg >= 0 ? 'kg' : cWlb >= 0 ? 'lbs' : null;
    for (const r of body) {
      const startedAt = parseDate(get(r, cDate));
      const reps = num(get(r, cReps));
      if (!Number.isFinite(startedAt) || !(reps > 0)) {
        skipped++;
        continue;
      }
      const w = num(get(r, cW));
      sets.push({
        workoutKey: get(r, cDate).trim().slice(0, 10),
        startedAt,
        endedAt: null,
        workoutName: null,
        exerciseName: get(r, cEx).trim(),
        category: get(r, cCat) || null,
        weight: Number.isFinite(w) ? w : 0,
        weightUnit: unit,
        reps,
      });
    }
    return { source: 'fitnotes', sets, needsUnit: unit == null, skipped };
  }

  throw new Error("Couldn't recognise this file. Export a CSV from Strong, Hevy or FitNotes.");
}

// ---------------------------------------------------------------- exercise matching

// "Bench Press (Barbell)" and "Barbell Bench Press" are the same lift: compare the
// set of words, with a few spelling variants folded together.
const SYNONYM: Record<string, string> = {
  db: 'dumbbell', dumbbells: 'dumbbell', bb: 'barbell', bodyweight: 'body', weight: '',
  curls: 'curl', raises: 'raise', presses: 'press', rows: 'row', extensions: 'extension',
  flyes: 'fly', flys: 'fly', flye: 'fly', pulldowns: 'pulldown', pushups: 'pushup', pullups: 'pullup',
  chinups: 'chinup', squats: 'squat', lunges: 'lunge', deadlifts: 'deadlift', dips: 'dip',
  lever: 'machine', leverage: 'machine',
};
export function nameKey(name: string): string {
  return [
    ...new Set(
      name
        .toLowerCase()
        .replace(/push[\s-]?ups?/g, 'pushup')
        .replace(/pull[\s-]?ups?/g, 'pullup')
        .replace(/chin[\s-]?ups?/g, 'chinup')
        .replace(/[^a-z0-9]+/g, ' ')
        .split(' ')
        .map((w) => SYNONYM[w] ?? w)
        .filter(Boolean),
    ),
  ]
    .sort()
    .join(' ');
}

const FITNOTES_CATEGORY: Record<string, string> = {
  chest: 'Chest', back: 'Mid Back', shoulders: 'Shoulders', biceps: 'Biceps', triceps: 'Triceps',
  legs: 'Quads', abs: 'Abs', cardio: 'Cardio', forearms: 'Forearms', glutes: 'Glutes', calves: 'Calves',
};

export interface ImportPlan {
  source: CsvSource;
  sessions: Session[];
  setLogs: SetLog[];
  /** Exercises to add to the catalog (library picks + new customs). */
  newExercises: Exercise[];
  matched: number;
  created: number;
  duplicateWorkouts: number;
  skipped: number;
  firstAt: number | null;
  lastAt: number | null;
}

let seq = 0;
const localId = () => `imp-${Date.now().toString(36)}-${(seq++).toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export function planImport(
  parsed: ParsedImport,
  unitIfMissing: Units,
  catalog: Record<string, Exercise>,
  existingSessionIds: Set<string>,
  library: LibraryEntry[] | null,
): ImportPlan {
  const byKey = new Map<string, Exercise>();
  for (const e of Object.values(catalog)) if (!byKey.has(nameKey(e.name))) byKey.set(nameKey(e.name), e);
  const libByKey = new Map<string, LibraryEntry>();
  for (const e of library ?? []) if (!libByKey.has(nameKey(e.n))) libByKey.set(nameKey(e.n), e);

  // "Lat Pulldown (Cable)" -> "Lat Pulldown", but only when the bracketed equipment
  // agrees, so smith-machine squats don't land on the barbell squat's history.
  const byBareName = (name: string): Exercise | undefined => {
    const m = name.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    if (!m) return undefined;
    const ex = byKey.get(nameKey(m[1]));
    if (!ex) return undefined;
    const want = nameKey(m[2]);
    return want && nameKey(ex.equipment) === want ? ex : undefined;
  };

  const resolved = new Map<string, string>(); // source name -> exercise id
  const newExercises: Exercise[] = [];
  let matched = 0;
  let created = 0;
  const resolve = (name: string, category: string | null): string => {
    const hit = resolved.get(name);
    if (hit) return hit;
    const key = nameKey(name);
    let ex = byKey.get(key) ?? byBareName(name);
    if (ex) matched++;
    else {
      const lib = libByKey.get(key);
      if (lib) {
        ex = libraryToExercise(lib);
        matched++;
      } else {
        ex = {
          id: localId(),
          name,
          primaryMuscle: (category && FITNOTES_CATEGORY[category.toLowerCase()]) || 'Other',
          secondaryMuscles: [],
          illustrationFilename: '',
          formCues: [],
          equipment: 'Other',
          defaultSets: 3,
          defaultRepsLow: 8,
          defaultRepsHigh: 12,
        };
        created++;
      }
      if (!catalog[ex.id]) newExercises.push(ex);
      byKey.set(key, ex);
    }
    resolved.set(name, ex.id);
    return ex.id;
  };

  // Group rows into workouts, preserving file order within each.
  const workouts = new Map<string, RawSet[]>();
  for (const s of parsed.sets) {
    const arr = workouts.get(s.workoutKey);
    if (arr) arr.push(s);
    else workouts.set(s.workoutKey, [s]);
  }

  const sessions: Session[] = [];
  const setLogs: SetLog[] = [];
  let duplicateWorkouts = 0;
  let firstAt: number | null = null;
  let lastAt: number | null = null;
  for (const rows of workouts.values()) {
    const startedAt = Math.min(...rows.map((r) => r.startedAt));
    const sessionId = `import-${parsed.source}-${startedAt}`;
    if (existingSessionIds.has(sessionId)) {
      duplicateWorkouts++;
      continue;
    }
    const ends = rows.map((r) => r.endedAt).filter((e): e is number => e != null && e >= startedAt);
    const completedAt = ends.length ? Math.max(...ends) : startedAt + 60 * 60000;
    const name = rows.find((r) => r.workoutName)?.workoutName;
    sessions.push({
      id: sessionId,
      workoutDayId: null,
      startedAt,
      completedAt,
      notes: `Imported from ${SOURCE_LABEL[parsed.source]}${name ? ` · ${name}` : ''}`,
    });
    firstAt = firstAt == null ? startedAt : Math.min(firstAt, startedAt);
    lastAt = lastAt == null ? startedAt : Math.max(lastAt, startedAt);

    const setNo = new Map<string, number>();
    const span = Math.max(completedAt - startedAt, rows.length);
    rows.forEach((r, i) => {
      const exerciseId = resolve(r.exerciseName, r.category);
      const n = (setNo.get(exerciseId) ?? 0) + 1;
      setNo.set(exerciseId, n);
      const unit = r.weightUnit ?? unitIfMissing;
      setLogs.push({
        id: `${sessionId}-${i}`,
        sessionId,
        exerciseId,
        setNumber: n,
        weightKg: Math.max(0, unit === 'lbs' ? r.weight * KG_PER_LB : r.weight),
        reps: Math.round(r.reps),
        // Spread sets across the workout so "latest set" orderings stay meaningful.
        completedAt: startedAt + Math.round(((i + 1) / rows.length) * span),
        rir: null,
      });
    });
  }

  return {
    source: parsed.source,
    sessions,
    setLogs,
    newExercises,
    matched,
    created,
    duplicateWorkouts,
    skipped: parsed.skipped,
    firstAt,
    lastAt,
  };
}
