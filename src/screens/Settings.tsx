import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { ACCENT_PALETTES } from '../theme/palettes';
import type { BodyFigure, ThemeChoice, Units } from '../types';
import { wakeLockSupported } from '../domain/wakeLock';
import { parseImport, planImport, SOURCE_LABEL } from '../import/csvImport';
import type { ParsedImport } from '../import/csvImport';
import { loadLibrary } from '../data/library';
import type { LibraryEntry } from '../data/library';
import { formatDateShort } from '../domain/dates';
import { REST_MIN, REST_MAX, REST_STEP } from '../types';
import { downloadBackup, parseBackup, applyBackup } from '../backup/backup';
import { getToken, setToken, getGistId, getLastSync, pushToGist, pullFromGist, clearGistConfig } from '../sync/gist';
import { BigCta, GhostCta, Dialog, Stepper } from '../components/ui';
import { Check } from '../components/icons';
import { toast } from '../components/toast';

export function SettingsScreen() {
  const navigate = useNavigate();
  const prefs = useStore((s) => s.prefs);
  const setTheme = useStore((s) => s.setTheme);
  const setUnits = useStore((s) => s.setUnits);
  const setRestSeconds = useStore((s) => s.setRestSeconds);
  const setAccent = useStore((s) => s.setAccent);
  const setPrefs = useStore((s) => s.setPrefs);
  const keepAwake = prefs.keepAwake !== false;

  const fileRef = useRef<HTMLInputElement>(null);
  const csvRef = useRef<HTMLInputElement>(null);
  const [csvImport, setCsvImport] = useState<{ parsed: ParsedImport; library: LibraryEntry[] | null } | null>(null);
  const [importData, setImportData] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [pullConfirm, setPullConfirm] = useState<string | null>(null);
  const [resetConfirm, setResetConfirm] = useState(false);

  return (
    <div className="pad stack gap-24" style={{ paddingBottom: 40 }}>
      <h1 className="display-small" style={{ margin: 0 }}>SETTINGS</h1>

      {/* Appearance */}
      <Section title="Appearance">
        <div className="label-medium muted mb-8">Theme</div>
        <div className="seg mb-16">
          {(['system', 'light', 'dark'] as ThemeChoice[]).map((t) => (
            <button key={t} className={prefs.theme === t ? 'active' : ''} onClick={() => setTheme(t)}>{t}</button>
          ))}
        </div>
        <div className="label-medium muted mb-8">Accent</div>
        <div className="swatch-grid">
          {ACCENT_PALETTES.map((p) => (
            <button
              key={p.key}
              onClick={() => setAccent(p.key)}
              aria-label={p.label}
              style={{ background: 'none', border: 'none', padding: 0 }}
            >
              <svg width="100%" viewBox="0 0 40 40" style={{ display: 'block' }}>
                <circle cx="20" cy="20" r="18" fill={p.primary} />
                <path d="M20 20 L38 20 A18 18 0 0 1 20 38 Z" fill={p.secondary} />
                {prefs.accent === p.key && <circle cx="20" cy="20" r="19" fill="none" stroke="var(--fg)" strokeWidth="2.5" />}
              </svg>
            </button>
          ))}
        </div>
      </Section>

      {/* Workout */}
      <Section title="Workout">
        <div className="label-medium muted mb-8">Units</div>
        <div className="seg">
          {(['kg', 'lbs'] as Units[]).map((u) => (
            <button key={u} className={prefs.units === u ? 'active' : ''} onClick={() => setUnits(u)}>{u}</button>
          ))}
        </div>
        <div className="label-medium muted mb-8" style={{ marginTop: 16 }}>Default rest between sets</div>
        <Stepper value={prefs.restSeconds} step={REST_STEP} min={REST_MIN} max={REST_MAX} onChange={setRestSeconds} format={(v) => `${v}s`} />
        <button
          className="row-between"
          style={{ width: '100%', background: 'none', border: 'none', color: 'var(--fg)', marginTop: 20, padding: 0 }}
          onClick={() => setPrefs({ keepAwake: !keepAwake })}
          role="switch"
          aria-checked={keepAwake}
        >
          <span className="label-medium">KEEP SCREEN AWAKE DURING WORKOUTS</span>
          <span className={`switch ${keepAwake ? 'on' : ''}`}><span /></span>
        </button>
        <p className="body-small muted" style={{ margin: '6px 0 0' }}>
          {wakeLockSupported()
            ? 'No unlocking your phone between sets. Released as soon as you leave the workout.'
            : "This browser can't keep the screen on, so this setting has no effect here."}
        </p>
        <div className="label-medium muted mb-8" style={{ marginTop: 16 }}>Muscle map figure</div>
        <div className="seg">
          {(['male', 'female'] as BodyFigure[]).map((f) => (
            <button key={f} className={(prefs.bodyFigure ?? 'male') === f ? 'active' : ''} onClick={() => setPrefs({ bodyFigure: f })}>{f}</button>
          ))}
        </div>
      </Section>

      {/* Routine */}
      <Section title="Routine">
        <GhostCta onClick={() => setResetConfirm(true)}>Reset routine</GhostCta>
      </Section>

      {/* Cloud Sync */}
      <Section title="Cloud Sync">
        <CloudSync onPullRequest={(text) => setPullConfirm(text)} />
      </Section>

      {/* Data */}
      <Section title="Data">
        <div className="stack gap-8">
          <GhostCta onClick={() => { downloadBackup('gymdone-backup.json'); toast('Backup downloaded'); }}>Export to JSON</GhostCta>
          <GhostCta onClick={() => fileRef.current?.click()}>Import from JSON</GhostCta>
          <GhostCta onClick={() => csvRef.current?.click()}>Import history from Strong, Hevy or FitNotes</GhostCta>
          <input
            ref={csvRef}
            type="file"
            accept="text/csv,.csv,text/plain"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              try {
                const parsed = parseImport(await file.text());
                if (parsed.sets.length === 0) throw new Error('No completed sets found in that file.');
                // Matching against the library is best-effort; offline we fall back to the catalog.
                const library = await loadLibrary().catch(() => null);
                setCsvImport({ parsed, library });
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not read that file.');
              }
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await file.text();
                setImportData(parseBackup(text));
              } catch (err) {
                toast(err instanceof Error ? err.message : 'Could not read that file.');
              }
              e.target.value = '';
            }}
          />
        </div>
      </Section>

      <p className="body-small muted center">Get Gym Done · web</p>

      {importData && (
        <Dialog onClose={() => setImportData(null)}>
          <div className="headline-small mb-8">Import backup?</div>
          <p className="body-medium muted">This replaces ALL current data with the contents of the file. This cannot be undone.</p>
          <div className="row gap-8 mt-20">
            <GhostCta onClick={() => setImportData(null)}>Cancel</GhostCta>
            <BigCta style={{ minHeight: 52 }} onClick={() => { applyBackup(importData); setImportData(null); toast('Data imported'); }}>Replace</BigCta>
          </div>
        </Dialog>
      )}

      {csvImport && <CsvImportDialog {...csvImport} onClose={() => setCsvImport(null)} />}

      {pullConfirm && (
        <Dialog onClose={() => setPullConfirm(null)}>
          <div className="headline-small mb-8">Pull from cloud?</div>
          <p className="body-medium muted">This replaces ALL current data with the cloud backup. This cannot be undone.</p>
          <div className="row gap-8 mt-20">
            <GhostCta onClick={() => setPullConfirm(null)}>Cancel</GhostCta>
            <BigCta style={{ minHeight: 52 }} onClick={() => {
              try { applyBackup(parseBackup(pullConfirm)); toast('Pulled from cloud'); }
              catch (err) { toast(err instanceof Error ? err.message : 'Cloud data was invalid.'); }
              setPullConfirm(null);
            }}>Replace</BigCta>
          </div>
        </Dialog>
      )}

      {resetConfirm && (
        <Dialog onClose={() => setResetConfirm(false)}>
          <div className="headline-small mb-8">RESET ROUTINE?</div>
          <p className="body-medium muted">Picking a new split will reset your current routine. Any customizations to it will be lost.</p>
          <div className="row gap-8 mt-20">
            <GhostCta onClick={() => setResetConfirm(false)}>Cancel</GhostCta>
            <BigCta style={{ minHeight: 52 }} onClick={() => { setResetConfirm(false); navigate('/pick-split'); }}>Reset</BigCta>
          </div>
        </Dialog>
      )}
    </div>
  );
}

function CsvImportDialog({ parsed, library, onClose }: { parsed: ParsedImport; library: LibraryEntry[] | null; onClose: () => void }) {
  const exercises = useStore((s) => s.exercises);
  const sessions = useStore((s) => s.sessions);
  const importHistory = useStore((s) => s.importHistory);
  const prefUnit = useStore((s) => s.prefs.units);
  const [unit, setUnit] = useState<Units>(prefUnit);

  const plan = useMemo(
    () => planImport(parsed, unit, exercises, new Set(Object.keys(sessions)), library),
    [parsed, unit, exercises, sessions, library],
  );
  const source = SOURCE_LABEL[parsed.source];

  return (
    <Dialog onClose={onClose}>
      <div className="headline-small mb-8">Import from {source}?</div>
      {plan.sessions.length === 0 ? (
        <p className="body-medium muted">
          {plan.duplicateWorkouts > 0 ? 'Every workout in this file has already been imported.' : 'Nothing to import.'}
        </p>
      ) : (
        <div className="stack gap-6 body-medium">
          <div>
            <b>{plan.sessions.length}</b> workout{plan.sessions.length === 1 ? '' : 's'} · <b>{plan.setLogs.length}</b> sets
            {plan.firstAt != null && plan.lastAt != null && (
              <span className="muted"> · {formatDateShort(plan.firstAt)} {new Date(plan.firstAt).getFullYear()} – {formatDateShort(plan.lastAt)} {new Date(plan.lastAt).getFullYear()}</span>
            )}
          </div>
          <div className="body-small muted">
            {plan.matched} exercise{plan.matched === 1 ? '' : 's'} matched{plan.created > 0 ? `, ${plan.created} added as custom exercises` : ''}.
            {plan.duplicateWorkouts > 0 && ` ${plan.duplicateWorkouts} already imported, skipped.`}
            {plan.skipped > 0 && ` ${plan.skipped} row${plan.skipped === 1 ? '' : 's'} without reps (warm-ups, cardio, rest timers) left out.`}
          </div>
          {parsed.needsUnit && (
            <>
              <div className="label-medium muted mt-8">The file doesn't say which unit its weights are in:</div>
              <div className="seg">
                {(['kg', 'lbs'] as Units[]).map((u) => (
                  <button key={u} className={unit === u ? 'active' : ''} onClick={() => setUnit(u)}>{u}</button>
                ))}
              </div>
            </>
          )}
          <p className="body-small muted" style={{ margin: '4px 0 0' }}>
            Imported workouts count toward your stats, records and weight suggestions. Your routine rotation isn't changed, and existing data is kept.
          </p>
        </div>
      )}
      <div className="row gap-8 mt-20">
        <GhostCta onClick={onClose}>Cancel</GhostCta>
        {plan.sessions.length > 0 && (
          <BigCta
            style={{ minHeight: 52 }}
            onClick={() => {
              importHistory({ exercises: plan.newExercises, sessions: plan.sessions, setLogs: plan.setLogs });
              toast(`Imported ${plan.sessions.length} workout${plan.sessions.length === 1 ? '' : 's'} from ${source}`);
              onClose();
            }}
          >
            Import
          </BigCta>
        )}
      </div>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="headline-small mb-12">{title}</div>
      {children}
    </div>
  );
}

function CloudSync({ onPullRequest }: { onPullRequest: (text: string) => void }) {
  const [token, setTokenState] = useState(getToken());
  const [saved, setSaved] = useState(!!getToken());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [lastSync, setLastSync] = useState<number | null>(getLastSync());

  const gistId = getGistId();

  const save = () => {
    setToken(token);
    setSaved(!!token.trim());
    setStatus(token.trim() ? 'Token saved.' : '');
    setError('');
  };

  const doPush = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      await pushToGist();
      setLastSync(getLastSync());
      setStatus('Pushed to cloud.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Push failed.');
    } finally {
      setBusy(false);
    }
  };

  const doPull = async () => {
    setBusy(true);
    setError('');
    setStatus('');
    try {
      const text = await pullFromGist();
      onPullRequest(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Pull failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack gap-12">
      <p className="body-small muted" style={{ margin: 0 }}>
        Sync via a private GitHub Gist. Create a token (classic with <b>gist</b> scope, or fine-grained with Gists read/write) and paste it below.
      </p>
      <input className="field" type="password" placeholder="GitHub personal access token" value={token} onChange={(e) => setTokenState(e.target.value)} />
      <div className="row gap-8">
        <GhostCta onClick={save}>{saved ? 'Update token' : 'Save token'}</GhostCta>
        {saved && (
          <GhostCta onClick={() => { clearGistConfig(); setTokenState(''); setSaved(false); setLastSync(null); setStatus('Disconnected.'); }}>Disconnect</GhostCta>
        )}
      </div>
      {saved && (
        <div className="row gap-8">
          <BigCta style={{ minHeight: 52 }} disabled={busy} onClick={doPush}>Push to cloud</BigCta>
          <GhostCta onClick={doPull}>Pull from cloud</GhostCta>
        </div>
      )}
      {status && <div className="row gap-6 body-small accent"><Check size={14} /> {status}</div>}
      {error && <div className="body-small" style={{ color: 'var(--coral)' }}>{error}</div>}
      <div className="body-small muted">
        {gistId
          ? lastSync
            ? `Gist connected · last sync ${new Date(lastSync).toLocaleString()}.`
            : 'Gist connected.'
          : 'No gist yet — push to create one.'}
      </div>
    </div>
  );
}
