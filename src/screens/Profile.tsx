import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { activeDays, sessionLogs } from '../store/selectors';
import { maxConsecutiveRestDays } from '../domain/rotation';
import { epochDayLocal, todayEpochDay, formatDateShort } from '../domain/dates';
import { totalVolumeKg, compactNumber } from '../domain/metrics';
import { kgToDisplay, formatWeight } from '../domain/units';
import { REST_SESSION_NOTE } from '../types';
import type { SetLog } from '../types';
import { Avatar } from '../components/Avatar';
import { Sparkline, DualSparkline } from '../components/Sparkline';
import { Heatmap } from '../components/Heatmap';
import { TrendArrow, Sheet, BigCta, GhostCta } from '../components/ui';
import { ChevronDown, ChevronUp, Plus } from '../components/icons';
import { ACCENT_PALETTES } from '../theme/palettes';

const RANGES: { key: string; label: string; days: number }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'All', label: 'All', days: Infinity },
];

export function ProfileScreen() {
  const state = useStore();
  const unit = state.prefs.units;
  const setProfile = useStore((s) => s.setProfile);
  const logBodyMetric = useStore((s) => s.logBodyMetric);

  const [range, setRange] = useState('3M');
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loggingBody, setLoggingBody] = useState(false);
  const [prExercise, setPrExercise] = useState<string | null>(null);

  const sessions = Object.values(state.sessions);
  const completedTraining = sessions.filter((s) => s.completedAt != null && s.notes !== REST_SESSION_NOTE);
  const sessionCount = completedTraining.length;

  const totalVolKg = useMemo(() => totalVolumeKg(Object.values(state.setLogs)), [state.setLogs]);

  const now = Date.now();
  const rangeDef = RANGES.find((r) => r.key === range)!;
  const cutoff = rangeDef.days === Infinity ? 0 : now - rangeDef.days * 86400000;

  // body metrics
  const bm = useMemo(() => Object.values(state.bodyMetrics).sort((a, b) => a.recordedAt - b.recordedAt), [state.bodyMetrics]);
  const latestOf = (key: 'bodyweightKg' | 'bodyFatPct' | 'muscleMassKg') => {
    const rows = bm.filter((r) => r[key] != null);
    return { curr: rows.length ? (rows[rows.length - 1][key] as number) : null, prev: rows.length > 1 ? (rows[rows.length - 2][key] as number) : null };
  };
  const weight = latestOf('bodyweightKg');
  const fat = latestOf('bodyFatPct');
  const muscle = latestOf('muscleMassKg');

  const windowSeries = (key: 'bodyweightKg' | 'bodyFatPct' | 'muscleMassKg') => {
    const rows = bm.filter((r) => r[key] != null && r.recordedAt >= cutoff);
    return rows.map((r) => r[key] as number);
  };

  // exercise progression + PRs
  const exerciseSessionData = useMemo(() => {
    const completedSessions = sessions
      .filter((s) => s.completedAt != null)
      .sort((a, b) => (a.completedAt as number) - (b.completedAt as number));
    const byExercise = new Map<string, { at: number; topWeight: number; reps: number }[]>();
    for (const se of completedSessions) {
      const logs = sessionLogs(state, se.id);
      const byEx = new Map<string, SetLog[]>();
      for (const l of logs) {
        const arr = byEx.get(l.exerciseId);
        if (arr) arr.push(l);
        else byEx.set(l.exerciseId, [l]);
      }
      for (const [exId, exLogs] of byEx) {
        let top = exLogs[0];
        for (const l of exLogs) if (l.weightKg > top.weightKg) top = l;
        if (!byExercise.has(exId)) byExercise.set(exId, []);
        byExercise.get(exId)!.push({ at: se.completedAt as number, topWeight: top.weightKg, reps: top.reps });
      }
    }
    return byExercise;
  }, [sessions, state]);

  const progression = useMemo(() => {
    const items: { exId: string; weights: number[]; reps: number[]; total: number }[] = [];
    for (const [exId, arr] of exerciseSessionData) {
      const inWindow = arr.filter((d) => d.at >= cutoff);
      if (inWindow.length >= 2) {
        items.push({ exId, weights: inWindow.map((d) => d.topWeight), reps: inWindow.map((d) => d.reps), total: arr.length });
      }
    }
    return items.sort((a, b) => b.total - a.total);
  }, [exerciseSessionData, cutoff]);

  const prList = useMemo(() => {
    const items: { exId: string; best: number; curve: number[]; total: number }[] = [];
    for (const [exId, arr] of exerciseSessionData) {
      let best = 0;
      const curve: number[] = [];
      for (const d of arr) {
        best = Math.max(best, d.topWeight);
        curve.push(best);
      }
      items.push({ exId, best, curve, total: arr.length });
    }
    return items.sort((a, b) => b.total - a.total);
  }, [exerciseSessionData]);

  // consistency heatmap counts
  const today = todayEpochDay();
  const countMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of Object.values(state.setLogs)) {
      const ed = epochDayLocal(l.completedAt);
      map.set(ed, (map.get(ed) ?? 0) + 1);
    }
    for (const s of sessions) {
      if (s.completedAt == null) continue;
      if (s.notes === REST_SESSION_NOTE || s.activityType) {
        const ed = epochDayLocal(s.completedAt);
        map.set(ed, (map.get(ed) ?? 0) + 1);
      }
    }
    // auto-fill scheduled rest gaps between active days
    const maxGap = maxConsecutiveRestDays(activeDays(state));
    const activeEd = [...map.keys()].filter((ed) => (map.get(ed) ?? 0) > 0).sort((a, b) => a - b);
    for (let i = 1; i < activeEd.length; i++) {
      const a = activeEd[i - 1];
      const b = activeEd[i];
      const empties = b - a - 1;
      if (empties > 0 && empties <= maxGap) {
        for (let ed = a + 1; ed < b; ed++) if (!map.has(ed)) map.set(ed, 1);
      }
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.setLogs, state.sessions]);

  if (sessionCount === 0) {
    return (
      <div className="pad stack gap-16" style={{ paddingBottom: 32 }}>
        <ProfileHeader onEdit={() => setEditing(true)} />
        <div className="card center muted body-medium" style={{ padding: 32 }}>
          Finish a workout to start tracking your numbers.
        </div>
        {editing && <EditProfileSheet onClose={() => setEditing(false)} onSave={setProfile} />}
      </div>
    );
  }

  return (
    <div className="pad stack gap-20" style={{ paddingBottom: 32 }}>
      <ProfileHeader onEdit={() => setEditing(true)} />

      <div className="row gap-8">
        <div className="stat-pill">
          <div className="big">{compactNumber(kgToDisplay(totalVolKg, unit))}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>Total volume</div>
        </div>
        <div className="stat-pill">
          <div className="big">{sessionCount}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>Sessions</div>
        </div>
      </div>

      <div className="seg">
        {RANGES.map((r) => (
          <button key={r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

      {/* Body card */}
      <div className="card">
        <div className="row-between mb-12">
          <button className="row gap-8" style={{ background: 'none', border: 'none', color: 'var(--fg)' }} onClick={() => setBodyExpanded((e) => !e)}>
            <span className="headline-small">BODY</span>
            {bodyExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button className="chip" onClick={() => setLoggingBody(true)}><Plus size={14} /> Log</button>
        </div>
        <div className="row gap-8">
          <BodyStat label="Weight" value={weight.curr != null ? `${formatWeight(weight.curr, unit)}` : '—'} prev={weight.prev} curr={weight.curr} />
          <BodyStat label="Body fat" value={fat.curr != null ? `${fat.curr}%` : '—'} prev={fat.prev} curr={fat.curr} invert />
          <BodyStat label="Muscle" value={muscle.curr != null ? `${formatWeight(muscle.curr, unit)}` : '—'} prev={muscle.prev} curr={muscle.curr} />
        </div>
        {bodyExpanded && (
          <div className="mt-16">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="label-small muted">
                  <td style={{ padding: '6px 4px' }}>Date</td>
                  <td style={{ padding: '6px 4px' }}>Wt</td>
                  <td style={{ padding: '6px 4px' }}>Fat</td>
                  <td style={{ padding: '6px 4px' }}>Musc</td>
                </tr>
              </thead>
              <tbody>
                {[...bm].reverse().map((r) => (
                  <tr key={r.id} className="body-small" style={{ borderTop: '1px solid var(--line)' }}>
                    <td style={{ padding: '6px 4px' }}>{formatDateShort(r.recordedAt)}</td>
                    <td style={{ padding: '6px 4px' }}>{r.bodyweightKg != null ? formatWeight(r.bodyweightKg, unit) : '—'}</td>
                    <td style={{ padding: '6px 4px' }}>{r.bodyFatPct != null ? `${r.bodyFatPct}%` : '—'}</td>
                    <td style={{ padding: '6px 4px' }}>{r.muscleMassKg != null ? formatWeight(r.muscleMassKg, unit) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* metric sparklines */}
      {(['bodyweightKg', 'bodyFatPct', 'muscleMassKg'] as const).map((key) => {
        const series = windowSeries(key);
        if (series.length < 1) return null;
        const label = key === 'bodyweightKg' ? 'Weight' : key === 'bodyFatPct' ? 'Body fat' : 'Muscle';
        const curr = series[series.length - 1];
        const deltaPct = series.length >= 2 && series[0] !== 0 ? ((series[series.length - 1] - series[0]) / series[0]) * 100 : null;
        const display = key === 'bodyFatPct' ? `${curr}%` : formatWeight(curr, unit);
        return (
          <div key={key} className="card">
            <div className="row-between mb-8">
              <span className="title-small">{label}</span>
              <span className="body-small muted">{display}{deltaPct != null ? ` · ${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : ''}</span>
            </div>
            <Sparkline values={key === 'bodyFatPct' ? series : series.map((v) => kgToDisplay(v, unit))} width={320} height={44} />
          </div>
        );
      })}

      {/* exercise progression */}
      {progression.length > 0 && (
        <div>
          <div className="headline-small mb-12">PROGRESSION</div>
          <div className="stack gap-12">
            {progression.map((item) => {
              const ex = state.exercises[item.exId];
              const first = item.weights[0];
              const last = item.weights[item.weights.length - 1];
              const delta = first !== 0 ? ((last - first) / first) * 100 : 0;
              return (
                <div key={item.exId} className="card">
                  <div className="row-between mb-8">
                    <span className="title-small">{ex?.name ?? 'Exercise'}</span>
                    <span className="body-small muted">{formatWeight(last, unit)} {unit} · {delta >= 0 ? '+' : ''}{delta.toFixed(0)}%</span>
                  </div>
                  <DualSparkline
                    primary={item.weights.map((w) => kgToDisplay(w, unit))}
                    secondary={item.reps}
                    width={320}
                    height={48}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* consistency */}
      <div className="card">
        <div className="headline-small mb-12">CONSISTENCY</div>
        <Heatmap count={(ed) => countMap.get(ed) ?? 0} today={today} />
      </div>

      {/* PRs */}
      {prList.length > 0 && (
        <div>
          <div className="headline-small mb-12">PERSONAL RECORDS</div>
          {prExercise && (() => {
            const item = prList.find((p) => p.exId === prExercise);
            if (!item) return null;
            return (
              <div className="card mb-12">
                <div className="row-between mb-8">
                  <span className="title-small">{state.exercises[item.exId]?.name}</span>
                  <span className="body-small accent">{formatWeight(item.best, unit)} {unit}</span>
                </div>
                <Sparkline values={item.curve.map((w) => kgToDisplay(w, unit))} width={320} height={44} />
              </div>
            );
          })()}
          <div className="stack gap-8">
            {prList.map((item) => (
              <button key={item.exId} className="card row-between" style={{ color: 'var(--fg)' }} onClick={() => setPrExercise((p) => (p === item.exId ? null : item.exId))}>
                <span className="title-small">{state.exercises[item.exId]?.name ?? 'Exercise'}</span>
                <span className="title-small accent">{formatWeight(item.best, unit)} {unit}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && <EditProfileSheet onClose={() => setEditing(false)} onSave={setProfile} />}
      {loggingBody && <LogBodySheet unit={unit} onClose={() => setLoggingBody(false)} onSave={logBodyMetric} />}
    </div>
  );
}

function ProfileHeader({ onEdit }: { onEdit: () => void }) {
  const state = useStore();
  const name = state.prefs.handle || 'ATHLETE';
  const sessionCount = Object.values(state.sessions).filter((s) => s.completedAt != null && s.notes !== REST_SESSION_NOTE).length;
  return (
    <div className="row gap-16">
      <Avatar name={name} color={state.prefs.color} photo={state.prefs.avatarPhoto} size={64} />
      <div className="stack grow">
        <span className="headline-medium">{name}</span>
        <span className="body-small muted">{sessionCount} sessions logged</span>
      </div>
      <button className="chip" onClick={onEdit}>Edit</button>
    </div>
  );
}

function BodyStat({ label, value, prev, curr, invert }: { label: string; value: string; prev: number | null; curr: number | null; invert?: boolean }) {
  return (
    <div className="stat-pill">
      <div className="big row" style={{ justifyContent: 'center', gap: 4, fontSize: 22 }}>
        {value}
        {invert ? <TrendArrow prev={curr} curr={prev} /> : <TrendArrow prev={prev} curr={curr} />}
      </div>
      <div className="label-small muted" style={{ marginTop: 4 }}>{label}</div>
    </div>
  );
}

function LogBodySheet({ unit, onClose, onSave }: { unit: 'kg' | 'lbs'; onClose: () => void; onSave: (m: { bodyweightKg?: number | null; bodyFatPct?: number | null; muscleMassKg?: number | null }) => void }) {
  const [w, setW] = useState('');
  const [f, setF] = useState('');
  const [m, setM] = useState('');
  const kg = (v: string) => (v ? (unit === 'lbs' ? Number(v) * 0.45359237 : Number(v)) : null);
  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">Log body metrics</div>
      <div className="stack gap-12">
        <input className="field" inputMode="decimal" placeholder={`Bodyweight (${unit})`} value={w} onChange={(e) => setW(e.target.value.replace(/[^\d.]/g, ''))} />
        <input className="field" inputMode="decimal" placeholder="Body fat %" value={f} onChange={(e) => setF(e.target.value.replace(/[^\d.]/g, ''))} />
        <input className="field" inputMode="decimal" placeholder={`Muscle mass (${unit})`} value={m} onChange={(e) => setM(e.target.value.replace(/[^\d.]/g, ''))} />
      </div>
      <div className="mt-20">
        <BigCta
          disabled={!w && !f && !m}
          onClick={() => {
            onSave({ bodyweightKg: kg(w), bodyFatPct: f ? Number(f) : null, muscleMassKg: kg(m) });
            onClose();
          }}
        >
          Save
        </BigCta>
      </div>
    </Sheet>
  );
}

function EditProfileSheet({ onClose, onSave }: { onClose: () => void; onSave: (p: { handle?: string | null; color?: string | null; avatarPhoto?: string | null }) => void }) {
  const state = useStore();
  const [name, setName] = useState(state.prefs.handle ?? '');
  const [color, setColor] = useState(state.prefs.color ?? ACCENT_PALETTES[0].primary);
  const [photo, setPhoto] = useState<string | null>(state.prefs.avatarPhoto ?? null);

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    try {
      const data = await resizeImage(file, 256);
      setPhoto(data);
    } catch {
      /* ignore */
    }
  };

  return (
    <Sheet onClose={onClose}>
      <div className="headline-small mb-16">Edit profile</div>
      <div className="center mb-16">
        <Avatar name={name || 'ATHLETE'} color={color} photo={photo} size={72} />
      </div>
      <input className="field mb-16" maxLength={20} placeholder="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 20))} />
      <div className="label-medium muted mb-8">Avatar color</div>
      <div className="row wrap gap-8 mb-16">
        {ACCENT_PALETTES.map((p) => (
          <button
            key={p.key}
            onClick={() => { setColor(p.primary); setPhoto(null); }}
            style={{ width: 36, height: 36, borderRadius: 999, background: p.primary, border: color === p.primary && !photo ? '3px solid var(--fg)' : '2px solid var(--line)' }}
            aria-label={p.label}
          />
        ))}
      </div>
      <label className="ghost-cta mb-16" style={{ cursor: 'pointer' }}>
        Upload photo
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
      </label>
      <div className="stack gap-8">
        <BigCta onClick={() => { onSave({ handle: name.trim() || null, color, avatarPhoto: photo }); onClose(); }}>Save</BigCta>
        <GhostCta onClick={onClose}>Cancel</GhostCta>
      </div>
    </Sheet>
  );
}

async function resizeImage(file: File, maxSize: number): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  const w = Math.round(img.width * scale);
  const h = Math.round(img.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', 0.85);
}
