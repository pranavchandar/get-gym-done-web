import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { resolveTheme } from '../theme/apply';
import { StripedPlaceholder, BigCta } from '../components/ui';
import { ArrowRight } from '../components/icons';

export function SplashScreen() {
  const navigate = useNavigate();
  const theme = useStore((s) => s.prefs.theme);
  const setTheme = useStore((s) => s.setTheme);
  const isDark = resolveTheme(theme) === 'dark';

  return (
    <div className="ob screen" style={{ minHeight: '100%' }}>
      <div className="screen-scroll pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh' }}>
        <div>
          <div className="row-between">
            <span className="label-medium accent">V1.0 — BETA</span>
            <button
              className="row gap-8"
              style={{ background: 'none', border: 'none', color: 'var(--fg2)' }}
              onClick={() => setTheme(isDark ? 'light' : 'dark')}
            >
              <span className="label-small">{isDark ? 'DARK' : 'LIGHT'}</span>
              <span className={`switch ${isDark ? 'on' : ''}`}>
                <span />
              </span>
            </button>
          </div>

          <h1 style={{ fontFamily: 'Anton', fontSize: 88, lineHeight: '80px', letterSpacing: 1, margin: '28px 0 0', textTransform: 'uppercase' }}>
            <span style={{ color: 'var(--fg)' }}>GET<br />GYM<br /></span>
            <span className="accent">DONE.</span>
          </h1>

          <p className="body-large muted" style={{ marginTop: 20, maxWidth: 320 }}>
            A logbook that knows what day it is, what's next, and how strong you're getting.
          </p>
        </div>

        <div className="mt-32">
          <StripedPlaceholder label="hero — athlete" style={{ height: 180, marginBottom: 24 }} />
          <BigCta onClick={() => navigate('/pick-split')}>
            Get started <ArrowRight size={22} />
          </BigCta>
          <p className="body-small muted center" style={{ marginTop: 14 }}>
            No accounts. Your data stays in this browser — export or sync to the cloud anytime.
          </p>
        </div>
      </div>
    </div>
  );
}
