import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import type { Units } from '../types';
import { BigCta } from '../components/ui';
import { ArrowRight } from '../components/icons';
import { BodyMap } from '../components/BodyMap';

export function SplashScreen() {
  const navigate = useNavigate();
  const units = useStore((s) => s.prefs.units);
  const setUnits = useStore((s) => s.setUnits);
  const onboarded = useStore((s) => s.prefs.onboardingComplete);

  // First visit: start from the unit people use where the phone is set up (pounds in the US,
  // Liberia and Myanmar). The choice below is the user's to change.
  useEffect(() => {
    if (onboarded) return;
    try {
      if (localStorage.getItem(UNITS_GUESSED_KEY)) return;
      localStorage.setItem(UNITS_GUESSED_KEY, '1');
    } catch {
      return;
    }
    setUnits(guessUnits());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ob screen" style={{ minHeight: '100%' }}>
      <div className="screen-scroll pad" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100%' }}>
        <div>
          <div className="row-between">
            <span className="label-medium accent">V1.0 — BETA</span>
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
          <div
            style={{
              background: 'var(--surface)',
              border: '1px solid var(--line)',
              borderRadius: 16,
              height: 180,
              marginBottom: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <BodyMap levels={{ chest: 4, deltoids: 3, quadriceps: 4, 'upper-back': 2, gluteal: 3, triceps: 2 }} height={150} />
          </div>
          <div className="row-between gap-12 mb-16">
            <span className="label-medium muted" id="units-label">WEIGHTS IN</span>
            <div className="seg" role="group" aria-labelledby="units-label" style={{ minWidth: 160 }}>
              {(['lbs', 'kg'] as Units[]).map((u) => (
                <button key={u} className={units === u ? 'active' : ''} aria-pressed={units === u} onClick={() => setUnits(u)}>{u}</button>
              ))}
            </div>
          </div>
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

const UNITS_GUESSED_KEY = 'get-gym-done:units-guessed';

function guessUnits(): Units {
  const langs = typeof navigator !== 'undefined' ? [...(navigator.languages ?? []), navigator.language] : [];
  return langs.some((l) => /-(US|LR|MM)$/i.test(l ?? '')) ? 'lbs' : 'kg';
}
