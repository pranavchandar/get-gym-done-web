import { useEffect, useMemo, useState } from 'react';
import { Sheet, BigCta, GhostCta, Stepper } from './ui';
import { Search, Plus, Info } from './icons';
import { useStore } from '../store/store';
import { seedMuscles, seedEquipment } from '../store/seed';
import { loadLibrary, cachedLibrary, libraryId, libraryToExercise } from '../data/library';
import type { LibraryEntry } from '../data/library';
import type { Exercise } from '../types';

// Body-part filter, keyed off the primary muscle so catalog and library exercises
// land in the same bucket.
const BODY_PARTS: { key: string; label: string; muscles: string[] }[] = [
  { key: 'chest', label: 'Chest', muscles: ['chest', 'upper chest', 'lower chest'] },
  { key: 'back', label: 'Back', muscles: ['lats', 'mid back', 'lower back', 'traps', 'back', 'neck'] },
  { key: 'shoulders', label: 'Shoulders', muscles: ['shoulders', 'front delts', 'side delts', 'rear delts', 'serratus'] },
  { key: 'arms', label: 'Arms', muscles: ['biceps', 'triceps', 'forearms', 'brachialis'] },
  { key: 'legs', label: 'Legs', muscles: ['quads', 'hamstrings', 'glutes', 'calves', 'adductors', 'abductors', 'posterior chain', 'hip flexors'] },
  { key: 'core', label: 'Core', muscles: ['abs', 'obliques', 'core'] },
  { key: 'other', label: 'Cardio & full body', muscles: ['cardio', 'full body'] },
];
const partOf = (muscle: string) => BODY_PARTS.find((b) => b.muscles.includes(muscle.toLowerCase()))?.key ?? 'other';

const LIB_PAGE = 40;

export function ExercisePicker({
  onPick,
  onClose,
  title = 'Add exercise',
}: {
  onPick: (exerciseId: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const exercises = useStore((s) => s.exercises);
  const createCustom = useStore((s) => s.createCustomExercise);
  const addLibraryExercise = useStore((s) => s.addLibraryExercise);
  const [query, setQuery] = useState('');
  const [part, setPart] = useState<string | null>(null);
  const [equip, setEquip] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [library, setLibrary] = useState<LibraryEntry[] | null>(cachedLibrary());
  const [libError, setLibError] = useState(false);
  const [libLimit, setLibLimit] = useState(LIB_PAGE);
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchLibrary = () => {
    setLibError(false);
    loadLibrary().then(setLibrary).catch(() => setLibError(true));
  };
  useEffect(() => {
    if (!library) fetchLibrary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => setLibLimit(LIB_PAGE), [query, part, equip]);

  const q = query.trim().toLowerCase();
  const matchesText = (name: string, muscle: string) => !q || name.toLowerCase().includes(q) || muscle.toLowerCase().includes(q);

  // Library entries not already in the catalog (by id or by name).
  const libPool = useMemo(() => {
    if (!library) return [];
    const names = new Set(Object.values(exercises).map((e) => e.name.toLowerCase()));
    return library.filter((e) => !exercises[libraryId(e)] && !names.has(e.n.toLowerCase()));
  }, [library, exercises]);

  // Equipment options come from what's left after the text + body-part filters, most
  // common first, so every chip on screen has results behind it.
  const equipmentOptions = useMemo(() => {
    const counts = new Map<string, number>();
    const bump = (eq: string) => counts.set(eq, (counts.get(eq) ?? 0) + 1);
    for (const e of Object.values(exercises)) {
      if (matchesText(e.name, e.primaryMuscle) && (!part || partOf(e.primaryMuscle) === part)) bump(e.equipment);
    }
    for (const e of libPool) {
      if (matchesText(e.n, e.p) && (!part || partOf(e.p) === part)) bump(e.e);
    }
    const opts = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([k]) => k);
    // Never hide an active filter: keep the selected chip visible even with no results.
    return equip && !opts.includes(equip) ? [equip, ...opts] : opts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, libPool, q, part, equip]);

  const grouped = useMemo(() => {
    const list = Object.values(exercises).filter(
      (e) => matchesText(e.name, e.primaryMuscle) && (!part || partOf(e.primaryMuscle) === part) && (!equip || e.equipment === equip),
    );
    const byMuscle = new Map<string, Exercise[]>();
    for (const e of list) {
      const arr = byMuscle.get(e.primaryMuscle);
      if (arr) arr.push(e);
      else byMuscle.set(e.primaryMuscle, [e]);
    }
    return [...byMuscle.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([muscle, exs]) => [muscle, exs.sort((a, b) => a.name.localeCompare(b.name))] as const);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exercises, q, part, equip]);

  const libMatches = useMemo(
    () => libPool.filter((e) => matchesText(e.n, e.p) && (!part || partOf(e.p) === part) && (!equip || e.e === equip)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [libPool, q, part, equip],
  );

  if (creating) {
    return (
      <CustomExerciseForm
        onClose={onClose}
        onBack={() => setCreating(false)}
        onCreate={(fields) => {
          const id = createCustom(fields);
          onPick(id);
          onClose();
        }}
      />
    );
  }

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-12">{title}</div>
      <div className="row gap-8 mb-12" style={{ background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
        <Search size={18} className="muted" />
        <input
          className="grow"
          style={{ background: 'none', border: 'none', color: 'var(--fg)', outline: 'none', fontSize: 15 }}
          placeholder="Search by name or muscle"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
      </div>

      <div className="chip-scroll mb-8">
        <button className={`chip ${part == null ? 'selected' : ''}`} onClick={() => { setPart(null); setEquip(null); }}>All</button>
        {BODY_PARTS.map((b) => (
          <button key={b.key} className={`chip ${part === b.key ? 'selected' : ''}`} onClick={() => { setPart(part === b.key ? null : b.key); setEquip(null); }}>
            {b.label}
          </button>
        ))}
      </div>
      {(equipmentOptions.length > 1 || equip != null) && (
        <div className="chip-scroll mb-16">
          <button className={`chip ${equip == null ? 'selected' : ''}`} onClick={() => setEquip(null)}>Any equipment</button>
          {equipmentOptions.map((eq) => (
            <button key={eq} className={`chip ${equip === eq ? 'selected' : ''}`} onClick={() => setEquip(equip === eq ? null : eq)}>{eq}</button>
          ))}
        </div>
      )}

      <button className="ghost-cta mb-16" onClick={() => setCreating(true)}>
        <Plus size={18} /> Create custom exercise
      </button>

      <div className="stack gap-16">
        {grouped.map(([muscle, exs]) => (
          <div key={muscle}>
            <div className="label-medium muted mb-8">{muscle}</div>
            <div className="stack gap-8">
              {exs.map((e) => (
                <button
                  key={e.id}
                  className="card row-between"
                  style={{ textAlign: 'left', color: 'var(--fg)' }}
                  onClick={() => {
                    onPick(e.id);
                    onClose();
                  }}
                >
                  <div className="stack">
                    <span className="title-small">{e.name}</span>
                    <span className="body-small muted">{e.equipment} · {e.primaryMuscle}</span>
                  </div>
                  <Plus size={18} className="accent" />
                </button>
              ))}
            </div>
          </div>
        ))}

        <div>
          <div className="row-between mb-8">
            <span className="label-medium muted">EXERCISE LIBRARY</span>
            {library && <span className="label-small muted">{libMatches.length} match{libMatches.length === 1 ? '' : 'es'}</span>}
          </div>
          {!library && !libError && <div className="muted body-small pad">Loading library…</div>}
          {libError && (
            <div className="body-small muted">
              Couldn't load the exercise library. <button className="text-link" onClick={fetchLibrary}>Retry</button>
            </div>
          )}
          <div className="stack gap-8">
            {libMatches.slice(0, libLimit).map((e) => (
              <div key={e.i} className="card" style={{ padding: 0 }}>
                <div className="row">
                  <button
                    className="row-between grow"
                    style={{ textAlign: 'left', color: 'var(--fg)', background: 'none', border: 'none', padding: 16 }}
                    onClick={() => {
                      onPick(addLibraryExercise(libraryToExercise(e)));
                      onClose();
                    }}
                  >
                    <div className="stack">
                      <span className="title-small">{e.n}</span>
                      <span className="body-small muted">{e.e} · {e.p}</span>
                    </div>
                    <Plus size={18} className="accent" />
                  </button>
                  {e.c.length > 0 && (
                    <button
                      className="icon-btn bare"
                      style={{ marginRight: 8, color: expanded === e.i ? 'var(--accent-text)' : 'var(--fg3)' }}
                      onClick={() => setExpanded(expanded === e.i ? null : e.i)}
                      aria-label={`How to do ${e.n}`}
                      aria-expanded={expanded === e.i}
                    >
                      <Info size={18} />
                    </button>
                  )}
                </div>
                {expanded === e.i && (
                  <ol className="body-small muted" style={{ margin: 0, padding: '0 16px 16px 34px' }}>
                    {e.c.map((step, i) => <li key={i} style={{ marginBottom: 4 }}>{step}</li>)}
                  </ol>
                )}
              </div>
            ))}
          </div>
          {libMatches.length > libLimit && (
            <button className="ghost-cta mt-12" onClick={() => setLibLimit((n) => n + LIB_PAGE)}>
              Show more ({libMatches.length - libLimit} left)
            </button>
          )}
        </div>

        {grouped.length === 0 && library && libMatches.length === 0 && <div className="muted center pad">No matches.</div>}
      </div>
    </Sheet>
  );
}

function CustomExerciseForm({
  onCreate,
  onBack,
  onClose,
}: {
  onCreate: (fields: Partial<Exercise> & { name: string; primaryMuscle: string }) => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const muscles = useMemo(() => seedMuscles(), []);
  const equipment = useMemo(() => seedEquipment(), []);
  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equip, setEquip] = useState('');
  const [sets, setSets] = useState(3);
  const [low, setLow] = useState(8);
  const [high, setHigh] = useState(12);

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">New exercise</div>
      <div className="stack gap-12">
        <input className="field" placeholder="Exercise name" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        <label className="label-medium muted">Primary muscle</label>
        <select className="field" value={muscle} onChange={(e) => setMuscle(e.target.value)}>
          <option value="" disabled>Select muscle…</option>
          {muscles.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <label className="label-medium muted">Equipment</label>
        <select className="field" value={equip} onChange={(e) => setEquip(e.target.value)}>
          <option value="" disabled>Select equipment…</option>
          {equipment.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <div className="row-between">
          <span className="body-medium">Sets</span>
          <Stepper value={sets} onChange={(v) => setSets(Math.max(1, Math.min(10, v)))} min={1} max={10} mini />
        </div>
        <div className="row-between">
          <span className="body-medium">Rep low</span>
          <Stepper value={low} onChange={(v) => setLow(Math.max(1, Math.min(high, v)))} min={1} max={high} mini />
        </div>
        <div className="row-between">
          <span className="body-medium">Rep high</span>
          <Stepper value={high} onChange={(v) => setHigh(Math.max(low, Math.min(30, v)))} min={low} max={30} mini />
        </div>
      </div>
      <div className="stack gap-8 mt-20">
        <BigCta
          disabled={!name.trim() || !muscle || !equip}
          onClick={() =>
            onCreate({
              name: name.trim(),
              primaryMuscle: muscle,
              equipment: equip,
              defaultSets: sets,
              defaultRepsLow: low,
              defaultRepsHigh: high,
            })
          }
        >
          Create
        </BigCta>
        <GhostCta onClick={onBack}>Back</GhostCta>
      </div>
    </Sheet>
  );
}
