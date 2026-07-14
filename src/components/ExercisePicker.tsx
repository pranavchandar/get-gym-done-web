import { useMemo, useState } from 'react';
import { Sheet, BigCta, GhostCta, Stepper } from './ui';
import { Search, Plus } from './icons';
import { useStore } from '../store/store';
import { seedMuscles, seedEquipment } from '../store/seed';
import type { Exercise } from '../types';

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
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = Object.values(exercises).filter(
      (e) => !q || e.name.toLowerCase().includes(q) || e.primaryMuscle.toLowerCase().includes(q),
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
  }, [exercises, query]);

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
      <div className="row gap-8 mb-16" style={{ background: 'var(--surface2)', border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
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
        {grouped.length === 0 && <div className="muted center pad">No matches.</div>}
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
  const [muscle, setMuscle] = useState(muscles[0] ?? 'Chest');
  const [equip, setEquip] = useState(equipment[0] ?? 'Barbell');
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
          {muscles.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <label className="label-medium muted">Equipment</label>
        <select className="field" value={equip} onChange={(e) => setEquip(e.target.value)}>
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
          disabled={!name.trim()}
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
