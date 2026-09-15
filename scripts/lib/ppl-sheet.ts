/**
 * Parse the Ultimate Push Pull Legs workbook into the programme JSON
 * contract. One sheet per phase; rows are arrays as returned by
 * XLSX.utils.sheet_to_json with header: 1.
 *
 * Two quirks of the file are handled here. Excel stored range-looking
 * cells ("3-4", "8-9") as dates, so those come back as serial numbers
 * and are decoded to month-day. And the sheet writes reps in a few
 * idioms parseDose does not accept (per-set lists, drop sets, "8 + 8");
 * doseFromSheet maps each to a parseable dose and keeps the original in
 * the notes.
 */

import * as XLSX from "xlsx";
import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonWeek } from "../data/programs/schema";

export type SheetMeta = {
  name: string;
  description: string;
  citation: string | null;
  sourceUrl: string | null;
};

type Cell = unknown;

function text(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
  if (t === "" || t === "-" || t.toUpperCase() === "N/A") return null;
  return t;
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** A range cell: "3-4" as written, or the Excel date serial Excel made of it. */
export function decodeRangeCell(v: Cell): string | null {
  if (typeof v === "number") {
    if (v > 40000) {
      const d = new Date(EXCEL_EPOCH_MS + Math.round(v) * 86_400_000);
      return `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    }
    return String(v);
  }
  return text(v);
}

export type SheetDose = { dose: string; note: string | null };

/** Map the Working Sets and Reps cells to a parseDose string plus a note for anything lossy. */
export function doseFromSheet(working: Cell, reps: Cell): SheetDose | null {
  const sets = decodeRangeCell(working);
  if (sets === null || !/^\d+(-\d+)?$/.test(sets)) return null;
  const r = reps === null || reps === undefined ? "" : String(reps).trim();
  if (r === "") return null;

  let m: RegExpExecArray | null;
  if ((m = /^(\d+)\s*(?:mins?|minutes)$/i.exec(r))) return { dose: `${sets} x ${m[1]} min`, note: null };
  if ((m = /^(\d+)\s*s(?:ec|ecs)?\s*(hold)?$/i.exec(r))) return { dose: `${sets} x ${m[1]} sec${m[2] ? " hold" : ""}`, note: null };
  if (/^amrap$/i.test(r)) return { dose: `${sets} x AMRAP`, note: null };
  if (/^\d+(-\d+)?$/.test(r)) return { dose: `${sets} x ${r}`, note: null };
  if ((m = /^(\d+)\s*\+\s*(\d+)$/.exec(r))) {
    return /\s\+\s/.test(r)
      ? { dose: `${sets} x ${m[1]}`, note: r }
      : { dose: `${sets} x ${m[1]}`, note: `Then a drop set of ${m[2]}` };
  }
  if (/^\d+(\s*,\s*\d+)+$/.test(r)) {
    const nums = r.split(",").map((x) => Number(x.trim()));
    return { dose: `${sets} x ${Math.min(...nums)}-${Math.max(...nums)}`, note: `Reps per set: ${r}` };
  }
  return null;
}

const PHASE_RE = /^Phase\s+\d+\s*-\s*(.+?)\s*(?:\(.*\))?$/i;
const WEEK_RE = /^Week\s+(\d+)$/i;
const DAY_RE = /^(.*?)\s*#\d+$/;
const SUPERSET_RE = /^([A-Z])(\d)[.:]\s*/;

/** An exercise row the parser could not place or could not turn into a dose. */
export type PplSkippedRow = {
  block: string;
  week: number;
  /** null when the row sat under no day label. */
  day: string | null;
  name: string;
  reason: string;
};

export type PplParseResult = { program: ProgramJson; skipped: PplSkippedRow[] };

export function formatSkippedRow(s: PplSkippedRow): string {
  return `${s.block} W${s.week} ${s.day ?? "(no day)"}: ${s.name}: ${s.reason}`;
}

/**
 * Parse one or more phase sheets (rows as arrays) into a programme.
 * Rows that do not map are returned in `skipped`, never dropped silently.
 */
export function parsePplRows(sheets: unknown[][][], meta: SheetMeta): PplParseResult {
  const blocks: ProgramJsonBlock[] = [];
  let globalWeek = 0;
  const skipped: PplSkippedRow[] = [];

  for (const rows of sheets) {
    let block: ProgramJsonBlock | null = null;
    let week: ProgramJsonWeek | null = null;
    let day: ProgramJsonDay | null = null;

    for (const row of rows) {
      const a = text(row[0]);
      const phase = a ? PHASE_RE.exec(a) : null;
      if (phase) {
        block = { name: phase[1].trim(), weeks: [] };
        blocks.push(block);
        week = null;
        day = null;
        continue;
      }
      if (a && WEEK_RE.test(a) && text(row[1]) === "Exercise") {
        if (!block) throw new Error("week header before any phase header");
        globalWeek++;
        week = { week: globalWeek, days: [] };
        block.weeks.push(week);
        day = null;
        continue;
      }
      if (!week) continue;

      // Banners ("Mandatory 1-2 Rest Days", the deload notices before a
      // week header) are a column A label with nothing in the Exercise
      // column. A day label always has an exercise beside it.
      const rawName = text(row[1]);
      if (a && !rawName) { day = null; continue; }

      if (a) {
        const dm = DAY_RE.exec(a);
        const dayName = (dm ? dm[1] : a).trim();
        day = week.days.find((d) => d.name === dayName) ?? null;
        if (!day) {
          day = { name: dayName, exercises: [] };
          week.days.push(day);
        }
      }
      if (!rawName || rawName === "Exercise") continue;

      // An exercise with nothing to attach to: the row sits under a
      // banner or directly under the week header. Report it rather
      // than let it vanish.
      const blockName = block?.name ?? "(no block)";
      if (!day) {
        skipped.push({ block: blockName, week: week.week, day: null, name: rawName, reason: "no day label above this row" });
        continue;
      }

      const sd = doseFromSheet(row[3], row[4]);
      if (!sd) {
        skipped.push({
          block: blockName,
          week: week.week,
          day: day.name,
          name: rawName,
          reason: `no dose from working sets ${JSON.stringify(row[3] ?? null)} and reps ${JSON.stringify(row[4] ?? null)}`,
        });
        continue;
      }

      let name = rawName;
      const noteParts: string[] = [];
      const ss = SUPERSET_RE.exec(name);
      if (ss) {
        name = name.replace(SUPERSET_RE, "");
        noteParts.push(`Superset ${ss[1]}`);
      }
      const n = text(row[10]);
      if (n) noteParts.push(n);
      const load = text(row[5]);
      if (load) noteParts.push(`Load: ${load}`);
      if (sd.note) noteParts.push(sd.note);

      const warmUp = decodeRangeCell(row[2]);
      const rpe = decodeRangeCell(row[6]);

      day.exercises.push({
        name,
        warmUp: warmUp !== null && /^\d+(-\d+)?$/.test(warmUp) ? warmUp : null,
        dose: sd.dose,
        rpe: rpe !== null && /^\d+(-\d+)?$/.test(rpe) ? rpe : null,
        rest: text(row[7]),
        sub1: text(row[8]),
        sub2: text(row[9]),
        notes: noteParts.length ? noteParts.join(". ") : null,
      });
    }
  }

  const program: ProgramJson = {
    name: meta.name,
    kind: "training",
    description: meta.description,
    citation: meta.citation,
    sourceUrl: meta.sourceUrl,
    blocks,
  };
  return { program, skipped };
}

const PHASE_SHEET_RE = /^4x - Phase \d+$/i;

/** Read every sheet whose name matches "4x - Phase N", in sheet order. Throws when none does. */
export function parsePplWorkbook(wb: XLSX.WorkBook, meta: SheetMeta): PplParseResult {
  const names = wb.SheetNames.filter((n) => PHASE_SHEET_RE.test(n));
  if (names.length === 0) {
    throw new Error(`no sheet matches ${PHASE_SHEET_RE}; the workbook has: ${wb.SheetNames.join(", ")}`);
  }
  const sheets = names.map((n) => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false }) as unknown[][]);
  return parsePplRows(sheets, meta);
}
