import seedData from '../data/seed_data.json';
import type { Split, WorkoutDay, DayExercise, Exercise } from '../types';

export const SEED_VERSION = 1;

interface SeedDayExercise {
  exerciseId: string;
  orderIndex: number;
  sets: number;
  repsLow: number;
  repsHigh: number;
}
interface SeedDay {
  id: string;
  dayNumber: number;
  name: string;
  muscleGroups: string[];
  exercises: SeedDayExercise[];
  isRestDay?: boolean;
}
interface SeedSplit {
  id: string;
  name: string;
  dayCount: number;
  days: SeedDay[];
}
interface SeedExercise {
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

interface SeedRoot {
  splits: SeedSplit[];
  exercises: SeedExercise[];
}

const data = seedData as unknown as SeedRoot;

export function dayExerciseId(dayId: string, exerciseId: string, orderIndex: number): string {
  return `${dayId}_${exerciseId}_${orderIndex}`;
}

export interface SeedCatalog {
  splits: Record<string, Split>;
  workoutDays: Record<string, WorkoutDay>;
  dayExercises: Record<string, DayExercise>;
  exercises: Record<string, Exercise>;
}

export function buildSeedCatalog(): SeedCatalog {
  const splits: Record<string, Split> = {};
  const workoutDays: Record<string, WorkoutDay> = {};
  const dayExercises: Record<string, DayExercise> = {};
  const exercises: Record<string, Exercise> = {};

  for (const se of data.exercises) {
    exercises[se.id] = {
      id: se.id,
      name: se.name,
      primaryMuscle: se.primaryMuscle,
      secondaryMuscles: se.secondaryMuscles ?? [],
      illustrationFilename: se.illustrationFilename ?? '',
      formCues: se.formCues ?? [],
      equipment: se.equipment ?? 'Other',
      defaultSets: se.defaultSets ?? 3,
      defaultRepsLow: se.defaultRepsLow ?? 8,
      defaultRepsHigh: se.defaultRepsHigh ?? 12,
    };
  }

  for (const ss of data.splits) {
    splits[ss.id] = { id: ss.id, name: ss.name, dayCount: ss.dayCount, isCustom: false };
    for (const sd of ss.days) {
      workoutDays[sd.id] = {
        id: sd.id,
        splitId: ss.id,
        dayNumber: sd.dayNumber,
        name: sd.name,
        muscleGroups: sd.muscleGroups ?? [],
        isRestDay: sd.isRestDay ?? false,
      };
      for (const de of sd.exercises ?? []) {
        const id = dayExerciseId(sd.id, de.exerciseId, de.orderIndex);
        dayExercises[id] = {
          id,
          workoutDayId: sd.id,
          exerciseId: de.exerciseId,
          orderIndex: de.orderIndex,
          prescribedSets: de.sets,
          prescribedRepsLow: de.repsLow,
          prescribedRepsHigh: de.repsHigh,
        };
      }
    }
  }

  return { splits, workoutDays, dayExercises, exercises };
}

/** Muscle names & equipment options available in the seed catalog (for custom-exercise form). */
export function seedMuscles(): string[] {
  const set = new Set<string>();
  for (const e of data.exercises) {
    set.add(e.primaryMuscle);
    for (const m of e.secondaryMuscles) set.add(m);
  }
  return [...set].sort();
}
export function seedEquipment(): string[] {
  const set = new Set<string>();
  for (const e of data.exercises) set.add(e.equipment);
  return [...set].sort();
}
