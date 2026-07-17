import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Split,
  WorkoutDay,
  DayExercise,
  Exercise,
  Session,
  SetLog,
  BodyMetric,
  UserPrefs,
  ActiveSessionState,
  Units,
  ThemeChoice,
} from '../types';
import { REST_SESSION_NOTE, DEFAULT_REST_SECONDS, REST_MIN, REST_MAX } from '../types';
import { buildSeedCatalog, SEED_VERSION } from './seed';
import { DEFAULT_ACCENT } from '../theme/palettes';
import { epochDayLocal } from '../domain/dates';

export const STORAGE_KEY = 'get-gym-done:v1';

export function uid(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const defaultPrefs: UserPrefs = {
  activeSplitId: null,
  units: 'kg',
  theme: 'system',
  onboardingComplete: false,
  restSeconds: DEFAULT_REST_SECONDS,
  accent: DEFAULT_ACCENT,
  handle: null,
  color: null,
  avatarPhoto: null,
};

export interface DraftDay {
  name: string;
  isRestDay: boolean;
  exercises: { exerciseId: string; sets: number; repsLow: number; repsHigh: number }[];
}
export interface RoutineDraft {
  name: string;
  days: DraftDay[];
}

export interface StoreData {
  seedVersion: number;
  splits: Record<string, Split>;
  workoutDays: Record<string, WorkoutDay>;
  dayExercises: Record<string, DayExercise>;
  exercises: Record<string, Exercise>;
  sessions: Record<string, Session>;
  setLogs: Record<string, SetLog>;
  bodyMetrics: Record<string, BodyMetric>;
  prefs: UserPrefs;
  activeSession: ActiveSessionState | null;
  confettiArmed: boolean;
}

export interface StoreActions {
  ensureSeeded: () => void;
  // prefs
  setTheme: (t: ThemeChoice) => void;
  setUnits: (u: Units) => void;
  setRestSeconds: (seconds: number) => void;
  setAccent: (a: string) => void;
  setProfile: (p: { handle?: string | null; color?: string | null; avatarPhoto?: string | null }) => void;
  // splits / onboarding
  activatePresetSplit: (splitId: string) => void;
  activateExistingSplit: (splitId: string) => void;
  commitCustomSplit: (draft: RoutineDraft) => string;
  // exercises
  createCustomExercise: (fields: Partial<Exercise> & { name: string; primaryMuscle: string }) => string;
  // day/week editing
  updateDayName: (dayId: string, name: string) => void;
  moveDay: (splitId: string, dayNumber: number, dir: -1 | 1) => void;
  addDay: (splitId: string, name: string) => void;
  removeDay: (dayId: string) => boolean;
  saveDayExercises: (
    dayId: string,
    name: string,
    rows: { exerciseId: string; sets: number; repsLow: number; repsHigh: number }[],
  ) => void;
  // workout session
  startOrResumeSession: (workoutDayId: string) => string;
  logSet: (exerciseId: string, setNumber: number, weightKg: number, reps: number) => void;
  removeSet: (setLogId: string) => void;
  undoLastSet: (exerciseId: string) => void;
  addExerciseToWorkout: (exerciseId: string) => void;
  replaceExercise: (oldExerciseId: string, newExerciseId: string) => void;
  removeExerciseFromWorkout: (exerciseId: string) => void;
  setCurrentIndex: (i: number) => void;
  startRestTimer: (seconds: number) => void;
  adjustRestTimer: (delta: number) => void;
  clearRestTimer: () => void;
  finishWorkout: () => string | null;
  // body & activity
  logBodyMetric: (m: { bodyweightKg?: number | null; bodyFatPct?: number | null; muscleMassKg?: number | null }) => void;
  logActivity: (a: {
    activityType: string;
    durationMin: number | null;
    notes: string | null;
    workoutDayId: string | null;
  }) => void;
  autoLogRestDay: (restDayId: string) => void;
  // confetti
  armConfetti: () => void;
  consumeConfetti: () => void;
  // data
  replaceAll: (data: Partial<StoreData>) => void;
}

export type Store = StoreData & StoreActions;

function initialData(): StoreData {
  return {
    seedVersion: 0,
    splits: {},
    workoutDays: {},
    dayExercises: {},
    exercises: {},
    sessions: {},
    setLogs: {},
    bodyMetrics: {},
    prefs: { ...defaultPrefs },
    activeSession: null,
    confettiArmed: false,
  };
}

// ---- pure helpers over state ----
function daysOfSplit(s: StoreData, splitId: string | null): WorkoutDay[] {
  if (!splitId) return [];
  return Object.values(s.workoutDays)
    .filter((d) => d.splitId === splitId)
    .sort((a, b) => a.dayNumber - b.dayNumber);
}
function dayExercisesOf(s: StoreData, dayId: string): DayExercise[] {
  return Object.values(s.dayExercises)
    .filter((d) => d.workoutDayId === dayId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
}
function setLogsOfSession(s: StoreData, sessionId: string): SetLog[] {
  return Object.values(s.setLogs).filter((l) => l.sessionId === sessionId);
}
function recomputeDayCount(s: StoreData, splitId: string): number {
  return daysOfSplit(s, splitId).length;
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      ...initialData(),

      ensureSeeded: () => {
        const s = get();
        const catalog = buildSeedCatalog();
        if (s.seedVersion === 0 || Object.keys(s.exercises).length === 0) {
          // First run: seed everything fresh.
          set({
            seedVersion: SEED_VERSION,
            splits: { ...catalog.splits },
            workoutDays: { ...catalog.workoutDays },
            dayExercises: { ...catalog.dayExercises },
            exercises: { ...catalog.exercises },
          });
          return;
        }
        if (s.seedVersion < SEED_VERSION) {
          // Merge catalog: add new exercises, update descriptive fields in place, never
          // remove; add new preset splits/days, preserve custom splits & user edits.
          const exercises = { ...s.exercises };
          for (const [id, ex] of Object.entries(catalog.exercises)) {
            exercises[id] = { ...exercises[id], ...ex };
          }
          const splits = { ...s.splits };
          const workoutDays = { ...s.workoutDays };
          const dayExercises = { ...s.dayExercises };
          for (const [id, sp] of Object.entries(catalog.splits)) {
            if (!splits[id]) splits[id] = sp;
          }
          for (const [id, wd] of Object.entries(catalog.workoutDays)) {
            if (!workoutDays[id]) workoutDays[id] = wd;
          }
          for (const [id, de] of Object.entries(catalog.dayExercises)) {
            if (!dayExercises[id]) dayExercises[id] = de;
          }
          set({ seedVersion: SEED_VERSION, exercises, splits, workoutDays, dayExercises });
        }
      },

      setTheme: (t) => set((s) => ({ prefs: { ...s.prefs, theme: t } })),
      setUnits: (u) => set((s) => ({ prefs: { ...s.prefs, units: u } })),
      setRestSeconds: (seconds) => {
        const v = Math.max(REST_MIN, Math.min(REST_MAX, Math.round(seconds)));
        set((s) => ({ prefs: { ...s.prefs, restSeconds: v } }));
      },
      setAccent: (a) => set((s) => ({ prefs: { ...s.prefs, accent: a } })),
      setProfile: (p) => set((s) => ({ prefs: { ...s.prefs, ...p } })),

      activatePresetSplit: (splitId) =>
        set((s) => ({ prefs: { ...s.prefs, activeSplitId: splitId, onboardingComplete: true } })),
      activateExistingSplit: (splitId) =>
        set((s) => ({ prefs: { ...s.prefs, activeSplitId: splitId, onboardingComplete: true } })),

      commitCustomSplit: (draft) => {
        const splitId = uid();
        const workoutDays: Record<string, WorkoutDay> = {};
        const dayExercises: Record<string, DayExercise> = {};
        draft.days.forEach((d, i) => {
          const dayId = uid();
          workoutDays[dayId] = {
            id: dayId,
            splitId,
            dayNumber: i + 1,
            name: d.name,
            muscleGroups: [],
            isRestDay: d.isRestDay,
          };
          if (!d.isRestDay) {
            d.exercises.forEach((ex, oi) => {
              const id = uid();
              dayExercises[id] = {
                id,
                workoutDayId: dayId,
                exerciseId: ex.exerciseId,
                orderIndex: oi,
                prescribedSets: ex.sets,
                prescribedRepsLow: ex.repsLow,
                prescribedRepsHigh: ex.repsHigh,
              };
            });
          }
        });
        const split: Split = { id: splitId, name: draft.name.trim() || 'My Routine', dayCount: draft.days.length, isCustom: true };
        set((s) => ({
          splits: { ...s.splits, [splitId]: split },
          workoutDays: { ...s.workoutDays, ...workoutDays },
          dayExercises: { ...s.dayExercises, ...dayExercises },
          prefs: { ...s.prefs, activeSplitId: splitId, onboardingComplete: true },
        }));
        return splitId;
      },

      createCustomExercise: (fields) => {
        const id = uid();
        const ex: Exercise = {
          id,
          name: fields.name,
          primaryMuscle: fields.primaryMuscle,
          secondaryMuscles: fields.secondaryMuscles ?? [],
          illustrationFilename: '',
          formCues: fields.formCues ?? [],
          equipment: fields.equipment ?? 'Other',
          defaultSets: fields.defaultSets ?? 3,
          defaultRepsLow: fields.defaultRepsLow ?? 8,
          defaultRepsHigh: fields.defaultRepsHigh ?? 12,
        };
        set((s) => ({ exercises: { ...s.exercises, [id]: ex } }));
        return id;
      },

      updateDayName: (dayId, name) =>
        set((s) => {
          const d = s.workoutDays[dayId];
          if (!d) return {};
          return { workoutDays: { ...s.workoutDays, [dayId]: { ...d, name } } };
        }),

      moveDay: (splitId, dayNumber, dir) =>
        set((s) => {
          const days = daysOfSplit(s, splitId);
          const idx = days.findIndex((d) => d.dayNumber === dayNumber);
          const other = idx + dir;
          if (idx < 0 || other < 0 || other >= days.length) return {};
          const a = days[idx];
          const b = days[other];
          return {
            workoutDays: {
              ...s.workoutDays,
              [a.id]: { ...a, dayNumber: b.dayNumber },
              [b.id]: { ...b, dayNumber: a.dayNumber },
            },
          };
        }),

      addDay: (splitId, name) =>
        set((s) => {
          const days = daysOfSplit(s, splitId);
          const nextNum = days.length ? Math.max(...days.map((d) => d.dayNumber)) + 1 : 1;
          const dayId = uid();
          const wd: WorkoutDay = {
            id: dayId,
            splitId,
            dayNumber: nextNum,
            name,
            muscleGroups: [],
            isRestDay: false,
          };
          const split = s.splits[splitId];
          return {
            workoutDays: { ...s.workoutDays, [dayId]: wd },
            splits: split ? { ...s.splits, [splitId]: { ...split, dayCount: days.length + 1 } } : s.splits,
          };
        }),

      removeDay: (dayId) => {
        const s = get();
        const day = s.workoutDays[dayId];
        if (!day) return false;
        const hasSessions = Object.values(s.sessions).some((se) => se.workoutDayId === dayId);
        if (hasSessions) return false;
        const workoutDays = { ...s.workoutDays };
        delete workoutDays[dayId];
        const dayExercises = { ...s.dayExercises };
        for (const de of Object.values(s.dayExercises)) {
          if (de.workoutDayId === dayId) delete dayExercises[de.id];
        }
        // renumber remaining days of the split to stay contiguous
        const remaining = Object.values(workoutDays)
          .filter((d) => d.splitId === day.splitId)
          .sort((a, b) => a.dayNumber - b.dayNumber);
        remaining.forEach((d, i) => {
          workoutDays[d.id] = { ...d, dayNumber: i + 1 };
        });
        const split = s.splits[day.splitId];
        set({
          workoutDays,
          dayExercises,
          splits: split ? { ...s.splits, [day.splitId]: { ...split, dayCount: remaining.length } } : s.splits,
        });
        return true;
      },

      saveDayExercises: (dayId, name, rows) =>
        set((s) => {
          const day = s.workoutDays[dayId];
          if (!day) return {};
          const dayExercises = { ...s.dayExercises };
          for (const de of Object.values(s.dayExercises)) {
            if (de.workoutDayId === dayId) delete dayExercises[de.id];
          }
          rows.forEach((r, i) => {
            const id = uid();
            dayExercises[id] = {
              id,
              workoutDayId: dayId,
              exerciseId: r.exerciseId,
              orderIndex: i,
              prescribedSets: r.sets,
              prescribedRepsLow: r.repsLow,
              prescribedRepsHigh: r.repsHigh,
            };
          });
          return { workoutDays: { ...s.workoutDays, [dayId]: { ...day, name } }, dayExercises };
        }),

      startOrResumeSession: (workoutDayId) => {
        const s = get();
        if (s.activeSession && s.activeSession.workoutDayId === workoutDayId) {
          return s.activeSession.sessionId;
        }
        let session = Object.values(s.sessions).find(
          (se) => se.workoutDayId === workoutDayId && se.completedAt == null,
        );
        const sessions = { ...s.sessions };
        let sessionId: string;
        if (session) {
          sessionId = session.id;
        } else {
          sessionId = uid();
          session = {
            id: sessionId,
            workoutDayId,
            startedAt: Date.now(),
            completedAt: null,
            notes: null,
          };
          sessions[sessionId] = session;
        }
        const dayExs = dayExercisesOf(s, workoutDayId);
        const baseIds = dayExs.map((d) => d.exerciseId);
        const loggedIds = [...new Set(setLogsOfSession(s, sessionId).map((l) => l.exerciseId))];
        const added = loggedIds.filter((id) => !baseIds.includes(id));
        const exerciseIds = [...baseIds, ...added];

        // Compute first exercise with an unlogged set.
        const loggedCounts = new Map<string, Set<number>>();
        for (const l of setLogsOfSession(s, sessionId)) {
          if (!loggedCounts.has(l.exerciseId)) loggedCounts.set(l.exerciseId, new Set());
          loggedCounts.get(l.exerciseId)!.add(l.setNumber);
        }
        let startIndex = 0;
        for (let i = 0; i < exerciseIds.length; i++) {
          const exId = exerciseIds[i];
          const de = dayExs.find((d) => d.exerciseId === exId);
          const logged = loggedCounts.get(exId);
          const maxLogged = logged && logged.size ? Math.max(...logged) : 0;
          const setCount = Math.max(de?.prescribedSets ?? 1, maxLogged);
          const doneCount = logged ? logged.size : 0;
          if (doneCount < setCount) {
            startIndex = i;
            break;
          }
        }

        const activeSession: ActiveSessionState = {
          sessionId,
          workoutDayId,
          exerciseIds,
          addedExerciseIds: added,
          replacedExerciseIds: [],
          currentIndex: startIndex,
          restEndAt: null,
          restDuration: null,
        };
        set({ sessions, activeSession });
        return sessionId;
      },

      logSet: (exerciseId, setNumber, weightKg, reps) => {
        const s = get();
        if (!s.activeSession) return;
        const id = uid();
        const log: SetLog = {
          id,
          sessionId: s.activeSession.sessionId,
          exerciseId,
          setNumber,
          weightKg,
          reps,
          completedAt: Date.now(),
          rir: null,
        };
        set({ setLogs: { ...s.setLogs, [id]: log } });
      },

      removeSet: (setLogId) =>
        set((s) => {
          const logs = { ...s.setLogs };
          delete logs[setLogId];
          return { setLogs: logs };
        }),

      undoLastSet: (exerciseId) => {
        const s = get();
        if (!s.activeSession) return;
        const logs = setLogsOfSession(s, s.activeSession.sessionId)
          .filter((l) => l.exerciseId === exerciseId)
          .sort((a, b) => a.completedAt - b.completedAt);
        if (!logs.length) return;
        const last = logs[logs.length - 1];
        const next = { ...s.setLogs };
        delete next[last.id];
        set({ setLogs: next });
      },

      addExerciseToWorkout: (exerciseId) =>
        set((s) => {
          if (!s.activeSession) return {};
          if (s.activeSession.exerciseIds.includes(exerciseId)) {
            const idx = s.activeSession.exerciseIds.indexOf(exerciseId);
            return { activeSession: { ...s.activeSession, currentIndex: idx } };
          }
          const exerciseIds = [...s.activeSession.exerciseIds, exerciseId];
          return {
            activeSession: {
              ...s.activeSession,
              exerciseIds,
              addedExerciseIds: [...s.activeSession.addedExerciseIds, exerciseId],
              currentIndex: exerciseIds.length - 1,
            },
          };
        }),

      replaceExercise: (oldExerciseId, newExerciseId) => {
        const s = get();
        if (!s.activeSession) return;
        if (s.activeSession.exerciseIds.includes(newExerciseId)) return;
        const idx = s.activeSession.exerciseIds.indexOf(oldExerciseId);
        if (idx < 0) return;
        const exerciseIds = [...s.activeSession.exerciseIds];
        exerciseIds[idx] = newExerciseId;
        // delete logged sets of the old exercise
        const setLogsNext = { ...s.setLogs };
        for (const l of setLogsOfSession(s, s.activeSession.sessionId)) {
          if (l.exerciseId === oldExerciseId) delete setLogsNext[l.id];
        }
        const wasAdded = s.activeSession.addedExerciseIds.includes(oldExerciseId);
        const added = s.activeSession.addedExerciseIds.filter((id) => id !== oldExerciseId);
        const replaced = (s.activeSession.replacedExerciseIds ?? []).filter((id) => id !== oldExerciseId);
        if (wasAdded) added.push(newExerciseId);
        else replaced.push(newExerciseId);
        set({
          setLogs: setLogsNext,
          activeSession: {
            ...s.activeSession,
            exerciseIds,
            addedExerciseIds: added,
            replacedExerciseIds: replaced,
          },
        });
      },

      removeExerciseFromWorkout: (exerciseId) => {
        const s = get();
        if (!s.activeSession) return;
        if (s.activeSession.exerciseIds.length <= 1) return;
        const idx = s.activeSession.exerciseIds.indexOf(exerciseId);
        if (idx < 0) return;
        const exerciseIds = s.activeSession.exerciseIds.filter((id) => id !== exerciseId);
        const setLogsNext = { ...s.setLogs };
        for (const l of setLogsOfSession(s, s.activeSession.sessionId)) {
          if (l.exerciseId === exerciseId) delete setLogsNext[l.id];
        }
        const currentIndex = Math.min(s.activeSession.currentIndex, exerciseIds.length - 1);
        set({
          setLogs: setLogsNext,
          activeSession: {
            ...s.activeSession,
            exerciseIds,
            addedExerciseIds: s.activeSession.addedExerciseIds.filter((id) => id !== exerciseId),
            replacedExerciseIds: (s.activeSession.replacedExerciseIds ?? []).filter((id) => id !== exerciseId),
            currentIndex,
          },
        });
      },

      setCurrentIndex: (i) =>
        set((s) => (s.activeSession ? { activeSession: { ...s.activeSession, currentIndex: i } } : {})),

      startRestTimer: (seconds) =>
        set((s) =>
          s.activeSession
            ? {
                activeSession: {
                  ...s.activeSession,
                  restEndAt: Date.now() + seconds * 1000,
                  restDuration: seconds,
                },
              }
            : {},
        ),

      adjustRestTimer: (delta) =>
        set((s) => {
          if (!s.activeSession || s.activeSession.restEndAt == null) return {};
          const curDur = s.activeSession.restDuration ?? DEFAULT_REST_SECONDS;
          const newDur = Math.max(REST_MIN, Math.min(REST_MAX, curDur + delta));
          const applied = newDur - curDur;
          return {
            activeSession: {
              ...s.activeSession,
              restEndAt: s.activeSession.restEndAt + applied * 1000,
              restDuration: newDur,
            },
          };
        }),

      clearRestTimer: () =>
        set((s) =>
          s.activeSession ? { activeSession: { ...s.activeSession, restEndAt: null, restDuration: null } } : {},
        ),

      finishWorkout: () => {
        const s = get();
        if (!s.activeSession) return null;
        const sessionId = s.activeSession.sessionId;
        const session = s.sessions[sessionId];
        if (!session) {
          set({ activeSession: null });
          return null;
        }
        set({
          sessions: { ...s.sessions, [sessionId]: { ...session, completedAt: Date.now() } },
          activeSession: null,
        });
        return sessionId;
      },

      logBodyMetric: (m) => {
        const bw = m.bodyweightKg ?? null;
        const bf = m.bodyFatPct ?? null;
        const mm = m.muscleMassKg ?? null;
        if (bw == null && bf == null && mm == null) return;
        const s = get();
        const today = epochDayLocal(Date.now());
        const existing = Object.values(s.bodyMetrics).find((r) => epochDayLocal(r.recordedAt) === today);
        if (existing) {
          set({
            bodyMetrics: {
              ...s.bodyMetrics,
              [existing.id]: {
                ...existing,
                bodyweightKg: bw ?? existing.bodyweightKg,
                bodyFatPct: bf ?? existing.bodyFatPct,
                muscleMassKg: mm ?? existing.muscleMassKg,
              },
            },
          });
        } else {
          const id = uid();
          set({
            bodyMetrics: {
              ...s.bodyMetrics,
              [id]: { id, recordedAt: Date.now(), bodyweightKg: bw, bodyFatPct: bf, muscleMassKg: mm },
            },
          });
        }
      },

      logActivity: (a) => {
        const id = uid();
        const now = Date.now();
        const session: Session = {
          id,
          workoutDayId: a.workoutDayId,
          startedAt: now,
          completedAt: now,
          notes: a.notes,
          activityType: a.activityType,
          durationMin: a.durationMin,
        };
        set((s) => ({ sessions: { ...s.sessions, [id]: session } }));
      },

      autoLogRestDay: (restDayId) => {
        const id = uid();
        const now = Date.now();
        const session: Session = {
          id,
          workoutDayId: restDayId,
          startedAt: now,
          completedAt: now,
          notes: REST_SESSION_NOTE,
        };
        set((s) => ({ sessions: { ...s.sessions, [id]: session } }));
      },

      armConfetti: () => set({ confettiArmed: true }),
      consumeConfetti: () => set({ confettiArmed: false }),

      replaceAll: (data) =>
        set(() => ({
          ...initialData(),
          ...data,
          seedVersion: SEED_VERSION,
          activeSession: null,
        })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (state): StoreData => ({
        seedVersion: state.seedVersion,
        splits: state.splits,
        workoutDays: state.workoutDays,
        dayExercises: state.dayExercises,
        exercises: state.exercises,
        sessions: state.sessions,
        setLogs: state.setLogs,
        bodyMetrics: state.bodyMetrics,
        prefs: state.prefs,
        activeSession: state.activeSession,
        confettiArmed: state.confettiArmed,
      }),
    },
  ),
);

// Non-hook accessors (for backup/sync modules).
export function getState(): Store {
  return useStore.getState();
}

// Shared read helpers re-exported for selectors.
export { daysOfSplit, dayExercisesOf, setLogsOfSession, recomputeDayCount };
