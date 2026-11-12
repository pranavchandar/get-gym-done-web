import { useMemo, useState } from 'react';
import { useStore } from '../store/store';
import { activeDays } from '../store/selectors';
import { epochDayLocal, todayEpochDay, formatDateShort } from '../domain/dates';
import { compactNumber } from '../domain/metrics';
import { kgToDisplay, formatWeight, pillNumber } from '../domain/units';
import { trainingEpochDays, weeklyTargetFor, weekStreak } from '../domain/schedule';
import { statsCtx, volumeKg, trainingSessions, logsBySession, exerciseBests, workingSets, setLoadKg } from '../domain/stats';
import type { ExerciseBests } from '../domain/stats';
import { plural, formatSet, formatSeconds } from '../domain/format';
import { REST_SESSION_NOTE } from '../types';
import type { Units, Exercise } from '../types';
import { Avatar } from '../components/Avatar';
import { TrendChart } from '../components/TrendChart';
import type { TrendPoint } from '../components/TrendChart';
import { Heatmap } from '../components/Heatmap';
import { TrendArrow, Sheet, BigCta, GhostCta } from '../components/ui';
import { ChevronDown, ChevronUp, Plus } from '../components/icons';
import { ACCENT_PALETTES } from '../theme/palettes';
import { MuscleBalanceCard } from '../components/MuscleBalance';
import { OneRmSection } from '../components/OneRm';
import { LogBodySheet, GoalSheet } from '../components/BodySheets';

const RANGES: { key: string; label: string; days: number }[] = [
  { key: '1M', label: '1M', days: 30 },
  { key: '3M', label: '3M', days: 90 },
  { key: '6M', label: '6M', days: 180 },
  { key: '1Y', label: '1Y', days: 365 },
  { key: 'All', label: 'All', days: Infinity },
];

type BodyKey = 'bodyweightKg' | 'bodyFatPct' | 'muscleMassKg';

/** "+2.4 lbs", "−1.1 pts": a change in the metric's own unit, never a percent of a percent. */
function signed(v: number, suffix: string): string {
  const r = Math.round(v * 10) / 10;
  if (r === 0) return `±0 ${suffix}`;
  return `${r > 0 ? '+' : '−'}${Math.abs(r)} ${suffix}`;
}

export function ProfileScreen() {
  const state = useStore();
  const unit = state.prefs.units;
  const setProfile = useStore((s) => s.setProfile);
  const logBodyMetric = useStore((s) => s.logBodyMetric);
  const setPrefs = useStore((s) => s.setPrefs);
  const goalKg = state.prefs.goalWeightKg ?? null;
  const show1RM = state.prefs.show1RM !== false;
  const [goalOpen, setGoalOpen] = useState(false);

  const [range, setRange] = useState('3M');
  const [bodyExpanded, setBodyExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [loggingBody, setLoggingBody] = useState(false);
  const [prExercise, setPrExercise] = useState<string | null>(null);

  const ctx = useMemo(() => statsCtx(state), [state]);
  const sessionsAsc = useMemo(() => trainingSessions(state.sessions), [state.sessions]);
  const bySession = useMemo(() => logsBySession(state.setLogs), [state.setLogs]);
  const sessionCount = sessionsAsc.length;

  const today = todayEpochDay();
  const trainingDays = useMemo(() => trainingEpochDays(state.sessions, state.workoutDays, today), [state.sessions, state.workoutDays, today]);
  const streak = weekStreak(trainingDays, weeklyTargetFor(state.prefs, activeDays(state)), today);

  const totalVolKg = useMemo(() => volumeKg(Object.values(state.setLogs), ctx), [state.setLogs, ctx]);

  const now = Date.now();
  const rangeDef = RANGES.find((r) => r.key === range)!;
  const cutoff = rangeDef.days === Infinity ? 0 : now - rangeDef.days * 86400000;

  // body metrics
  const bm = useMemo(() => Object.values(state.bodyMetrics).sort((a, b) => a.recordedAt - b.recordedAt), [state.bodyMetrics]);
  const latestOf = (key: BodyKey) => {
    const rows = bm.filter((r) => r[key] != null);
    return { curr: rows.length ? (rows[rows.length - 1][key] as number) : null, prev: rows.length > 1 ? (rows[rows.length - 2][key] as number) : null };
  };
  const weight = latestOf('bodyweightKg');
  const fat = latestOf('bodyFatPct');
  const muscle = latestOf('muscleMassKg');

  const windowSeries = (key: BodyKey): TrendPoint[] =>
    bm.filter((r) => r[key] != null && r.recordedAt >= cutoff).map((r) => ({ at: r.recordedAt, value: r[key] as number }));

  // per-exercise bests and the sessions they came from
  const bests = useMemo(() => exerciseBests(sessionsAsc, bySession, ctx), [sessionsAsc, bySession, ctx]);

  // exercise progression: the top working set of each session in the window
  const progression = useMemo(() => {
    const items: { exId: string; points: TrendPoint[]; byLoad: boolean; total: number }[] = [];
    const per = new Map<string, { at: number; load: number | null; reps: number }[]>();
    for (const se of sessionsAsc) {
      const byEx = new Map<string, { load: number | null; reps: number }>();
      for (const l of workingSets(bySession.get(se.id) ?? [])) {
        const load = setLoadKg(l, ctx);
        const cur = byEx.get(l.exerciseId);
        const better = !cur || (load != null && (cur.load == null || load > cur.load || (load === cur.load && l.reps > cur.reps))) || (load == null && cur.load == null && l.reps > cur.reps);
        if (better) byEx.set(l.exerciseId, { load, reps: l.reps });
      }
      for (const [exId, top] of byEx) {
        const arr = per.get(exId);
        const row = { at: se.completedAt as number, ...top };
        if (arr) arr.push(row);
        else per.set(exId, [row]);
      }
    }
    for (const [exId, arr] of per) {
      const inWindow = arr.filter((d) => d.at >= cutoff);
      if (inWindow.length < 2) continue;
      const byLoad = inWindow.every((d) => d.load != null);
      items.push({
        exId,
        byLoad,
        total: arr.length,
        points: inWindow.map((d) => ({ at: d.at, value: byLoad ? kgToDisplay(d.load as number, unit) : d.reps })),
      });
    }
    return items.sort((a, b) => b.total - a.total);
  }, [sessionsAsc, bySession, ctx, cutoff, unit]);

  const prList = useMemo(() => [...bests].sort((a, b) => b.sessions - a.sessions), [bests]);

  // consistency heatmap counts
  const countMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const l of Object.values(state.setLogs)) {
      const ed = epochDayLocal(l.completedAt);
      map.set(ed, (map.get(ed) ?? 0) + 1);
    }
    for (const s of Object.values(state.sessions)) {
      if (s.completedAt == null) continue;
      if (s.notes === REST_SESSION_NOTE || s.activityType) {
        const ed = epochDayLocal(s.completedAt);
        map.set(ed, (map.get(ed) ?? 0) + 1);
      }
    }
    // Only days with real logged data are filled in. Painting the scheduled rest
    // gaps between them would show activity on days nothing was recorded.
    return map;
  }, [state.setLogs, state.sessions]);

  const bodyFormat = (key: BodyKey) => (v: number) => (key === 'bodyFatPct' ? `${pillNumber(v)}%` : `${pillNumber(v)} ${unit}`);

  return (
    <div className="pad stack gap-20" style={{ paddingBottom: 32 }}>
      <ProfileHeader onEdit={() => setEditing(true)} />

      <div className="stat-row">
        <div className="stat-pill">
          <div className="big">{compactNumber(kgToDisplay(totalVolKg, unit))}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>{`Total volume (${unit})`}</div>
        </div>
        <div className="stat-pill">
          <div className="big">{sessionCount}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>{sessionCount === 1 ? 'Session' : 'Sessions'}</div>
        </div>
      </div>
      <div className="stat-row">
        <div className="stat-pill" title={`Weeks in a row with at least ${plural(streak.target, 'training day')}.`}>
          <div className="big">{streak.current > 0 ? <>{streak.current}<span className="unit">wk</span></> : '—'}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>{streak.lost ? 'Streak lost' : 'Week streak'}</div>
        </div>
        <div className="stat-pill">
          <div className="big">{streak.longest > 0 ? <>{streak.longest}<span className="unit">wk</span></> : '—'}</div>
          <div className="label-small muted" style={{ marginTop: 4 }}>Longest streak</div>
        </div>
      </div>

      {sessionCount === 0 && (
        <div className="card center muted body-medium" style={{ padding: 20 }}>
          Finish a workout to start tracking your strength numbers. Body metrics can be logged anytime below.
        </div>
      )}

      <div className="seg">
        {RANGES.map((r) => (
          <button key={r.key} className={range === r.key ? 'active' : ''} onClick={() => setRange(r.key)}>{r.label}</button>
        ))}
      </div>

      {/* Body card */}
      <div className="card">
        <div className="row-between wrap gap-8 mb-12">
          <button className="row gap-8" style={{ background: 'none', border: 'none', color: 'var(--fg)' }} onClick={() => setBodyExpanded((e) => !e)} aria-expanded={bodyExpanded}>
            <span className="headline-small">BODY</span>
            {bodyExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <div className="row gap-6">
            <button className="chip" onClick={() => setGoalOpen(true)}>{goalKg != null ? `Goal ${formatWeight(goalKg, unit)} ${unit}` : 'Set goal'}</button>
            <button className="chip" onClick={() => setLoggingBody(true)}><Plus size={14} /> Log</button>
          </div>
        </div>
        <div className="stat-row">
          <BodyStat label="Weight" value={weight.curr != null ? pillNumber(kgToDisplay(weight.curr, unit)) : '—'} suffix={weight.curr != null ? unit : ''} prev={weight.prev} curr={weight.curr} goodDirection={goalKg == null || weight.prev == null ? 'none' : goalKg < weight.prev ? 'down' : 'up'} />
          <BodyStat label="Fat" value={fat.curr != null ? pillNumber(fat.curr) : '—'} suffix={fat.curr != null ? '%' : ''} prev={fat.prev} curr={fat.curr} goodDirection="down" />
          <BodyStat label="Muscle" value={muscle.curr != null ? pillNumber(kgToDisplay(muscle.curr, unit)) : '—'} suffix={muscle.curr != null ? unit : ''} prev={muscle.prev} curr={muscle.curr} goodDirection="up" />
        </div>
        {bodyExpanded && bm.length === 0 && (
          <div className="center muted body-small mt-16">No entries yet — tap + Log to record your first weigh-in.</div>
        )}
        {bodyExpanded && bm.length > 0 && (
          <div className="mt-16">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr className="label-small muted">
                  <td style={{ padding: '6px 4px' }}>Date</td>
                  <td style={{ padding: '6px 4px' }}>{`Wt (${unit})`}</td>
                  <td style={{ padding: '6px 4px' }}>Fat</td>
                  <td style={{ padding: '6px 4px' }}>{`Musc (${unit})`}</td>
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

      {/* body metric trends */}
      {(['bodyweightKg', 'bodyFatPct', 'muscleMassKg'] as const).map((key) => {
        const raw = windowSeries(key);
        if (raw.length < 1) return null;
        const series = key === 'bodyFatPct' ? raw : raw.map((p) => ({ at: p.at, value: kgToDisplay(p.value, unit) }));
        const label = key === 'bodyweightKg' ? 'Weight' : key === 'bodyFatPct' ? 'Body fat' : 'Muscle';
        const curr = series[series.length - 1].value;
        // Body fat moves in percentage points; weight and muscle in the user's unit.
        const change = series.length >= 2 ? signed(curr - series[0].value, key === 'bodyFatPct' ? 'pts' : unit) : null;
        const goal = key === 'bodyweightKg' && goalKg != null ? kgToDisplay(goalKg, unit) : null;
        const toGoal = goal != null ? Math.abs(curr - goal) : null;
        const fmt = bodyFormat(key);
        return (
          <div key={key} className="card">
            <div className="row-between wrap mb-8" style={{ gap: '2px 8px' }}>
              <span className="title-small">{label}</span>
              <span className="body-small muted nowrap">{fmt(curr)}{change ? ` · ${change} in ${rangeDef.key === 'All' ? 'total' : rangeDef.label}` : ''}</span>
            </div>
            <TrendChart
              points={series}
              format={fmt}
              goal={goal}
              average={key === 'bodyweightKg' && series.length >= 5}
              seriesLabel="Weigh-ins"
              label={`${label} over time`}
            />
            {goal != null && toGoal != null && (
              <div className="body-small muted mt-8">
                {toGoal < 0.05 ? 'At your goal weight.' : `${pillNumber(toGoal)} ${unit} to your ${pillNumber(goal)} ${unit} goal (dashed line).`}
              </div>
            )}
          </div>
        );
      })}

      {/* consistency */}
      <div className="card">
        <div className="headline-small mb-12">CONSISTENCY</div>
        <Heatmap count={(ed) => countMap.get(ed) ?? 0} today={today} />
      </div>

      <MuscleBalanceCard />

      {/* exercise progression */}
      {progression.length > 0 && (
        <div>
          <div className="headline-small mb-12">PROGRESSION</div>
          <div className="stack gap-12">
            {progression.map((item) => {
              const ex = state.exercises[item.exId];
              const first = item.points[0].value;
              const last = item.points[item.points.length - 1].value;
              const timed = ex?.timed;
              const fmt = (v: number) => (item.byLoad ? `${pillNumber(v)} ${unit}` : timed ? formatSeconds(v) : plural(Math.round(v), 'rep'));
              const delta = item.byLoad ? signed(last - first, unit) : timed ? signed(last - first, 's') : signed(last - first, 'reps');
              return (
                <div key={item.exId} className="card">
                  <div className="row-between wrap mb-8" style={{ gap: '2px 8px' }}>
                    <span className="title-small min0">{ex?.name ?? 'Exercise'}</span>
                    <span className="body-small muted nowrap">{fmt(last)} · {delta}</span>
                  </div>
                  <TrendChart points={item.points} format={fmt} height={120} label={`${ex?.name ?? 'Exercise'}: top set per session`} />
                  <div className="body-small muted mt-8" style={{ fontSize: 11 }}>
                    {item.byLoad ? (ex && (ex.equipment === 'Bodyweight' || ex.equipment === 'Weighted' || ex.equipment === 'Assisted') ? 'Top set load per session, bodyweight included.' : 'Top set weight per session.') : timed ? 'Longest hold per session.' : 'Most reps per session.'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* PRs — tapping one opens its record line in place */}
      {prList.length > 0 && (
        <div>
          <div className="headline-small mb-12">PERSONAL RECORDS</div>
          <div className="stack gap-8">
            {prList.map((item) => (
              <RecordRow
                key={item.exerciseId}
                item={item}
                ex={state.exercises[item.exerciseId]}
                unit={unit}
                show1RM={show1RM}
                open={prExercise === item.exerciseId}
                onToggle={() => setPrExercise((p) => (p === item.exerciseId ? null : item.exerciseId))}
              />
            ))}
          </div>
        </div>
      )}

      {sessionCount > 0 && show1RM && <OneRmSection />}

      {editing && <EditProfileSheet onClose={() => setEditing(false)} onSave={setProfile} />}
      {loggingBody && <LogBodySheet unit={unit} onClose={() => setLoggingBody(false)} onSave={logBodyMetric} />}
      {goalOpen && <GoalSheet unit={unit} goalKg={goalKg} onClose={() => setGoalOpen(false)} onSave={(g) => setPrefs({ goalWeightKg: g })} />}
    </div>
  );
}

function RecordRow({
  item,
  ex,
  unit,
  show1RM,
  open,
  onToggle,
}: {
  item: ExerciseBests;
  ex: Exercise | undefined;
  unit: Units;
  show1RM: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const byLoad = item.kind !== 'time' && item.kind !== 'band' && item.heaviest != null;
  const headline = item.kind === 'time'
    ? item.mostReps ? `${formatSeconds(item.mostReps.reps)} hold` : '—'
    : byLoad && item.heaviest
    ? `${formatWeight(item.heaviest.loadKg, unit)} ${unit}`
    : item.mostReps
    ? formatSet(item.mostReps, ex, unit)
    : '—';
  const fmt = (v: number) => (byLoad ? `${pillNumber(v)} ${unit}` : item.kind === 'time' ? formatSeconds(v) : plural(Math.round(v), 'rep'));
  const curve = item.curve.map((c) => ({ at: c.at, value: byLoad ? kgToDisplay(c.value, unit) : c.value }));
  return (
    <div className="card stack">
      {/* The whole card row is the target, not just the text line. */}
      <button className="row-between gap-12" style={{ width: 'calc(100% + 32px)', margin: '-16px', padding: 16, background: 'none', border: 'none', color: 'var(--fg)', textAlign: 'left' }} onClick={onToggle} aria-expanded={open}>
        <span className="title-small min0">{ex?.name ?? 'Exercise'}</span>
        <span className="title-small accent nowrap">{headline}</span>
      </button>
      {open && (
        <div className="stack gap-6 mt-8" style={{ width: '100%' }}>
          {item.heaviest && item.kind !== 'time' && (
            <span className="body-small muted">
              Heaviest: {formatSet(item.heaviest.log, ex, unit)}{item.kind === 'bodyweight' ? ` (${formatWeight(item.heaviest.loadKg, unit)} ${unit} with bodyweight)` : ''} · {formatDateShort(item.heaviest.log.completedAt)}
            </span>
          )}
          {item.mostReps && item.kind !== 'time' && (
            <span className="body-small muted">Most reps: {formatSet(item.mostReps, ex, unit)} · {formatDateShort(item.mostReps.completedAt)}</span>
          )}
          {show1RM && item.e1rm && (
            <span className="body-small muted">Estimated 1RM: {formatWeight(item.e1rm.est, unit)} {unit}</span>
          )}
          {curve.length > 1 && <TrendChart points={curve} format={fmt} height={110} label={`${ex?.name ?? 'Exercise'} record over time`} />}
        </div>
      )}
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
      <div className="stack grow min0">
        <span className="headline-medium">{name}</span>
        <span className="body-small muted">{plural(sessionCount, 'session')} logged</span>
      </div>
      <button className="chip" onClick={onEdit}>Edit</button>
    </div>
  );
}

function BodyStat({
  label,
  value,
  suffix,
  prev,
  curr,
  goodDirection,
}: {
  label: string;
  value: string;
  suffix?: string;
  prev: number | null;
  curr: number | null;
  goodDirection?: 'up' | 'down' | 'none';
}) {
  return (
    <div className="stat-pill">
      <div className="big row" style={{ justifyContent: 'center', gap: 4, fontSize: 'clamp(17px, 5.4vw, 22px)' }}>
        <span>{value}{suffix && <span className="unit">{suffix}</span>}</span>
        <TrendArrow prev={prev} curr={curr} goodDirection={goodDirection} />
      </div>
      <div className="label-small muted" style={{ marginTop: 4 }}>{label}</div>
    </div>
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
      <div className="mb-16">
        <input className="field" maxLength={40} placeholder="Name" value={name} onChange={(e) => setName(e.target.value.slice(0, 40))} />
        {name.length >= 30 && (
          <div className="body-small muted" style={{ marginTop: 4, textAlign: 'right' }}>{name.length}/40</div>
        )}
      </div>
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
