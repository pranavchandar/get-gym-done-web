import type { Exercise } from '../types';

// The exercise library: 1,324 exercises (names, muscles, equipment, English
// instructions) from hasaneyldrm/exercises-dataset, MIT — see THIRD_PARTY_NOTICES.md.
// Text only: the dataset's images/GIFs are © Gym visual and are not redistributed.
// ~700 KB raw, so it loads on demand. Regenerate with scripts/build-library.py.

export interface LibraryEntry {
  /** dataset id */
  i: string;
  /** name */
  n: string;
  /** dataset body part (chest, back, upper legs, …) */
  b: string;
  /** equipment, in this app's vocabulary */
  e: string;
  /** primary muscle, in this app's vocabulary */
  p: string;
  /** secondary muscles */
  s: string[];
  /** instruction steps */
  c: string[];
}

let cache: LibraryEntry[] | null = null;
let pending: Promise<LibraryEntry[]> | null = null;

export function loadLibrary(): Promise<LibraryEntry[]> {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = import('./exercise_library.json')
      .then((m) => {
        cache = (m.default ?? m) as unknown as LibraryEntry[];
        return cache;
      })
      .catch((err) => {
        pending = null; // allow a retry, e.g. after coming back online
        throw err;
      });
  }
  return pending;
}

export function cachedLibrary(): LibraryEntry[] | null {
  return cache;
}

export const libraryId = (e: LibraryEntry) => `lib_${e.i}`;

function defaultReps(e: LibraryEntry): [number, number] {
  if (e.p === 'Abs' || e.p === 'Obliques' || e.p === 'Calves') return [12, 20];
  if (e.e === 'Bodyweight' || e.e === 'Band') return [8, 15];
  return [8, 12];
}

/** The catalog record a library entry becomes once it's picked. */
export function libraryToExercise(e: LibraryEntry): Exercise {
  const [low, high] = defaultReps(e);
  return {
    id: libraryId(e),
    name: e.n,
    primaryMuscle: e.p,
    secondaryMuscles: e.s,
    illustrationFilename: '',
    formCues: e.c,
    equipment: e.e,
    defaultSets: 3,
    defaultRepsLow: low,
    defaultRepsHigh: high,
  };
}
