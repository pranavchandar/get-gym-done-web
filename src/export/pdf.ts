/**
 * Minimal PDF writer — enough for a paginated, typeset routine sheet using the
 * two standard Type1 fonts every reader ships with (Helvetica / Helvetica-Bold),
 * so no font embedding and no external library is needed.
 *
 * Coordinates are PDF user space: origin bottom-left, 72 units per inch,
 * A4 = 595.28 x 841.89.
 */

export const PAGE_W = 595.28;
export const PAGE_H = 841.89;

export type PdfFont = 'regular' | 'bold';

interface TextOp {
  kind: 'text';
  x: number;
  y: number;
  size: number;
  font: PdfFont;
  gray: number;
  text: string;
}
interface RectOp {
  kind: 'rect';
  x: number;
  y: number;
  w: number;
  h: number;
  gray: number;
}
type Op = TextOp | RectOp;

/**
 * WinAnsi has no glyphs for the typographic characters the UI uses, so map the
 * ones we actually emit and drop anything else non-Latin1 rather than writing
 * bytes the reader would render as garbage.
 */
function toWinAnsi(s: string): string {
  return s
    .replace(/[×✕✖]/g, 'x')
    .replace(/[—–]/g, '-')
    .replace(/[·•]/g, '-')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/…/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff]/g, '');
}

function escapeText(s: string): string {
  return toWinAnsi(s).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

/** Helvetica AFM advance widths (1/1000 em) — enough to measure and truncate. */
const W_REG: Record<string, number> = {};
const W_BOLD: Record<string, number> = {};
{
  // Compact width tables: [width, "chars"] pairs.
  const reg: [number, string][] = [
    [278, ' !|\'`,.:;iljI()[]{}ft'],
    [355, '"'],
    [556, '#$%0123456789+<=>~^_abcdeghknopqsuvxyzL?'],
    [889, '%@'],
    [667, 'ABDEHKNPRSUXYZbdopqCFGOQ&'],
    [722, 'CDHNRUVX'],
    [944, 'MW'],
    [500, 'JTZrs*/\\-'],
    [333, 'fjt'],
  ];
  const bold: [number, string][] = [
    [278, ' !|\'`,.:;i'],
    [333, 'lI()[]{}ft/\\-'],
    [556, '#$%0123456789+<=>~^_acegknopqsuvxyzJTZrsL?'],
    [611, 'abdhoq'],
    [722, 'ABDEHKNPRSUXYZCFGOQ&'],
    [778, 'CDHNRUVX'],
    [944, 'MW'],
  ];
  for (const [w, chars] of reg) for (const c of chars) if (W_REG[c] === undefined) W_REG[c] = w;
  for (const [w, chars] of bold) for (const c of chars) if (W_BOLD[c] === undefined) W_BOLD[c] = w;
}

export function textWidth(text: string, size: number, font: PdfFont): number {
  const table = font === 'bold' ? W_BOLD : W_REG;
  const fallback = font === 'bold' ? 600 : 556;
  let total = 0;
  for (const ch of toWinAnsi(text)) total += table[ch] ?? fallback;
  return (total / 1000) * size;
}

/** Truncate with an ellipsis so long exercise names never overrun their column. */
export function fitText(text: string, maxWidth: number, size: number, font: PdfFont): string {
  if (textWidth(text, size, font) <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && textWidth(out + '...', size, font) > maxWidth) out = out.slice(0, -1);
  return out.trimEnd() + '...';
}

export class PdfDoc {
  private pages: Op[][] = [[]];
  private current = 0;

  get pageCount(): number {
    return this.pages.length;
  }

  newPage(): void {
    this.pages.push([]);
    this.current = this.pages.length - 1;
  }

  text(text: string, x: number, y: number, opts: { size?: number; font?: PdfFont; gray?: number } = {}): void {
    if (!text) return;
    this.pages[this.current].push({
      kind: 'text',
      x,
      y,
      size: opts.size ?? 10,
      font: opts.font ?? 'regular',
      gray: opts.gray ?? 0,
      text,
    });
  }

  rect(x: number, y: number, w: number, h: number, gray = 0.85): void {
    this.pages[this.current].push({ kind: 'rect', x, y, w, h, gray });
  }

  private content(ops: Op[]): string {
    const out: string[] = [];
    for (const op of ops) {
      if (op.kind === 'rect') {
        out.push(`${op.gray.toFixed(3)} g`);
        out.push(`${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re f`);
      } else {
        const font = op.font === 'bold' ? '/F2' : '/F1';
        out.push('BT');
        out.push(`${op.gray.toFixed(3)} g`);
        out.push(`${font} ${op.size} Tf`);
        out.push(`1 0 0 1 ${op.x.toFixed(2)} ${op.y.toFixed(2)} Tm`);
        out.push(`(${escapeText(op.text)}) Tj`);
        out.push('ET');
      }
    }
    return out.join('\n');
  }

  build(title: string): Blob {
    const objects: string[] = [];
    const pageCount = this.pages.length;
    // Object layout: 1 catalog, 2 pages tree, 3 F1, 4 F2, then per page: page + contents.
    const pageObjId = (i: number) => 5 + i * 2;
    const contentObjId = (i: number) => 6 + i * 2;

    objects[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    const kids = this.pages.map((_, i) => `${pageObjId(i)} 0 R`).join(' ');
    objects[2] = `<< /Type /Pages /Count ${pageCount} /Kids [${kids}] >>`;
    objects[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    objects[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';

    this.pages.forEach((ops, i) => {
      const stream = this.content(ops);
      objects[pageObjId(i)] =
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W.toFixed(2)} ${PAGE_H.toFixed(2)}] ` +
        `/Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents ${contentObjId(i)} 0 R >>`;
      objects[contentObjId(i)] = `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`;
    });

    const infoId = objects.length;
    const stamp = pdfDate(new Date());
    objects[infoId] = `<< /Title (${escapeText(title)}) /Producer (Get Gym Done) /CreationDate (${stamp}) >>`;

    let out = '%PDF-1.4\n';
    const offsets: number[] = [];
    for (let i = 1; i < objects.length; i++) {
      offsets[i] = out.length;
      out += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }
    const xrefPos = out.length;
    out += `xref\n0 ${objects.length}\n0000000000 65535 f \n`;
    for (let i = 1; i < objects.length; i++) {
      out += `${String(offsets[i]).padStart(10, '0')} 00000 n \n`;
    }
    out += `trailer\n<< /Size ${objects.length} /Root 1 0 R /Info ${infoId} 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`;

    // Latin-1: every byte written above is <= 0xFF, and offsets must be byte-exact.
    const bytes = new Uint8Array(out.length);
    for (let i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}

function pdfDate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `D:${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
