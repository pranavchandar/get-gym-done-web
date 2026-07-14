import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { SPLIT_OPTIONS, CUSTOM_SPLIT_ID } from '../theme/palettes';
import { daysOf, customSplits } from '../store/selectors';
import { TopBar } from '../components/ui';

export function PickSplitScreen() {
  const navigate = useNavigate();
  const state = useStore();
  const activate = useStore((s) => s.activateExistingSplit);
  const [selected, setSelected] = useState<string | null>(null);

  const mine = useMemo(() => customSplits(state), [state]);

  const dayChips = (splitId: string): string[] => {
    return daysOf(state, splitId).map((d) => `D${d.dayNumber} · ${d.isRestDay ? 'Rest' : d.name}`);
  };
  const subLabel = (splitId: string): string => {
    const days = daysOf(state, splitId);
    const trainable = days.filter((d) => !d.isRestDay).length;
    return `${trainable} training days / week`;
  };

  const commit = (fn: () => void) => {
    window.setTimeout(fn, 180);
  };

  const pickTemplate = (id: string) => {
    setSelected(id);
    if (id === CUSTOM_SPLIT_ID) {
      commit(() => navigate('/customize'));
    } else {
      commit(() => navigate(`/routine-method/${id}`));
    }
  };

  const pickMine = (id: string) => {
    setSelected(id);
    commit(() => {
      activate(id);
      navigate('/home');
    });
  };

  return (
    <div className="ob screen">
      <TopBar onBack={() => navigate('/splash')} eyebrow="STEP 1 OF 3" />
      <div className="screen-scroll pad">
        <h1 className="display-small" style={{ margin: '0 0 16px' }}>
          PICK YOUR<br />SPLIT
        </h1>
        <div className="track mb-16">
          <div style={{ width: '33%' }} />
        </div>
        <p className="body-medium muted mb-16">
          The split decides what muscles you train on which day. You can change this anytime.
        </p>

        {mine.length > 0 && (
          <div className="mb-24">
            <div className="label-medium muted mb-12">Your routines</div>
            <div className="stack gap-12">
              {mine.map((sp) => (
                <SplitCard
                  key={sp.id}
                  name={sp.name}
                  sub="Your routine"
                  chips={dayChips(sp.id)}
                  selected={selected === sp.id}
                  onClick={() => pickMine(sp.id)}
                />
              ))}
            </div>
          </div>
        )}

        {mine.length > 0 && <div className="label-medium muted mb-12">Templates</div>}
        <div className="stack gap-12">
          {SPLIT_OPTIONS.map((opt) => {
            if (opt.id === CUSTOM_SPLIT_ID) {
              return (
                <SplitCard
                  key={opt.id}
                  name="Build my own"
                  sub="Assemble your own routine"
                  chips={[]}
                  selected={selected === opt.id}
                  onClick={() => pickTemplate(opt.id)}
                />
              );
            }
            const sp = state.splits[opt.id];
            if (!sp) return null;
            return (
              <SplitCard
                key={opt.id}
                name={sp.name}
                sub={subLabel(opt.id)}
                chips={dayChips(opt.id)}
                badge={opt.badge}
                selected={selected === opt.id}
                onClick={() => pickTemplate(opt.id)}
              />
            );
          })}
        </div>

        <p className="body-small muted center mt-20">Tap a split to continue</p>
      </div>
    </div>
  );
}

function SplitCard({
  name,
  sub,
  chips,
  badge,
  selected,
  onClick,
}: {
  name: string;
  sub: string;
  chips: string[];
  badge?: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`split-card ${selected ? 'selected' : ''}`}
      style={{ textAlign: 'left', width: '100%', color: 'var(--fg)', background: selected ? 'color-mix(in srgb, var(--accent-primary) 12%, var(--surface))' : 'var(--surface)' }}
      onClick={onClick}
    >
      <div className="row-between">
        <div className="row gap-8">
          <span className="headline-small">{name}</span>
          {badge && <span className="badge">{badge}</span>}
        </div>
        <span className={`radio-dot ${selected ? 'on' : ''}`} />
      </div>
      <div className="body-small muted" style={{ marginTop: 4 }}>{sub}</div>
      {chips.length > 0 && (
        <div className="row wrap gap-6" style={{ marginTop: 12 }}>
          {chips.map((c) => (
            <span key={c} className="day-chip">{c}</span>
          ))}
        </div>
      )}
    </button>
  );
}
