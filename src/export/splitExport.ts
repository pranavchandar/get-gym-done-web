import type { StoreData } from '../store/store';
import { daysOf, dayExercisesOf } from '../store/selectors';
import { zipSync } from './zip';
import { PdfDoc, PAGE_W, PAGE_H, fitText, textWidth } from './pdf';

export type ExportFormat = 'pdf' | 'csv' | 'json' | 'xlsx';

export interface ExportExercise {
  order: number;
  name: string;
  primaryMuscle: string;
  equipment: string;
  sets: number;
  repsLow: number;
  repsHigh: number;
  prescription: string;
  formCues: string[];
}
export interface ExportDay {
  dayNumber: number;
  name: string;
  isRestDay: boolean;
  muscleGroups: string[];
  totalSets: number;
  exercises: ExportExercise[];
}
export interface SplitExport {
  splitName: string;
  dayCount: number;
  trainingDays: number;
  restDays: number;
  totalExercises: number;
  totalSets: number;
  exportedAt: string;
  days: ExportDay[];
}

/** Flatten a split into the shape every serializer below renders from. */
export function buildSplitExport(state: StoreData, splitId: string): SplitExport | null {
  const split = state.splits[splitId];
  if (!split) return null;
  const days = daysOf(state, splitId);

  const outDays: ExportDay[] = days.map((d) => {
    const exercises: ExportExercise[] = d.isRestDay
      ? []
      : dayExercisesOf(state, d.id).map((de, i) => {
          const ex = state.exercises[de.exerciseId];
          return {
            order: i + 1,
            name: ex?.name ?? 'Exercise',
            primaryMuscle: ex?.primaryMuscle ?? '',
            equipment: ex?.equipment ?? '',
            sets: de.prescribedSets,
            repsLow: de.prescribedRepsLow,
            repsHigh: de.prescribedRepsHigh,
            prescription: `${de.prescribedSets}x${de.prescribedRepsLow}-${de.prescribedRepsHigh}`,
            formCues: ex?.formCues ?? [],
          };
        });
    return {
      dayNumber: d.dayNumber,
      name: d.isRestDay ? 'Rest' : d.name,
      isRestDay: d.isRestDay,
      muscleGroups: d.muscleGroups ?? [],
      totalSets: exercises.reduce((a, e) => a + e.sets, 0),
      exercises,
    };
  });

  return {
    splitName: split.name,
    dayCount: split.dayCount,
    trainingDays: outDays.filter((d) => !d.isRestDay).length,
    restDays: outDays.filter((d) => d.isRestDay).length,
    totalExercises: outDays.reduce((a, d) => a + d.exercises.length, 0),
    totalSets: outDays.reduce((a, d) => a + d.totalSets, 0),
    exportedAt: new Date().toISOString(),
    days: outDays,
  };
}

const COLUMNS = ['Day', 'Day Name', '#', 'Exercise', 'Primary Muscle', 'Equipment', 'Sets', 'Reps', 'Prescription'] as const;

/** One flat row per exercise; rest days keep a single placeholder row so the week stays whole. */
function tableRows(data: SplitExport): string[][] {
  const rows: string[][] = [];
  for (const d of data.days) {
    if (d.isRestDay || d.exercises.length === 0) {
      rows.push([
        String(d.dayNumber),
        d.isRestDay ? 'Rest' : d.name,
        '',
        d.isRestDay ? 'Rest day' : 'No exercises',
        '',
        '',
        '',
        '',
        '',
      ]);
      continue;
    }
    for (const e of d.exercises) {
      rows.push([
        String(d.dayNumber),
        d.name,
        String(e.order),
        e.name,
        e.primaryMuscle,
        e.equipment,
        String(e.sets),
        `${e.repsLow}-${e.repsHigh}`,
        e.prescription,
      ]);
    }
  }
  return rows;
}

// ---------------------------------------------------------------- JSON

export function toJson(data: SplitExport): Blob {
  return new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
}

// ---------------------------------------------------------------- CSV

function csvCell(v: string): string {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function toCsv(data: SplitExport): Blob {
  const lines = [
    [...COLUMNS].map(csvCell).join(','),
    ...tableRows(data).map((r) => r.map(csvCell).join(',')),
  ];
  // BOM so Excel opens UTF-8 accents correctly on a double-click.
  return new Blob(['﻿' + lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
}

// ---------------------------------------------------------------- XLSX

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // Control characters are illegal in XML 1.0 even when escaped.
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '');
}

function colName(i: number): string {
  let s = '';
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

const NUMERIC_COLUMNS = new Set([0, 2, 6]); // Day, #, Sets

function sheetXml(data: SplitExport): string {
  const rows = tableRows(data);
  const cells = (values: string[], rowIndex: number, styleId: number) =>
    values
      .map((v, c) => {
        const ref = `${colName(c)}${rowIndex}`;
        if (v === '') return '';
        const numeric = styleId === 0 && NUMERIC_COLUMNS.has(c) && /^\d+$/.test(v);
        const style = styleId ? ` s="${styleId}"` : '';
        return numeric
          ? `<c r="${ref}"${style}><v>${v}</v></c>`
          : `<c r="${ref}"${style} t="inlineStr"><is><t>${xmlEscape(v)}</t></is></c>`;
      })
      .join('');

  const header = `<row r="1">${cells([...COLUMNS], 1, 1)}</row>`;
  const body = rows.map((r, i) => `<row r="${i + 2}">${cells(r, i + 2, 0)}</row>`).join('');
  const widths = [6, 20, 4, 34, 18, 16, 6, 10, 14]
    .map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`)
    .join('');

  return (
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    `<cols>${widths}</cols>` +
    `<sheetData>${header}${body}</sheetData>` +
    '</worksheet>'
  );
}

/**
 * Excel rejects a workbook whose sheet name contains : \ / ? * [ ], exceeds 31
 * characters, or is wrapped in apostrophes — so sanitize rather than pass the
 * routine name through and hand the user a "corrupt file" dialog.
 */
function sheetName(name: string): string {
  const cleaned = name
    .replace(/[:\\/?*[\]]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 31)
    .replace(/^'+|'+$/g, '')
    .trim();
  return cleaned || 'Routine';
}

export function toXlsx(data: SplitExport): Blob {
  const enc = new TextEncoder();
  const file = (name: string, xml: string) => ({ name, data: enc.encode(xml) });

  const sheetTitle = xmlEscape(sheetName(data.splitName));

  return zipSync([
    file(
      '[Content_Types].xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
        '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
        '<Default Extension="xml" ContentType="application/xml"/>' +
        '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
        '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
        '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
        '</Types>',
    ),
    file(
      '_rels/.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
        '</Relationships>',
    ),
    file(
      'xl/workbook.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
        'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
        `<sheets><sheet name="${sheetTitle}" sheetId="1" r:id="rId1"/></sheets>` +
        '</workbook>',
    ),
    file(
      'xl/_rels/workbook.xml.rels',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
        '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
        '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
        '</Relationships>',
    ),
    file(
      'xl/styles.xml',
      '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
        '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
        '<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font>' +
        '<font><b/><sz val="11"/><name val="Calibri"/></font></fonts>' +
        '<fills count="2"><fill><patternFill patternType="none"/></fill>' +
        '<fill><patternFill patternType="gray125"/></fill></fills>' +
        '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
        '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
        '<cellXfs count="2">' +
        '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
        '<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
        '</cellXfs></styleSheet>',
    ),
    file('xl/worksheets/sheet1.xml', sheetXml(data)),
  ]);
}

// ---------------------------------------------------------------- PDF

const MARGIN = 48;
const BOTTOM = 56;

export function toPdf(data: SplitExport): Blob {
  const doc = new PdfDoc();
  let y = PAGE_H - MARGIN;

  const ensure = (needed: number) => {
    if (y - needed < BOTTOM) {
      doc.newPage();
      y = PAGE_H - MARGIN;
      return true;
    }
    return false;
  };

  // Title block
  doc.text(data.splitName.toUpperCase(), MARGIN, y, { size: 22, font: 'bold' });
  y -= 20;
  const subtitle =
    `${data.trainingDays} training days / week` +
    (data.restDays ? ` - ${data.restDays} rest` : '') +
    ` - ${data.totalExercises} exercises - ${data.totalSets} sets`;
  doc.text(subtitle, MARGIN, y, { size: 10, gray: 0.4 });
  y -= 12;
  doc.text(`Exported ${new Date(data.exportedAt).toLocaleDateString()} - Get Gym Done`, MARGIN, y, {
    size: 8,
    gray: 0.55,
  });
  y -= 22;

  const colX = [MARGIN, MARGIN + 22, MARGIN + 232, MARGIN + 350, PAGE_W - MARGIN - 62];
  const nameW = colX[2] - colX[1] - 10;
  const muscleW = colX[3] - colX[2] - 10;
  const equipW = colX[4] - colX[3] - 10;

  for (const day of data.days) {
    ensure(60);

    // Day header band
    doc.rect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 18, 0.91);
    const dayTitle = `DAY ${day.dayNumber} - ${day.name.toUpperCase()}`;
    doc.text(dayTitle, MARGIN + 6, y + 1, { size: 11, font: 'bold' });
    if (!day.isRestDay && day.exercises.length > 0) {
      const meta = `${day.exercises.length} exercises - ${day.totalSets} sets`;
      doc.text(meta, PAGE_W - MARGIN - 6 - textWidth(meta, 9, 'regular'), y + 1, { size: 9, gray: 0.35 });
    }
    y -= 24;

    if (day.isRestDay) {
      doc.text('Rest day - recovery, eat, sleep.', MARGIN + 6, y, { size: 10, gray: 0.45 });
      y -= 26;
      continue;
    }
    if (day.exercises.length === 0) {
      doc.text('No exercises yet.', MARGIN + 6, y, { size: 10, gray: 0.45 });
      y -= 26;
      continue;
    }

    // Column headers
    doc.text('#', colX[0] + 6, y, { size: 8, font: 'bold', gray: 0.45 });
    doc.text('EXERCISE', colX[1], y, { size: 8, font: 'bold', gray: 0.45 });
    doc.text('MUSCLE', colX[2], y, { size: 8, font: 'bold', gray: 0.45 });
    doc.text('EQUIPMENT', colX[3], y, { size: 8, font: 'bold', gray: 0.45 });
    doc.text('SETS x REPS', colX[4], y, { size: 8, font: 'bold', gray: 0.45 });
    y -= 6;
    doc.rect(MARGIN, y, PAGE_W - MARGIN * 2, 0.6, 0.8);
    y -= 12;

    for (const ex of day.exercises) {
      if (ensure(18)) {
        // Repeat the day header on the continuation page so rows stay identifiable.
        doc.rect(MARGIN, y - 4, PAGE_W - MARGIN * 2, 18, 0.91);
        doc.text(`${dayTitle} (cont.)`, MARGIN + 6, y + 1, { size: 11, font: 'bold' });
        y -= 24;
      }
      doc.text(String(ex.order), colX[0] + 6, y, { size: 9, gray: 0.5 });
      doc.text(fitText(ex.name, nameW, 10, 'regular'), colX[1], y, { size: 10 });
      doc.text(fitText(ex.primaryMuscle, muscleW, 9, 'regular'), colX[2], y, { size: 9, gray: 0.4 });
      doc.text(fitText(ex.equipment, equipW, 9, 'regular'), colX[3], y, { size: 9, gray: 0.4 });
      doc.text(ex.prescription, colX[4], y, { size: 10, font: 'bold' });
      y -= 16;
    }
    y -= 10;
  }

  return doc.build(`${data.splitName} - routine`);
}

// ---------------------------------------------------------------- download

export function fileSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'routine'
  );
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function exportSplit(state: StoreData, splitId: string, format: ExportFormat): boolean {
  const data = buildSplitExport(state, splitId);
  if (!data) return false;
  const base = `${fileSlug(data.splitName)}-routine`;
  switch (format) {
    case 'json':
      downloadBlob(toJson(data), `${base}.json`);
      return true;
    case 'csv':
      downloadBlob(toCsv(data), `${base}.csv`);
      return true;
    case 'xlsx':
      downloadBlob(toXlsx(data), `${base}.xlsx`);
      return true;
    case 'pdf':
      downloadBlob(toPdf(data), `${base}.pdf`);
      return true;
  }
}
