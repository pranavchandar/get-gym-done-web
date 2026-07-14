import { serializeBackup } from '../backup/backup';

const TOKEN_KEY = 'get-gym-done:gist-token';
const GIST_ID_KEY = 'get-gym-done:gist-id';
const LAST_SYNC_KEY = 'get-gym-done:last-sync';
const GIST_FILENAME = 'get-gym-done-backup.json';
const API = 'https://api.github.com';

export function getToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? '';
}
export function setToken(token: string): void {
  const t = token.trim();
  if (t) localStorage.setItem(TOKEN_KEY, t);
  else localStorage.removeItem(TOKEN_KEY);
}
export function getGistId(): string {
  return localStorage.getItem(GIST_ID_KEY) ?? '';
}
export function setGistId(id: string): void {
  if (id) localStorage.setItem(GIST_ID_KEY, id);
  else localStorage.removeItem(GIST_ID_KEY);
}
export function getLastSync(): number | null {
  const v = localStorage.getItem(LAST_SYNC_KEY);
  return v ? Number(v) : null;
}
function markSynced(): void {
  localStorage.setItem(LAST_SYNC_KEY, String(Date.now()));
}
export function clearGistConfig(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(GIST_ID_KEY);
  localStorage.removeItem(LAST_SYNC_KEY);
}
export function isConfigured(): boolean {
  return !!getToken();
}

function headers(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'X-GitHub-Api-Version': '2022-11-28',
  };
}

async function ghError(res: Response): Promise<never> {
  let msg = `${res.status} ${res.statusText}`;
  try {
    const body = await res.json();
    if (body && body.message) msg = body.message;
  } catch {
    /* ignore */
  }
  throw new Error(msg);
}

/** Push the current backup to the configured gist (create if none). */
export async function pushToGist(): Promise<void> {
  const token = getToken();
  if (!token) throw new Error('No token configured.');
  const content = serializeBackup();
  const id = getGistId();
  const body = JSON.stringify({
    ...(id ? {} : { public: false, description: 'Get Gym Done backup' }),
    files: { [GIST_FILENAME]: { content } },
  });
  const url = id ? `${API}/gists/${id}` : `${API}/gists`;
  const res = await fetch(url, {
    method: id ? 'PATCH' : 'POST',
    headers: headers(token),
    body,
  });
  if (!res.ok) await ghError(res);
  const data = await res.json();
  if (data && data.id) setGistId(data.id);
  markSynced();
}

/** Pull the backup JSON text from the configured gist. Returns raw JSON string. */
export async function pullFromGist(): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('No token configured.');
  const id = getGistId();
  if (!id) throw new Error('Nothing pushed yet — push first.');
  const res = await fetch(`${API}/gists/${id}`, { headers: headers(token) });
  if (!res.ok) await ghError(res);
  const data = await res.json();
  const file = data.files?.[GIST_FILENAME];
  if (!file) throw new Error('Backup file not found in gist.');
  let content: string = file.content ?? '';
  if (file.truncated && file.raw_url) {
    const rawRes = await fetch(file.raw_url, { headers: { Authorization: `Bearer ${token}` } });
    if (!rawRes.ok) await ghError(rawRes);
    content = await rawRes.text();
  }
  markSynced();
  return content;
}

/** Fire-and-forget auto-push after a workout, if a token + gist are configured. Never throws. */
export function autoPush(): void {
  if (!getToken() || !getGistId()) return;
  pushToGist().catch((e) => {
    console.warn('Auto-push failed:', e);
  });
}
