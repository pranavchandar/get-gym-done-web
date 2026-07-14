import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/store';
import { ACCENT_PALETTES } from '../theme/palettes';
import type { ThemeChoice, Units } from '../types';
import { downloadBackup, parseBackup, applyBackup } from '../backup/backup';
import { getToken, setToken, getGistId, getLastSync, pushToGist, pullFromGist, clearGistConfig } from '../sync/gist';
import { BigCta, GhostCta, Dialog } from '../components/ui';
import { Check } from '../components/icons';
import { toast } from '../components/toast';

export function SettingsScreen() {
  const navigate = useNavigate();
  const prefs = useStore((s) => s.prefs);
  const setTheme = useStore((s) => s.setTheme);
  const setUnits = useStore((s) => s.setUnits);
  const setAccent = useStore((s) => s.setAccent);

  const fileRef = useRef<HTMLInputElement>(null);
  const [importData, setImportData] = useState<ReturnType<typeof parseBackup> | null>(null);
  const [pullConfirm, setPullConfirm] = useState<string | null>(null);

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
      </Section>

      {/* Routine */}
      <Section title="Routine">
        <GhostCta onClick={() => navigate('/pick-split')}>Reset routine</GhostCta>
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
              } catch {
                toast('Could not read that file.');
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

      {pullConfirm && (
        <Dialog onClose={() => setPullConfirm(null)}>
          <div className="headline-small mb-8">Pull from cloud?</div>
          <p className="body-medium muted">This replaces ALL current data with the cloud backup. This cannot be undone.</p>
          <div className="row gap-8 mt-20">
            <GhostCta onClick={() => setPullConfirm(null)}>Cancel</GhostCta>
            <BigCta style={{ minHeight: 52 }} onClick={() => {
              try { applyBackup(parseBackup(pullConfirm)); toast('Pulled from cloud'); }
              catch { toast('Cloud data was invalid.'); }
              setPullConfirm(null);
            }}>Replace</BigCta>
          </div>
        </Dialog>
      )}
    </div>
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
        {gistId ? 'Gist connected. ' : 'No gist yet — push to create one. '}
        {lastSync ? `Last sync ${new Date(lastSync).toLocaleString()}.` : 'Never synced.'}
      </div>
    </div>
  );
}
