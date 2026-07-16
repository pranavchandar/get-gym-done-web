import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { TopBar } from '../components/ui';
import { ArrowRight } from '../components/icons';

export function RoutineMethodScreen() {
  const navigate = useNavigate();
  const { splitId = '' } = useParams();
  const activatePreset = useStore((s) => s.activatePresetSplit);

  return (
    <div className="ob screen">
      <TopBar onBack={() => navigate('/pick-split')} eyebrow="STEP 2 OF 3" />
      <div className="screen-scroll pad">
        <h1 className="display-small" style={{ margin: '0 0 8px' }}>
          HOW DO YOU<br />
          <span className="accent">WANT IT?</span>
        </h1>
        <p className="body-medium muted mb-24">Use the preset as-is, or assemble exercises day-by-day.</p>

        <div className="stack gap-16">
          <MethodCard
            title="Curate for me"
            badge="Recommended"
            body="Use the preset exercises and rep ranges. Ready in one tap."
            onClick={() => {
              activatePreset(splitId);
              navigate('/home');
            }}
          />
          <MethodCard
            title="Build my own"
            badge="Customize"
            body="Start from this split's template and swap exercises day by day."
            onClick={() => navigate(`/customize/${splitId}`)}
          />
        </div>
      </div>
    </div>
  );
}

function MethodCard({
  title,
  badge,
  body,
  onClick,
}: {
  title: string;
  badge: string;
  body: string;
  onClick: () => void;
}) {
  return (
    <button className="card" style={{ textAlign: 'left', color: 'var(--fg)' }} onClick={onClick}>
      <div className="row-between mb-8">
        <span className="headline-small">{title}</span>
        <span className="badge">{badge}</span>
      </div>
      <p className="body-medium muted" style={{ margin: 0 }}>{body}</p>
      <div className="row" style={{ justifyContent: 'flex-end', marginTop: 12, color: 'var(--accent-primary)' }}>
        <ArrowRight size={20} />
      </div>
    </button>
  );
}
