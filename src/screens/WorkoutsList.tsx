import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { activeSplit, activeDays, dayExercisesOf, completedCountForDay } from '../store/selectors';
import { ChevronUp, ChevronDown, ChevronRight, Trash, Plus, Download, FileText, Table, Braces, Swap } from '../components/icons';
import { plural, formatMinutes } from '../domain/format';
import { REST_SESSION_NOTE } from '../types';
import { statsCtx, logsBySession, volumeKg, workingSets } from '../domain/stats';
import { sessionDurationMin } from '../domain/summary';
import { kgToDisplay, formatDistance } from '../domain/units';
import { formatDateShort } from '../domain/dates';
import { Sheet } from '../components/ui';
import { toast } from '../components/toast';
import { exportSplit, buildSplitExport, type ExportFormat } from '../export/splitExport';

export function WorkoutsListScreen() {
  const navigate = useNavigate();
  const state = useStore();
  const moveDay = useStore((s) => s.moveDay);
  const addDay = useStore((s) => s.addDay);
  const removeDay = useStore((s) => s.removeDay);
  const duplicateDay = useStore((s) => s.duplicateDay);

  const split = activeSplit(state);
  const days = useMemo(() => activeDays(state), [state]);
  const [edit, setEdit] = useState(false);
  const [exporting, setExporting] = useState(false);

  if (!split || days.length === 0) {
    return (
      <div className="pad stack gap-12">
        <div className="label-medium muted">ROUTINE</div>
        <h1 className="display-small" style={{ margin: '6px 0 12px' }}>WORKOUTS</h1>
        <div className="card center muted body-medium" style={{ padding: 32 }}>
          No routine set. Pick a split from Settings first.
        </div>
        <HistoryList />
      </div>
    );
  }

  return (
    <div className="pad stack gap-12" style={{ paddingBottom: 32 }}>
      {/* Actions share the eyebrow's line so a long routine name gets the full width. */}
      <div>
        <div className="row-between">
          <div className="label-medium muted">ROUTINE</div>
          <div className="row gap-8">
            {!edit && (
              <button className="chip" onClick={() => setExporting(true)} aria-label="Export routine">
                <Download size={14} /> Export
              </button>
            )}
            <button className="text-link" onClick={() => setEdit((e) => !e)}>{edit ? 'Done' : 'Edit'}</button>
          </div>
        </div>
        <h1 className="display-small" style={{ margin: '6px 0 0' }}>{split.name}</h1>
      </div>

      {days.map((d, i) => {
        const exs = dayExercisesOf(state, d.id);
        const sets = exs.reduce((a, e) => a + e.prescribedSets, 0);
        const done = completedCountForDay(state, d.id);
        const previews = exs.slice(0, 3).map((e) => state.exercises[e.exerciseId]?.name ?? 'Exercise');
        const moreCount = exs.length - 3;
        return (
          <div key={d.id} className="card">
            <div className="row-between">
              <button
                className="row gap-12 grow min0"
                style={{ background: 'none', border: 'none', color: 'var(--fg)', textAlign: 'left', cursor: d.isRestDay || edit ? 'default' : 'pointer' }}
                disabled={d.isRestDay || edit}
                onClick={() => !d.isRestDay && navigate(`/day/${d.id}`)}
              >
                <span className="display-small" style={{ flex: '0 0 34px', color: 'var(--fg3)' }}>{d.dayNumber}</span>
                <div className="stack grow min0">
                  <div className="row gap-8">
                    <span className="title-small">{d.isRestDay ? 'REST' : d.name}</span>
                    {done > 0 && !edit && <span className="pill pill-solid" style={{ padding: '4px 8px' }}>{done}×</span>}
                  </div>
                  <span className="body-small muted">
                    {d.isRestDay ? (edit ? 'Recovery day' : 'Recovery day — rest, eat, sleep') : edit ? plural(exs.length, 'exercise') : `${plural(exs.length, 'exercise')} · ${plural(sets, 'set')} · ${done} completed`}
                  </span>
                </div>
              </button>
              {edit && (
                <div className="row" style={{ gap: 2 }}>
                  <button className="icon-btn bare" style={{ width: 34 }} disabled={i === 0} onClick={() => moveDay(split.id, d.dayNumber, -1)} aria-label="Move day up"><ChevronUp size={18} /></button>
                  <button className="icon-btn bare" style={{ width: 34 }} disabled={i === days.length - 1} onClick={() => moveDay(split.id, d.dayNumber, 1)} aria-label="Move day down"><ChevronDown size={18} /></button>
                  {!d.isRestDay && (
                    <button className="icon-btn bare hide-narrow" style={{ width: 34 }} onClick={() => { duplicateDay(d.id); toast(`${d.name} copied to the end`); }} aria-label="Copy day"><Swap size={16} /></button>
                  )}
                  <button className="icon-btn bare" style={{ width: 34, color: 'var(--coral)' }} onClick={() => { if (!removeDay(d.id)) toast("Can't remove — this day has logged workouts."); }} aria-label="Remove day"><Trash size={16} /></button>
                </div>
              )}
            </div>
            {!d.isRestDay && previews.length > 0 && !edit && (
              <div className="row wrap gap-6 mt-12">
                {previews.map((p, k) => (
                  <span key={k} className="day-chip" style={{ whiteSpace: 'nowrap', maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p}</span>
                ))}
                {moreCount > 0 && <span className="day-chip" style={{ whiteSpace: 'nowrap' }}>+{moreCount} more</span>}
              </div>
            )}
          </div>
        );
      })}

      {edit && (
        <button className="ghost-cta" onClick={() => addDay(split.id, 'New Day')}>
          <Plus size={18} /> Add day
        </button>
      )}

      {!edit && <HistoryList />}

      {exporting && <ExportSheet splitId={split.id} onClose={() => setExporting(false)} />}
    </div>
  );
}

const HISTORY_PAGE = 10;

/** Every finished workout and activity, newest first; tap one to see or fix its sets. */
function HistoryList() {
  const navigate = useNavigate();
  const state = useStore();
  const [limit, setLimit] = useState(HISTORY_PAGE);
  const unit = state.prefs.units;
  const rows = useMemo(() => {
    const ctx = statsCtx(state);
    const by = logsBySession(state.setLogs);
    return Object.values(state.sessions)
      .filter((s) => s.completedAt != null && s.notes !== REST_SESSION_NOTE)
      .sort((a, b) => (b.completedAt as number) - (a.completedAt as number))
      .map((s) => {
        const logs = by.get(s.id) ?? [];
        const day = s.workoutDayId ? state.workoutDays[s.workoutDayId] : null;
        const title = s.activityType ?? day?.name ?? s.notes?.replace(/^Imported from [^·]+· ?/, '') ?? 'Workout';
        const detail = s.activityType
          ? [s.durationMin ? formatMinutes(s.durationMin) : null, s.distanceKm ? formatDistance(s.distanceKm, unit) : null].filter(Boolean).join(' · ') || 'Activity'
          : [plural(workingSets(logs).length, 'set'), `${Math.round(kgToDisplay(volumeKg(logs, ctx), unit)).toLocaleString()} ${unit}`, (() => { const d = sessionDurationMin(s, logs); return d ? formatMinutes(d) : null; })()].filter(Boolean).join(' · ');
        return { id: s.id, at: s.completedAt as number, title, detail };
      });
  }, [state, unit]);

  if (!rows.length) return null;
  return (
    <div className="stack gap-8 mt-12">
      <div className="row-between">
        <span className="headline-small">HISTORY</span>
        <span className="body-small muted">{plural(rows.length, 'session')}</span>
      </div>
      {rows.slice(0, limit).map((r) => (
        <button key={r.id} className="card row-between gap-12" style={{ padding: 14, color: 'var(--fg)', textAlign: 'left' }} onClick={() => navigate(`/session/${r.id}`)}>
          <div className="stack min0">
            <span className="title-small ellipsis">{r.title}</span>
            <span className="body-small muted">{formatDateShort(r.at)}{new Date(r.at).getFullYear() !== new Date().getFullYear() ? ` ${new Date(r.at).getFullYear()}` : ''} · {r.detail}</span>
          </div>
          <ChevronRight size={18} className="muted" />
        </button>
      ))}
      {rows.length > limit && (
        <button className="ghost-cta" onClick={() => setLimit((l) => l + HISTORY_PAGE * 3)}>Show more</button>
      )}
    </div>
  );
}

const FORMATS: { key: ExportFormat; label: string; ext: string; hint: string; Icon: typeof FileText }[] = [
  { key: 'pdf', label: 'PDF', ext: '.pdf', hint: 'Printable sheet — take it to the gym', Icon: FileText },
  { key: 'xlsx', label: 'Excel', ext: '.xlsx', hint: 'Opens in Excel, Numbers or Sheets', Icon: Table },
  { key: 'csv', label: 'CSV', ext: '.csv', hint: 'Plain table for any spreadsheet app', Icon: Table },
  { key: 'json', label: 'JSON', ext: '.json', hint: 'Structured data, including form cues', Icon: Braces },
];

function ExportSheet({ splitId, onClose }: { splitId: string; onClose: () => void }) {
  const state = useStore();
  const summary = useMemo(() => buildSplitExport(state, splitId), [state, splitId]);

  const run = (format: ExportFormat) => {
    try {
      if (exportSplit(state, splitId, format)) {
        toast(`Routine exported as ${format.toUpperCase()}`);
        onClose();
      } else {
        toast('Nothing to export yet.');
      }
    } catch {
      toast(`Couldn't create the ${format.toUpperCase()} file.`);
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-4">EXPORT ROUTINE</div>
      {summary && (
        <div className="body-small muted mb-16">
          {summary.splitName} · {plural(summary.trainingDays, 'training day')} · {plural(summary.totalExercises, 'exercise')} · {plural(summary.totalSets, 'set')}
        </div>
      )}
      <div className="stack gap-8">
        {FORMATS.map(({ key, label, ext, hint, Icon }) => (
          <button key={key} className="card row gap-12" style={{ color: 'var(--fg)', textAlign: 'left' }} onClick={() => run(key)}>
            <Icon size={20} className="accent" />
            <div className="stack grow">
              <span className="title-small">{label} <span className="muted">{ext}</span></span>
              <span className="body-small muted">{hint}</span>
            </div>
            <Download size={16} className="muted" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
