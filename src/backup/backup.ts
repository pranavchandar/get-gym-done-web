import type {
  Exercise,
  Split,
  WorkoutDay,
  DayExercise,
  Session,
  SetLog,
  BodyMetric,
  UserPrefs,
} from '../types';
import { parseUnit } from '../domain/units';
import { useStore } from '../store/store';
import type { StoreData } from '../store/store';
import { DEFAULT_ACCENT } from '../theme/palettes';

export interface AndroidUserPrefs {
  id: number;
  activeSplitId: string | null;
  units: string;
  theme: string;
  onboardingComplete: boolean;
  restSeconds: number;
  accent: string;
  socialEnabled: boolean;
  socialUserId: string | null;
  socialHandle: string | null;
  socialColor: string | null;
  avatarPhoto: string | null;
}

export interface BackupFile {
  version: 2;
  exportedAt: number;
  exercises: Exercise[];
  splits: Split[];
  workoutDays: WorkoutDay[];
  dayExercises: DayExercise[];
  sessions: Session[];
  setLogs: SetLog[];
  bodyMetrics: BodyMetric[];
  userPrefs: AndroidUserPrefs | null;
  exerciseMedia: unknown[];
}

function values<T>(rec: Record<string, T>): T[] {
  return Object.values(rec);
}

export function buildBackup(state: StoreData = useStore.getState()): BackupFile {
  const p = state.prefs;
  const userPrefs: AndroidUserPrefs = {
    id: 0,
    activeSplitId: p.activeSplitId,
    units: p.units,
    theme: p.theme,
    onboardingComplete: p.onboardingComplete,
    restSeconds: p.restSeconds,
    accent: p.accent,
    socialEnabled: false,
    socialUserId: null,
    socialHandle: p.handle ?? null,
    socialColor: p.color ?? null,
    avatarPhoto: p.avatarPhoto ?? null,
  };
  return {
    version: 2,
    exportedAt: Date.now(),
    exercises: values(state.exercises),
    splits: values(state.splits),
    workoutDays: values(state.workoutDays),
    dayExercises: values(state.dayExercises),
    sessions: values(state.sessions),
    setLogs: values(state.setLogs),
    bodyMetrics: values(state.bodyMetrics),
    userPrefs,
    exerciseMedia: [],
  };
}

export function serializeBackup(state?: StoreData): string {
  return JSON.stringify(buildBackup(state), null, 2);
}

function toRecord<T extends { id: string }>(arr: T[] | undefined): Record<string, T> {
  const rec: Record<string, T> = {};
  for (const item of arr ?? []) if (item && item.id != null) rec[item.id] = item;
  return rec;
}

function prefsFromBackup(raw: Partial<AndroidUserPrefs> | null | undefined): UserPrefs | null {
  if (!raw) return null;
  return {
    activeSplitId: raw.activeSplitId ?? null,
    units: parseUnit(raw.units),
    theme: (raw.theme === 'light' || raw.theme === 'dark' || raw.theme === 'system' ? raw.theme : 'system'),
    onboardingComplete: raw.onboardingComplete ?? true,
    restSeconds: raw.restSeconds ?? 90,
    accent: raw.accent ?? DEFAULT_ACCENT,
    handle: raw.socialHandle ?? null,
    color: raw.socialColor ?? null,
    avatarPhoto: raw.avatarPhoto ?? null,
  };
}

const BACKUP_RECORD_FIELDS = [
  'exercises',
  'splits',
  'workoutDays',
  'dayExercises',
  'sessions',
  'setLogs',
  'bodyMetrics',
] as const;

/** Assert that data[field] is an array of non-null objects with a string `id`. */
function assertRecordArray(data: Record<string, unknown>, field: string): void {
  const arr = data[field];
  if (!Array.isArray(arr)) {
    throw new Error(`Invalid backup: "${field}" is missing or not a list.`);
  }
  for (const item of arr) {
    if (typeof item !== 'object' || item === null || Array.isArray(item) || typeof (item as { id?: unknown }).id !== 'string') {
      throw new Error(`Invalid backup: bad entry in "${field}".`);
    }
  }
}

/** Parse a backup JSON string, throwing on invalid shape. */
export function parseBackup(text: string): BackupFile {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('Not a valid JSON file.');
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Not a Get Gym Done backup file.');
  }
  const rec = data as Record<string, unknown>;
  if (rec.version !== 2) {
    throw new Error('Unsupported backup version — expected version 2.');
  }
  for (const field of BACKUP_RECORD_FIELDS) {
    assertRecordArray(rec, field);
  }
  const userPrefs = rec.userPrefs;
  if (userPrefs != null && (typeof userPrefs !== 'object' || Array.isArray(userPrefs))) {
    throw new Error('Invalid backup: "userPrefs" is malformed.');
  }
  return data as BackupFile;
}

export const PRE_IMPORT_BACKUP_KEY = 'get-gym-done:pre-import-backup';

function downloadTextAsJson(text: string, filename: string): void {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Full wipe + re-insert from a parsed backup. */
export function applyBackup(data: BackupFile): void {
  const prefs = prefsFromBackup(data.userPrefs);
  const patch: Partial<StoreData> = {
    exercises: toRecord(data.exercises),
    splits: toRecord(data.splits),
    workoutDays: toRecord(data.workoutDays),
    dayExercises: toRecord(data.dayExercises),
    sessions: toRecord(data.sessions),
    setLogs: toRecord(data.setLogs),
    bodyMetrics: toRecord(data.bodyMetrics),
  };
  if (prefs) patch.prefs = prefs;

  // Safety net: snapshot current data before wiping it, in case the import
  // turns out to be unwanted or the user needs to recover.
  const snapshot = serializeBackup();
  try {
    localStorage.setItem(PRE_IMPORT_BACKUP_KEY, snapshot);
  } catch {
    try {
      downloadTextAsJson(snapshot, 'gymdone-pre-import-backup.json');
    } catch {
      // Best-effort only — never let the safety snapshot block the import.
    }
  }

  useStore.getState().replaceAll(patch);
}

export function downloadBackup(filename = 'gymdone-backup.json'): void {
  downloadTextAsJson(serializeBackup(), filename);
}

export async function readFileAsText(file: File): Promise<string> {
  return await file.text();
}
