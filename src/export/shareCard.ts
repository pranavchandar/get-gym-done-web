import { downloadBlob } from './splitExport';

// A 1080×1350 image of a finished workout for a story or a group chat. Drawn on a canvas
// in the app's own type, then handed to the phone's share sheet (or downloaded).

export interface ShareCardData {
  eyebrow: string;
  title: string;
  stats: { label: string; value: string }[];
  /** heading over `lines`, e.g. "RECORDS" */
  listTitle: string;
  lines: { left: string; right?: string }[];
}

const W = 1080;
const H = 1350;

function cssVar(name: string, fallback: string): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** Cut `text` to fit `max` px with an ellipsis. */
function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > max) t = t.slice(0, -1);
  return `${t}…`;
}

/** Break a title into at most `maxLines` lines that fit `max` px. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(next).width <= max || !cur) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = fit(ctx, lines.slice(maxLines - 1).join(' '), max);
    return kept;
  }
  return lines.map((l) => fit(ctx, l, max));
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  try {
    await Promise.all([document.fonts.load('96px Anton'), document.fonts.load('700 32px Inter'), document.fonts.load('400 32px Inter')]);
  } catch {
    /* fall back to system fonts */
  }
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available.');
  const accent = cssVar('--accent-primary', '#c1f038');
  const bg = '#0a0a09';
  const fg = '#f7f5f0';
  const muted = '#a8a59a';
  const pad = 88;

  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, W, 14);

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = accent;
  ctx.font = '700 30px Inter, system-ui, sans-serif';
  ctx.fillText('GET GYM DONE', pad, 120);
  ctx.fillStyle = muted;
  ctx.textAlign = 'right';
  ctx.fillText(fit(ctx, data.eyebrow.toUpperCase(), W - pad * 2 - 300), W - pad, 120);
  ctx.textAlign = 'left';

  ctx.fillStyle = fg;
  ctx.font = '120px Anton, Impact, sans-serif';
  const titleLines = wrap(ctx, data.title.toUpperCase(), W - pad * 2, 2);
  let y = 290;
  for (const line of titleLines) {
    ctx.fillText(line, pad, y);
    y += 124;
  }
  ctx.fillStyle = accent;
  ctx.fillText('DONE.', pad, y);
  y += 70;

  // stat tiles, two per row
  const gap = 24;
  const tileW = (W - pad * 2 - gap) / 2;
  const tileH = 170;
  data.stats.slice(0, 4).forEach((s, i) => {
    const tx = pad + (i % 2) * (tileW + gap);
    const ty = y + Math.floor(i / 2) * (tileH + gap);
    ctx.fillStyle = '#16140f';
    ctx.beginPath();
    ctx.roundRect(tx, ty, tileW, tileH, 28);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.font = '72px Anton, Impact, sans-serif';
    ctx.fillText(fit(ctx, s.value, tileW - 56), tx + 28, ty + 98);
    ctx.fillStyle = muted;
    ctx.font = '700 24px Inter, system-ui, sans-serif';
    ctx.fillText(s.label.toUpperCase(), tx + 28, ty + 140);
  });
  y += Math.ceil(Math.min(4, data.stats.length) / 2) * (tileH + gap) + 40;

  if (data.lines.length) {
    ctx.fillStyle = accent;
    ctx.font = '700 26px Inter, system-ui, sans-serif';
    ctx.fillText(data.listTitle.toUpperCase(), pad, y);
    y += 56;
    const maxLines = Math.max(1, Math.floor((H - 110 - y) / 58));
    for (const line of data.lines.slice(0, maxLines)) {
      ctx.font = '400 34px Inter, system-ui, sans-serif';
      const right = line.right ?? '';
      ctx.fillStyle = muted;
      ctx.textAlign = 'right';
      ctx.fillText(right, W - pad, y);
      const rightW = right ? ctx.measureText(right).width + 24 : 0;
      ctx.textAlign = 'left';
      ctx.fillStyle = fg;
      ctx.fillText(fit(ctx, line.left, W - pad * 2 - rightW), pad, y);
      y += 58;
    }
  }

  return await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the image.'))), 'image/png'),
  );
}

/** Open the share sheet with the image where the browser can; otherwise download it. */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], text });
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'cancelled';
    }
  }
  downloadBlob(blob, filename);
  return 'downloaded';
}
