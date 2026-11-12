import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '../store/store';
import { kgToDisplay, displayToKg, roundDisplay, displayStep, distanceUnit, kmToDisplay, displayToKm, formatPace, formatDistance } from '../domain/units';
import { loadKind } from '../domain/stats';
import { summarizeSession } from '../domain/summary';
import { compactNumber } from '../domain/metrics';
import { plural, formatSet, formatLoad, formatMinutes, formatSeconds, describeRecord, wantsDistance } from '../domain/format';
import { BAND_LEVELS, REST_SESSION_NOTE } from '../types';
import type { SetLog, SetTag, Exercise, Units, Session } from '../types';
import { TopBar, Sheet, BigCta, GhostCta, Dialog, Stepper } from '../components/ui';
import { Plus, Trash, Note, ChevronRight } from '../components/icons';
import { NoteSheet } from './ActiveWorkout';
import { toast } from '../components/toast';

const TAG_LABEL: Record<SetTag, string> = { warmup: 'Warm-up', top: 'Top set', backoff: 'Back-off' };

/** A finished session, editable after the fact: fix a typo'd set, add a forgotten one, delete it all. */
export function SessionDetailScreen() {
  const navigate = useNavigate();
  const { sessionId = '' } = useParams();
  const state = useStore();
  const unit = state.prefs.units;
  const deleteSession = useStore((s) => s.deleteSession);
  const addSetToSession = useStore((s) => s.addSetToSession);
  const updateSession = useStore((s) => s.updateSession);
  const [editing, setEditing] = useState<SetLog | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);

  const summary = useMemo(() => summarizeSession(state, sessionId), [state, sessionId]);
  const back = () => (window.history.length > 1 ? navigate(-1) : navigate('/home'));

  if (!summary) {
    return (
      <div className="screen">
        <TopBar onBack={() => navigate('/home')} />
        <div className="pad center muted" style={{ paddingTop: 48 }}>This session no longer exists.</div>
      </div>
    );
  }
  const { session, logs } = summary;
  const day = session.workoutDayId ? state.workoutDays[session.workoutDayId] : null;
  const isActivity = !!session.activityType;
  const isRest = session.notes === REST_SESSION_NOTE;
  const imported = !day && !isActivity && session.notes?.startsWith('Imported from');
  const title = isRest ? 'Rest day' : isActivity ? session.activityType ?? 'Activity' : day?.name ?? session.notes?.replace(/^Imported from [^·]+· ?/, '') ?? 'Workout';
  const when = session.completedAt
    ? new Date(session.completedAt).toLocaleString([], { weekday: 'long', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })
    : 'In progress';

  const byExercise = new Map<string, SetLog[]>();
  for (const l of [...logs].sort((a, b) => a.completedAt - b.completedAt)) {
    const arr = byExercise.get(l.exerciseId);
    if (arr) arr.push(l);
    else byExercise.set(l.exerciseId, [l]);
  }
  const recordsByEx = new Map<string, string[]>();
  for (const r of summary.records) {
    if (r.kind === 'e1rm' && state.prefs.show1RM === false) continue;
    const arr = recordsByEx.get(r.exerciseId) ?? [];
    arr.push(describeRecord(r, state.exercises[r.exerciseId], unit));
    recordsByEx.set(r.exerciseId, arr);
  }

  return (
    <div className="screen">
      <TopBar onBack={back} eyebrow={isActivity ? 'ACTIVITY' : isRest ? 'REST' : 'WORKOUT'} />
      <div className="screen-scroll pad stack gap-16" style={{ paddingBottom: 40 }}>
        <div>
          <h1 className="display-small" style={{ margin: 0 }}>{title}</h1>
          <div className="body-small muted mt-8">{when}</div>
          {imported && <div className="body-small muted">{session.notes}</div>}
        </div>

        {isActivity ? (
          <ActivityEditor session={session} unit={unit} />
        ) : !isRest ? (
          <>
            <div className="stat-row">
              <div className="stat-pill">
                <div className="big">{summary.durationMin ? formatMinutes(summary.durationMin) : '—'}</div>
                <div className="label-small muted" style={{ marginTop: 4 }}>Duration</div>
              </div>
              <div className="stat-pill">
                <div className="big">{summary.workingSetCount}</div>
                <div className="label-small muted" style={{ marginTop: 4 }}>{summary.workingSetCount === 1 ? 'Set' : 'Sets'}</div>
              </div>
              <div className="stat-pill">
                <div className="big">{compactNumber(kgToDisplay(summary.volumeKg, unit))}<span className="unit">{unit}</span></div>
                <div className="label-small muted" style={{ marginTop: 4 }}>Volume</div>
              </div>
            </div>

            {!imported && (
              <button className="card row gap-12" style={{ color: 'var(--fg)', textAlign: 'left' }} onClick={() => setNoteOpen(true)}>
                <Note size={18} className="accent" />
                <span className={`body-medium grow min0 ${session.notes ? '' : 'muted'}`} style={{ whiteSpace: 'pre-wrap' }}>{session.notes || 'Add a note'}</span>
                <ChevronRight size={16} className="muted" />
              </button>
            )}

            {[...byExercise.entries()].map(([exId, exLogs]) => {
              const ex = state.exercises[exId];
              const last = exLogs[exLogs.length - 1];
              return (
                <div key={exId} className="card stack gap-8">
                  <div className="row-between gap-8">
                    <span className="title-small min0">{ex?.name ?? 'Exercise'}</span>
                    <span className="body-small muted nowrap">{plural(exLogs.length, 'set')}</span>
                  </div>
                  {(recordsByEx.get(exId) ?? []).map((t) => (
                    <span key={t} className="body-small accent">{t}</span>
                  ))}
                  {exLogs
                    .slice()
                    .sort((a, b) => a.setNumber - b.setNumber)
                    .map((l) => (
                      <button key={l.id} className="set-row" style={{ color: 'var(--fg)', textAlign: 'left', width: '100%' }} onClick={() => setEditing(l)} aria-label={`Edit set ${l.setNumber}`}>
                        <span className="label-medium muted nowrap" style={{ flex: '0 0 46px' }}>SET {l.setNumber}</span>
                        <span className="title-small grow min0">
                          {formatSet(l, ex, unit)}
                          {l.rir != null && <span className="muted body-small"> · {l.rir >= 4 ? '4+' : l.rir} left</span>}
                        </span>
                        {l.tag && <span className="pill pill-outline" style={{ padding: '2px 6px' }}>{l.tag === 'warmup' ? 'W' : l.tag === 'top' ? 'TOP' : 'B-O'}</span>}
                        <ChevronRight size={16} className="muted" />
                      </button>
                    ))}
                  <button
                    className="text-link"
                    style={{ alignSelf: 'flex-start' }}
                    onClick={() => {
                      addSetToSession(session.id, exId, last.weightKg, last.reps);
                      toast('Set added — tap it to change it');
                    }}
                  >
                    <Plus size={14} /> Add set
                  </button>
                </div>
              );
            })}
            {byExercise.size === 0 && <div className="card muted body-medium">No sets in this session.</div>}
          </>
        ) : (
          <p className="body-medium muted" style={{ margin: 0 }}>A rest day logged by an earlier version of the app. Removing it changes nothing else.</p>
        )}

        <button className="ghost-cta" style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }} onClick={() => setConfirmDelete(true)}>
          <Trash size={16} /> Delete {isActivity ? 'activity' : isRest ? 'rest day' : 'workout'}
        </button>
      </div>

      {editing && state.setLogs[editing.id] && (
        <EditSetSheet log={state.setLogs[editing.id]} ex={state.exercises[editing.exerciseId]} unit={unit} onClose={() => setEditing(null)} />
      )}

      {noteOpen && (
        <NoteSheet
          title="Workout note"
          placeholder="How did it go? Sleep, energy, anything to remember next time."
          initial={session.notes ?? ''}
          onClose={() => setNoteOpen(false)}
          onSave={(text) => updateSession(session.id, { notes: text })}
        />
      )}

      {confirmDelete && (
        <Dialog onClose={() => setConfirmDelete(false)}>
          <div className="headline-small mb-8">Delete this {isActivity ? 'activity' : isRest ? 'rest day' : 'workout'}?</div>
          <p className="body-medium muted" style={{ margin: 0 }}>
            {logs.length ? `Its ${plural(logs.length, 'set')} will be deleted too. ` : ''}Your stats and records are recalculated without it. This can't be undone.
          </p>
          <div className="dialog-actions mt-20">
            <button
              className="ghost-cta"
              style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
              onClick={() => {
                deleteSession(session.id);
                setConfirmDelete(false);
                toast('Deleted');
                navigate('/home', { replace: true });
              }}
            >
              Delete
            </button>
            <BigCta style={{ minHeight: 52 }} onClick={() => setConfirmDelete(false)}>Keep it</BigCta>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function EditSetSheet({ log, ex, unit, onClose }: { log: SetLog; ex: Exercise | undefined; unit: Units; onClose: () => void }) {
  const updateSetLog = useStore((s) => s.updateSetLog);
  const deleteSetLog = useStore((s) => s.deleteSetLog);
  const kind = loadKind(ex);
  const timed = kind === 'time';
  const showWeight = kind === 'weight' || kind === 'bodyweight' || (timed && ex?.equipment !== 'Bodyweight');
  const [weight, setWeight] = useState(roundDisplay(kgToDisplay(log.weightKg, unit), unit));
  const [reps, setReps] = useState(log.reps);
  const [band, setBand] = useState(log.band ?? 3);
  const [tag, setTag] = useState<SetTag | null>(log.tag ?? null);
  const [confirm, setConfirm] = useState(false);

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-4">Set {log.setNumber}</div>
      <div className="body-small muted mb-16">{ex?.name ?? 'Exercise'} · was {formatSet(log, ex, unit)}</div>
      <div className="stack gap-12">
        {kind === 'band' && (
          <div className="row wrap gap-6">
            {BAND_LEVELS.map((label, i) => (
              <button key={label} className={`chip ${band === i + 1 ? 'selected' : ''}`} onClick={() => setBand(i + 1)}>{label}</button>
            ))}
          </div>
        )}
        {showWeight && (
          <div className="row-between gap-12">
            <span className="label-small muted">{kind === 'bodyweight' ? 'ADDED (− = ASSISTED)' : 'WEIGHT'}</span>
            <Stepper
              value={weight}
              step={displayStep(unit)}
              min={kind === 'bodyweight' ? -500 : 0}
              onChange={(v) => setWeight(roundDisplay(v, unit))}
              format={(v) => formatLoad(displayToKg(v, unit), ex, unit) || `${v} ${unit}`}
              label="weight"
            />
          </div>
        )}
        <div className="row-between gap-12">
          <span className="label-small muted">{timed ? 'TIME' : 'REPS'}</span>
          <Stepper value={reps} step={timed ? 5 : 1} min={1} max={timed ? 3600 : 99} onChange={setReps} format={(v) => (timed ? formatSeconds(v) : plural(v, 'rep'))} label={timed ? 'seconds' : 'reps'} />
        </div>
        <div className="row wrap gap-6">
          {(['warmup', 'top', 'backoff'] as SetTag[]).map((t) => (
            <button key={t} className={`chip ${tag === t ? 'selected' : ''}`} aria-pressed={tag === t} onClick={() => setTag((c) => (c === t ? null : t))}>{TAG_LABEL[t]}</button>
          ))}
        </div>
      </div>
      <div className="stack gap-8 mt-20">
        <BigCta
          onClick={() => {
            updateSetLog(log.id, { weightKg: showWeight ? displayToKg(weight, unit) : 0, reps, tag, band: kind === 'band' ? band : log.band ?? null });
            onClose();
          }}
        >
          Save
        </BigCta>
        {confirm ? (
          <button
            className="ghost-cta"
            style={{ color: 'var(--coral)', borderColor: 'var(--coral)' }}
            onClick={() => {
              deleteSetLog(log.id);
              onClose();
            }}
          >
            Tap again to delete set {log.setNumber}
          </button>
        ) : (
          <GhostCta onClick={() => setConfirm(true)}>Delete set</GhostCta>
        )}
      </div>
    </Sheet>
  );
}

function ActivityEditor({ session, unit }: { session: Session; unit: Units }) {
  const updateSession = useStore((s) => s.updateSession);
  const [type, setType] = useState(session.activityType ?? '');
  const [duration, setDuration] = useState(session.durationMin != null ? String(session.durationMin) : '');
  const [distance, setDistance] = useState(session.distanceKm != null ? String(Math.round(kmToDisplay(session.distanceKm, unit) * 100) / 100) : '');
  const [notes, setNotes] = useState(session.notes ?? '');
  const showDistance = wantsDistance(type) || session.distanceKm != null;
  const km = Number(distance) > 0 ? displayToKm(Number(distance), unit) : null;
  const durationMin = Number(duration) > 0 ? Math.round(Number(duration) * 10) / 10 : null;
  const dirty =
    type.trim() !== (session.activityType ?? '') ||
    durationMin !== (session.durationMin ?? null) ||
    (showDistance && Math.abs((km ?? 0) - (session.distanceKm ?? 0)) > 1e-6) ||
    (notes.trim() || null) !== (session.notes ?? null);
  const pace = formatPace(durationMin, km, unit);

  return (
    <div className="stack gap-12">
      {(session.durationMin || session.distanceKm) && (
        <div className="body-medium">
          {[session.durationMin ? formatMinutes(session.durationMin) : null, session.distanceKm ? formatDistance(session.distanceKm, unit) : null, formatPace(session.durationMin, session.distanceKm, unit)]
            .filter(Boolean)
            .join(' · ')}
        </div>
      )}
      <input className="field" placeholder="Activity" value={type} onChange={(e) => setType(e.target.value)} />
      <div className="row gap-8">
        <input className="field" inputMode="decimal" placeholder="Duration (min)" value={duration} onChange={(e) => setDuration(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} />
        {showDistance && (
          <input className="field" inputMode="decimal" placeholder={`Distance (${distanceUnit(unit)})`} value={distance} onChange={(e) => setDistance(e.target.value.replace(/[^\d.]/g, '').slice(0, 6))} />
        )}
      </div>
      {pace && <div className="body-small muted">Pace {pace}</div>}
      <textarea className="field" placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <BigCta
        disabled={!type.trim() || !dirty}
        onClick={() => {
          updateSession(session.id, { activityType: type.trim(), durationMin, distanceKm: showDistance ? km : session.distanceKm ?? null, notes });
          toast('Saved');
        }}
      >
        Save changes
      </BigCta>
    </div>
  );
}

