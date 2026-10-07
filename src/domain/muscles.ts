import type { Exercise } from '../types';

// Muscle-load model behind every body map. Exercise muscles are free text ("Front
// Delts", "Mid Back", "Posterior Chain"…); they collapse onto the regions the body
// diagram can actually draw. Anything undrawable (Cardio) contributes nothing.

export type MuscleSlug =
  | 'trapezius' | 'deltoids' | 'chest' | 'upper-back' | 'serratus'
  | 'biceps' | 'triceps' | 'forearm'
  | 'abs' | 'obliques' | 'lower-back'
  | 'gluteal' | 'quadriceps' | 'hamstring' | 'adductors' | 'hip-flexors'
  | 'calves' | 'tibialis';

/** Drawable muscles, head-to-toe — also the order of any list built from them. */
export const MUSCLES: MuscleSlug[] = [
  'trapezius', 'deltoids', 'chest', 'upper-back', 'serratus',
  'biceps', 'triceps', 'forearm',
  'abs', 'obliques', 'lower-back',
  'gluteal', 'quadriceps', 'hamstring', 'adductors', 'hip-flexors',
  'calves', 'tibialis',
];

export const MUSCLE_LABEL: Record<MuscleSlug, string> = {
  trapezius: 'Traps', deltoids: 'Shoulders', chest: 'Chest', 'upper-back': 'Upper back',
  serratus: 'Serratus', biceps: 'Biceps', triceps: 'Triceps', forearm: 'Forearms',
  abs: 'Abs', obliques: 'Obliques', 'lower-back': 'Lower back', gluteal: 'Glutes',
  quadriceps: 'Quads', hamstring: 'Hamstrings', adductors: 'Adductors',
  'hip-flexors': 'Hip flexors', calves: 'Calves', tibialis: 'Shins',
};

type Spread = Partial<Record<MuscleSlug, number>>;

// Lower-cased muscle name -> region(s). Weights inside a spread sum to 1 so a
// compound label ("Posterior Chain") doesn't count triple.
const ALIAS: Record<string, Spread> = {
  chest: { chest: 1 }, 'upper chest': { chest: 1 }, 'lower chest': { chest: 1 }, pecs: { chest: 1 },
  shoulders: { deltoids: 1 }, shoulder: { deltoids: 1 }, delts: { deltoids: 1 },
  'front delts': { deltoids: 1 }, 'side delts': { deltoids: 1 }, 'rear delts': { deltoids: 1 },
  'rotator cuff': { deltoids: 1 },
  traps: { trapezius: 1 }, neck: { trapezius: 1 },
  lats: { 'upper-back': 1 }, 'mid back': { 'upper-back': 1 }, 'upper back': { 'upper-back': 1 },
  back: { 'upper-back': 0.75, 'lower-back': 0.25 },
  'lower back': { 'lower-back': 1 },
  serratus: { serratus: 1 },
  biceps: { biceps: 1 }, brachialis: { biceps: 1 }, triceps: { triceps: 1 }, forearms: { forearm: 1 },
  arms: { biceps: 0.5, triceps: 0.5 },
  abs: { abs: 1 }, core: { abs: 0.7, obliques: 0.3 }, obliques: { obliques: 1 },
  glutes: { gluteal: 1 }, abductors: { gluteal: 1 },
  quads: { quadriceps: 1 }, quadriceps: { quadriceps: 1 },
  hamstrings: { hamstring: 1 }, adductors: { adductors: 1 }, 'hip flexors': { 'hip-flexors': 1 },
  calves: { calves: 1 }, shins: { tibialis: 1 },
  legs: { quadriceps: 0.4, hamstring: 0.35, gluteal: 0.25 },
  'posterior chain': { gluteal: 0.4, hamstring: 0.35, 'lower-back': 0.25 },
  'full body': { quadriceps: 0.25, gluteal: 0.2, 'upper-back': 0.2, deltoids: 0.15, abs: 0.2 },
};

/** A supporting muscle counts this much against the primary. */
const SECONDARY = 0.4;

export type MuscleLoad = Partial<Record<MuscleSlug, number>>;

/** Regions one exercise trains, each 0..1. */
export function musclesOf(ex: Pick<Exercise, 'primaryMuscle' | 'secondaryMuscles'> | undefined): MuscleLoad {
  const out: MuscleLoad = {};
  if (!ex) return out;
  const add = (name: string, w: number) => {
    const spread = ALIAS[name.trim().toLowerCase()];
    if (!spread) return;
    for (const [slug, f] of Object.entries(spread) as [MuscleSlug, number][]) {
      out[slug] = Math.max(out[slug] ?? 0, w * f);
    }
  };
  add(ex.primaryMuscle, 1);
  for (const m of ex.secondaryMuscles ?? []) add(m, SECONDARY);
  return out;
}

/**
 * Training load per region in "effective sets": a 4-set exercise weighs four times a
 * single set. Volume in kg is deliberately not used — 100 kg of leg press against
 * 10 kg of lateral raise says nothing about which muscle worked harder.
 */
export function loadOf(
  items: { exerciseId: string; sets: number }[],
  exercises: Record<string, Exercise>,
): MuscleLoad {
  const load: MuscleLoad = {};
  for (const { exerciseId, sets } of items) {
    if (!sets) continue;
    const m = musclesOf(exercises[exerciseId]);
    for (const [slug, w] of Object.entries(m) as [MuscleSlug, number][]) {
      load[slug] = (load[slug] ?? 0) + w * sets;
    }
  }
  return load;
}

/** Load from logged sets: each SetLog is one set of its exercise. */
export function loadOfLogs(logs: { exerciseId: string }[], exercises: Record<string, Exercise>): MuscleLoad {
  const counts = new Map<string, number>();
  for (const l of logs) counts.set(l.exerciseId, (counts.get(l.exerciseId) ?? 0) + 1);
  return loadOf([...counts].map(([exerciseId, sets]) => ({ exerciseId, sets })), exercises);
}

export type MuscleLevels = Partial<Record<MuscleSlug, number>>;

/**
 * Shade buckets 0–4, relative to the hardest-worked region in the same window: the map
 * answers "is my training balanced", which only means something as a comparison.
 */
export function levelsOf(load: MuscleLoad): MuscleLevels {
  const max = Math.max(0, ...MUSCLES.map((m) => load[m] ?? 0));
  const lv: MuscleLevels = {};
  for (const m of MUSCLES) {
    const v = load[m] ?? 0;
    lv[m] = v <= 0 || max <= 0 ? 0 : Math.max(1, Math.min(4, Math.ceil((v / max) * 4)));
  }
  return lv;
}

/** Regions hardest-worked first; untrained ones separately, in body order. */
export function rankOf(load: MuscleLoad): { worked: MuscleSlug[]; missed: MuscleSlug[] } {
  const worked = MUSCLES.filter((m) => (load[m] ?? 0) > 0).sort((a, b) => (load[b] ?? 0) - (load[a] ?? 0));
  const missed = MUSCLES.filter((m) => !((load[m] ?? 0) > 0));
  return { worked, missed };
}
