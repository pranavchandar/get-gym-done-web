import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { displayToKg, kgToDisplay } from '../domain/units';
import { loadOfLogs, levelsOf, rankOf, MUSCLE_LABEL } from '../domain/muscles';
import { BodyMap } from '../components/BodyMap';
import { epochDayLocal, formatDateShort } from '../domain/dates';
import { summarizeSession } from '../domain/summary';
import { compactNumber } from '../domain/metrics';
import { workingSets } from '../domain/stats';
import type { RecordHit } from '../domain/stats';
import { plural, formatMinutes, describeRecord } from '../domain/format';
import { renderShareCard, shareOrDownload } from '../export/shareCard';
import { fileSlug } from '../export/splitExport';
import { BigCta } from '../components/ui';
import { Check, ArrowRight, Share, Note, List } from '../components/icons';
import { NoteSheet } from './ActiveWorkout';
import { toast } from '../components/toast';

export function WorkoutCompleteScreen() {
  const navigate = useNavigate();
  const { sessionId = '' } = useParams();
  const state = useStore();
  const unit = state.prefs.units;
  const show1RM = state.prefs.show1RM !== false;
  const armConfetti = useStore((s) => s.armConfetti);
  const logBodyMetric = useStore((s) => s.logBodyMetric);
  const updateSession = useStore((s) => s.updateSession);
  const [noteOpen, setNoteOpen] = useState(false);
  const [sharing, setSharing] = useState(false);

  const summary = useMemo(() => summarizeSession(state, sessionId), [state, sessionId]);
  const session = summary?.session;
  const day = session?.workoutDayId ? state.workoutDays[session.workoutDayId] : null;
  const logs = summary?.logs ?? [];

  // Records grouped by exercise; an estimated-1RM record is hidden for people who hid 1RMs.
  const records = useMemo(() => {
    const byEx = new Map<string, RecordHit[]>();
    for (const r of summary?.records ?? []) {
      if (r.kind === 'e1rm' && !show1RM) continue;
      const arr = byEx.get(r.exerciseId);
      if (arr) arr.push(r);
      else byEx.set(r.exerciseId, [r]);
    }
    return [...byEx.entries()];
  }, [summary, show1RM]);

  const muscles = useMemo(() => {
    const load = loadOfLogs(workingSets(logs), state.exercises);
    return { levels: levelsOf(load), worked: rankOf(load).worked };
  }, [logs, state.exercises]);

  const today = epochDayLocal(Date.now());
  const todayRow = Object.values(state.bodyMetrics).find((r) => epochDayLocal(r.recordedAt) === today);
  const bwLogged = todayRow && todayRow.bodyweightKg != null;
  const [bwInput, setBwInput] = useState('');

  if (!session || !summary) {
    return (
      <div className="pad center muted" style={{ paddingTop: 64 }}>Session not found.</div>
    );
  }

  const title = day?.name ?? session.notes?.replace(/^Imported from [^·]+· ?/, '') ?? 'Workout';
  const vol = Math.round(kgToDisplay(summary.volumeKg, unit));
  const cmp = summary.comparison;
  const volLabel = cmp ? `${cmp.pct >= 0 ? '+' : ''}${Math.round(cmp.pct)}%` : compactNumber(vol);
  const volSub = 'Volume';

  const backHome = () => {
    if (session.completedAt != null && Date.now() - session.completedAt < 5 * 60_000) armConfetti();
    navigate('/home');
  };

  const share = async () => {
    setSharing(true);
    try {
      const blob = await renderShareCard({
        eyebrow: session.completedAt ? new Date(session.completedAt).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' }) : '',
        title,
        stats: [
          { label: 'Duration', value: summary.durationMin ? formatMinutes(summary.durationMin) : '—' },
          { label: 'Sets', value: String(summary.workingSetCount) },
          { label: `Volume (${unit})`, value: vol.toLocaleString() },
          { label: records.length === 1 ? 'Record' : 'Records', value: String(records.length) },
        ],
        listTitle: records.length ? 'Records' : 'Exercises',
        lines: records.length
          ? records.flatMap(([exId, hits]) => hits.slice(0, 1).map((r) => ({ left: state.exercises[exId]?.name ?? 'Exercise', right: describeRecord(r, state.exercises[exId], unit).split(' · ')[1] })))
          : summary.exerciseIds.map((id) => ({ left: state.exercises[id]?.name ?? 'Exercise', right: plural(workingSets(logs.filter((l) => l.exerciseId === id)).length, 'set') })),
      });
      const d = new Date(session.completedAt ?? Date.now());
      const local = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const result = await shareOrDownload(blob, `${fileSlug(title)}-${local}.png`, `${title} — done.`);
      if (result === 'downloaded') toast('Image saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not create the image.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="screen">
      <div className="screen-scroll pad center stack gap-16" style={{ paddingTop: 40, paddingBottom: 32 }}>
        <div style={{ width: 96, height: 96, flexShrink: 0, alignSelf: 'center', borderRadius: 999, background: 'var(--accent-primary)', color: 'var(--on-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Check size={52} />
        </div>
        <div className="label-medium muted">{day ? `DAY ${day.dayNumber} DONE` : 'WORKOUT DONE'}{session.completedAt ? ` · ${formatDateShort(session.completedAt).toUpperCase()}` : ''}</div>
        <h1 className="display-medium" style={{ margin: 0 }}>
          {title}<br /><span className="accent">LOCKED IN.</span>
        </h1>
        <p className="body-medium muted" style={{ margin: 0 }}>
          {plural(summary.exerciseIds.length, 'exercise')} · {plural(summary.workingSetCount, 'working set')}
          {logs.length > summary.workingSetCount ? ` + ${plural(logs.length - summary.workingSetCount, 'warm-up')}` : ''}
        </p>

        <div className="stat-row" style={{ width: '100%' }}>
          <div className="stat-pill">
            <div className="big">{summary.durationMin ? formatMinutes(summary.durationMin) : '—'}</div>
            <div className="label-small muted" style={{ marginTop: 4 }}>Duration</div>
          </div>
          <div className="stat-pill">
            <div className="big">{records.length}</div>
            <div className="label-small muted" style={{ marginTop: 4 }}>{records.length === 1 ? 'Record' : 'Records'}</div>
          </div>
          <div className="stat-pill" title={cmp ? `Same ${plural(cmp.shared, 'exercise')} as ${formatDateShort(cmp.against.completedAt as number)}` : 'Nothing comparable yet'}>
            <div className="big">{volLabel}{!cmp && <span className="unit">{unit}</span>}</div>
            <div className="label-small muted" style={{ marginTop: 4 }}>{volSub}</div>
          </div>
        </div>
        {cmp && (
          <p className="body-small muted" style={{ margin: '-8px 0 0' }}>
            Volume compared on the {plural(cmp.shared, 'exercise')} you also did on {formatDateShort(cmp.against.completedAt as number)}.
          </p>
        )}

        {records.length > 0 && (
          <div className="card" style={{ width: '100%', textAlign: 'left' }}>
            <div className="label-medium accent mb-8">NEW RECORDS</div>
            <div className="stack gap-10">
              {records.map(([exId, hits]) => (
                <div key={exId} className="stack gap-4">
                  <span className="title-small">{state.exercises[exId]?.name ?? 'Exercise'}</span>
                  {hits.map((r) => (
                    <span key={r.kind} className="body-small muted">{describeRecord(r, state.exercises[exId], unit)}</span>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div className="card" style={{ width: '100%', textAlign: 'left' }}>
            <div className="label-medium muted mb-12">MUSCLES HIT</div>
            <BodyMap levels={muscles.levels} figure={state.prefs.bodyFigure} height={170} label="muscles trained this session" />
            {muscles.worked.length > 0 && (
              <div className="body-small center mt-12">{muscles.worked.slice(0, 5).map((m) => MUSCLE_LABEL[m]).join(' · ')}</div>
            )}
          </div>
        )}

        <div className="row gap-8" style={{ width: '100%' }}>
          {/* An imported workout's note holds its source label; leave it be. */}
          {session.workoutDayId && (
            <button className="ghost-cta grow" onClick={() => setNoteOpen(true)}><Note size={16} /> Note</button>
          )}
          <button className="ghost-cta grow" disabled={sharing} onClick={share}><Share size={16} /> Share</button>
          <button className="ghost-cta grow" onClick={() => navigate(`/session/${session.id}`)}><List size={16} /> Sets</button>
        </div>
        {session.notes && session.workoutDayId && (
          <div className="card body-medium" style={{ width: '100%', textAlign: 'left', whiteSpace: 'pre-wrap' }}>{session.notes}</div>
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

      {noteOpen && (
        <NoteSheet
          title="Workout note"
          placeholder="How did it go? Sleep, energy, anything to remember next time."
          initial={session.workoutDayId ? session.notes ?? '' : ''}
          onClose={() => setNoteOpen(false)}
          onSave={(text) => updateSession(session.id, { notes: text })}
        />
      )}
    </div>
  );
}
