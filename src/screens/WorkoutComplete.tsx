import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { sessionLogs } from '../store/selectors';
import { totalVolumeKg, countPRs } from '../domain/metrics';
import { displayToKg, kgToDisplay, formatWeight } from '../domain/units';
import { bestSetOf } from '../domain/onerm';
import { loadOfLogs, levelsOf, rankOf, MUSCLE_LABEL } from '../domain/muscles';
import { BodyMap } from '../components/BodyMap';
import { epochDayLocal } from '../domain/dates';
import { BigCta } from '../components/ui';
import { Check, ArrowRight } from '../components/icons';

export function WorkoutCompleteScreen() {
  const navigate = useNavigate();
  const { sessionId = '' } = useParams();
  const state = useStore();
  const unit = state.prefs.units;
  const armConfetti = useStore((s) => s.armConfetti);
  const logBodyMetric = useStore((s) => s.logBodyMetric);

  const session = state.sessions[sessionId];
  const day = session?.workoutDayId ? state.workoutDays[session.workoutDayId] : null;
  const logs = useMemo(() => (session ? sessionLogs(state, sessionId) : []), [state, session, sessionId]);

  const exerciseIds = [...new Set(logs.map((l) => l.exerciseId))];
  const setCount = logs.length;

  const { prCount, volLabel, volSub } = useMemo(() => {
    if (!session || session.completedAt == null) return { prCount: 0, volLabel: '—', volSub: 'Vol' };
    const completedAt = session.completedAt;
    // prior max weight per exercise across earlier completed sessions
    const priorMax = new Map<string, number>();
    for (const other of Object.values(state.sessions)) {
      if (other.completedAt == null || other.id === sessionId) continue;
      if (other.completedAt >= completedAt) continue;
      for (const l of sessionLogs(state, other.id)) {
        priorMax.set(l.exerciseId, Math.max(priorMax.get(l.exerciseId) ?? 0, l.weightKg));
      }
    }
    const prCount = countPRs(logs, priorMax);

    let volLabel = '—';
    let volSub = 'Vol';
    if (session.workoutDayId) {
      const thisVol = totalVolumeKg(logs);
      let prior: { at: number; vol: number } | null = null;
      for (const other of Object.values(state.sessions)) {
        if (other.completedAt == null || other.id === sessionId) continue;
        if (other.workoutDayId !== session.workoutDayId) continue;
        if (other.completedAt >= completedAt) continue;
        const v = totalVolumeKg(sessionLogs(state, other.id));
        if (!prior || other.completedAt > prior.at) prior = { at: other.completedAt, vol: v };
      }
      if (!prior || prior.vol === 0) {
        volLabel = `${Math.round(kgToDisplay(thisVol, unit))} ${unit}`;
        volSub = 'Vol · first time';
      } else {
        const pct = ((thisVol - prior.vol) / prior.vol) * 100;
        volLabel = `${pct >= 0 ? '+' : ''}${Math.round(pct)}%`;
        volSub = 'Vol';
      }
    }
    return { prCount, volLabel, volSub };
  }, [state, session, sessionId, logs, unit]);

  const muscles = useMemo(() => {
    const load = loadOfLogs(logs, state.exercises);
    return { levels: levelsOf(load), worked: rankOf(load).worked };
  }, [logs, state.exercises]);

  // Exercises whose best estimated 1RM this session beats every earlier session's.
  const oneRmRecords = useMemo(() => {
    if (!session || session.completedAt == null) return [];
    const completedAt = session.completedAt;
    const earlier = new Set(
      Object.values(state.sessions)
        .filter((o) => o.completedAt != null && o.id !== sessionId && o.completedAt < completedAt)
        .map((o) => o.id),
    );
    const out: { exId: string; est: number; prev: number | null }[] = [];
    for (const exId of new Set(logs.map((l) => l.exerciseId))) {
      const now = bestSetOf(logs.filter((l) => l.exerciseId === exId));
      if (!now) continue;
      const prior = bestSetOf(Object.values(state.setLogs).filter((l) => l.exerciseId === exId && earlier.has(l.sessionId)));
      if (!prior || now.est > prior.est) out.push({ exId, est: now.est, prev: prior?.est ?? null });
    }
    return out;
  }, [state.sessions, state.setLogs, session, sessionId, logs]);

  const today = epochDayLocal(Date.now());
  const todayRow = Object.values(state.bodyMetrics).find((r) => epochDayLocal(r.recordedAt) === today);
  const bwLogged = todayRow && todayRow.bodyweightKg != null;
  const [bwInput, setBwInput] = useState('');

  if (!session) {
    return (
      <div className="pad center muted" style={{ paddingTop: 64 }}>Session not found.</div>
    );
  }

  const backHome = () => {
    if (session?.completedAt != null && Date.now() - session.completedAt < 5 * 60_000) armConfetti();
    navigate('/home');
  };

  return (
    <div className="screen">
      <div className="screen-scroll pad center stack gap-16" style={{ paddingTop: 40, paddingBottom: 32 }}>
        <div style={{ width: 96, height: 96, flexShrink: 0, alignSelf: 'center', borderRadius: 999, background: 'var(--accent-primary)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={52} />
        </div>
        <div className="label-medium muted">{day ? `DAY ${day.dayNumber} DONE` : 'WORKOUT DONE'}</div>
        <h1 className="display-medium" style={{ margin: 0 }}>
          {day?.name ?? 'WORKOUT'}<br /><span className="accent">LOCKED IN.</span>
        </h1>
        <p className="body-medium muted" style={{ margin: 0 }}>
          {exerciseIds.length} exercise{exerciseIds.length === 1 ? '' : 's'} · {setCount} set{setCount === 1 ? '' : 's'} logged.
        </p>

        <div className="row gap-8" style={{ width: '100%' }}>
          <div className="stat-pill">
            <div className="big">{prCount}</div>
            <div className="label-small muted" style={{ marginTop: 4 }}>{prCount === 1 ? 'PR' : 'PRs'}</div>
          </div>
          <div className="stat-pill">
            <div className="big">{volLabel}</div>
            <div className="label-small muted" style={{ marginTop: 4 }}>{volSub}</div>
          </div>
        </div>

        {logs.length > 0 && (
          <div className="card" style={{ width: '100%', textAlign: 'left' }}>
            <div className="label-medium muted mb-12">MUSCLES HIT</div>
            <BodyMap levels={muscles.levels} figure={state.prefs.bodyFigure} height={170} label="muscles trained this session" />
            {muscles.worked.length > 0 && (
              <div className="body-small center mt-12">{muscles.worked.slice(0, 5).map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
            )}
          </div>
        )}

        {oneRmRecords.length > 0 && (
          <div className="card" style={{ width: '100%', textAlign: 'left' }}>
            <div className="label-medium accent mb-8">NEW ESTIMATED 1RM</div>
            <div className="stack gap-6">
              {oneRmRecords.map((r) => (
                <div key={r.exId} className="row-between body-medium">
                  <span>{state.exercises[r.exId]?.name ?? 'Exercise'}</span>
                  <span className="title-small">
                    {formatWeight(r.est, unit)} {unit}
                    {r.prev != null && <span className="body-small muted"> · was {formatWeight(r.prev, unit)}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="card" style={{ width: '100%', textAlign: 'left' }}>
          {bwLogged ? (
            <div className="row gap-8"><Check size={18} className="accent" /><span className="title-small">Bodyweight logged</span></div>
          ) : (
            <>
              <div className="label-medium muted mb-8">{todayRow ? "UPDATE TODAY'S BODYWEIGHT" : "LOG TODAY'S BODYWEIGHT"}</div>
              <div className="row gap-8">
                <input
                  className="field grow"
                  inputMode="decimal"
                  placeholder={`Weight (${unit})`}
                  value={bwInput}
                  onChange={(e) => setBwInput(e.target.value.replace(/[^\d.]/g, ''))}
                />
                <button
                  className="big-cta"
                  style={{ width: 'auto', minHeight: 52, padding: '0 24px' }}
                  disabled={!bwInput || Number.isNaN(Number(bwInput))}
                  onClick={() => {
                    logBodyMetric({ bodyweightKg: displayToKg(Number(bwInput), unit) });
                    setBwInput('');
                  }}
                >
                  Log
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="pad">
        <BigCta onClick={backHome}>Back home <ArrowRight size={22} /></BigCta>
      </div>
    </div>
  );
}
