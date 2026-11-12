// Domain types — mirror the Android Room schema. All weights in kg; times epoch millis.

export type Units = 'kg' | 'lbs';
export type ThemeChoice = 'light' | 'dark' | 'system';
export type BodyFigure = 'male' | 'female';

export interface Split {
  id: string;
  name: string;
  dayCount: number;
  isCustom: boolean;
}

export interface WorkoutDay {
  id: string;
  splitId: string;
  dayNumber: number;
  name: string;
  muscleGroups: string[];
  isRestDay: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  primaryMuscle: string;
  secondaryMuscles: string[];
  illustrationFilename: string;
  formCues: string[];
  equipment: string;
  defaultSets: number;
  defaultRepsLow: number;
  defaultRepsHigh: number;
  // Web-only (dropped from the Android-compatible export):
  /** Sets are holds measured in seconds (plank): SetLog.reps carries the seconds. */
  timed?: boolean;
  /** Rest after a set of this exercise, overriding the default; null = default. */
  restSeconds?: number | null;
  /** Your own note: seat height, grip, cues. */
  notes?: string | null;
}

export interface DayExercise {
  id: string;
  workoutDayId: string;
  exerciseId: string;
  orderIndex: number;
  prescribedSets: number;
  prescribedRepsLow: number;
  prescribedRepsHigh: number;
}

export interface Session {
  id: string;
  workoutDayId: string | null;
  startedAt: number;
  completedAt: number | null;
  notes: string | null;
  activityType?: string | null;
  durationMin?: number | null;
  /** Web-only: distance of a run/ride/swim, in km. */
  distanceKm?: number | null;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  setNumber: number;
  weightKg: number;
  reps: number;
  completedAt: number;
  rir?: number | null;
  // Web-only:
  /** Warm-ups don't count toward volume, records or suggestions; top/back-off are labels. */
  tag?: SetTag | null;
  /** Resistance band level 1–5 (extra light … extra heavy) for band exercises. */
  band?: number | null;
}

export type SetTag = 'warmup' | 'top' | 'backoff';
export const BAND_LEVELS = ['Extra light', 'Light', 'Medium', 'Heavy', 'Extra heavy'] as const;

export interface BodyMetric {
  id: string;
  recordedAt: number;
  bodyweightKg: number | null;
  bodyFatPct: number | null;
  muscleMassKg: number | null;
}

export interface UserPrefs {
  activeSplitId: string | null;
  units: Units;
  theme: ThemeChoice;
  onboardingComplete: boolean;
  restSeconds: number;
  accent: string;
  handle?: string | null;
  color?: string | null;
  avatarPhoto?: string | null;
  // Web-only prefs. Optional because older persisted state predates them — read them
  // through the defaults in store.ts, never directly.
  goalWeightKg?: number | null;
  bodyFigure?: BodyFigure;
  keepAwake?: boolean;
  /** Show estimated 1RMs (some people find them noisy or discouraging). */
  show1RM?: boolean;
  textSize?: TextSize;
  /** Ask for reps-in-reserve after each working set. */
  logEffort?: boolean;
  /** Training days per week the weekly streak counts against; null = from the routine. */
  weeklyTarget?: number | null;
  /** Fixed training weekdays (0 = Sunday); null = train whenever, rest days by rotation. */
  trainingWeekdays?: number[] | null;
}

export type TextSize = 'default' | 'large' | 'larger';

// Ephemeral-but-persisted state of the workout currently being logged.
export interface ActiveSessionState {
  sessionId: string;
  workoutDayId: string;
  exerciseIds: string[]; // ordered, includes temporary additions
  addedExerciseIds: string[]; // subset that were added just for this workout
  replacedExerciseIds?: string[]; // subset swapped in for a prescribed exercise this workout
  currentIndex: number;
  restEndAt: number | null;
  restDuration: number | null; // seconds for the current running timer
  /** Sets added (+) or removed (−) per exercise this workout, relative to the prescription. */
  setAdjust?: Record<string, number>;
}

export const REST_SESSION_NOTE = 'rest';
export const DEFAULT_START_WEIGHT_KG = 20.0;
export const REST_MIN = 30;
export const REST_MAX = 600;
export const REST_STEP = 30;
export const DEFAULT_REST_SECONDS = 90;
export const MIN_DAYS = 2;
export const MAX_DAYS = 7;
