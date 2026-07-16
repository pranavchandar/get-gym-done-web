// Domain types — mirror the Android Room schema. All weights in kg; times epoch millis.

export type Units = 'kg' | 'lbs';
export type ThemeChoice = 'light' | 'dark' | 'system';

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
}

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
}

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
}

export const REST_SESSION_NOTE = 'rest';
export const DEFAULT_START_WEIGHT_KG = 20.0;
export const REST_MIN = 30;
export const REST_MAX = 600;
export const REST_STEP = 30;
export const DEFAULT_REST_SECONDS = 90;
export const MIN_DAYS = 2;
export const MAX_DAYS = 7;
