/**
 * Parse the Powerbuilding Phase 3.0 (5x) PDF dump into the program
 * contract. Program pages carry "POWERBUILDING 3.0 - JEFF NIPPARD WEEK N"
 * (or "WEEK 10A", "WEEK 10B"); each table is one day whose name sits in
 * the first column of its first row after the header ("FULL BODY 1",
 * "SQUAT TEST:"). A table may open with a banner row above the header
 * ("SEMI-DELOAD WEEK - ...", "TAPER WEEK - ...", "MAX TESTING OPTION
 * B: ..."); the banner is dropped, since the block name carries it.
 *
 * Blocks follow the PDF's own framing: weeks 1-4 and 6-8 are "Loading",
 * week 5 is the "Semi-Deload", week 9 the "Taper", week 10 "Max
 * Testing". Week 10 is option B, the AMRAP test the PDF recommends for
 * bodybuilding and general strength goals; option A (heavy singles, for
 * competitive powerlifters) is reported as omitted. That is the same
 * choice as the 4x program, where the AMRAP option was 10A.
 *
 * A page with the table header but no week marker is an example in
 * the explanatory text and is skipped. A name with an "(OR ...)"
 * choice is split by NAME_CHOICES into the exercise and its
 * substitution, because the split is not derivable.
 */

import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonExercise, ProgramJsonWeek } from "../data/programs/schema";
import { splitVariant } from "./exercise-variant";
import { cellText, doseFromPdf, joinNotes, percentOrRpe, restFromPdf, sentenceCase, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplSkippedRow, SheetMeta } from "./ppl-sheet";

export type Powerbuilding3ParseResult = { program: ProgramJson; skipped: PplSkippedRow[]; omitted: string[] };

const WEEK_RE = /POWERBUILDING 3\.0 - JEFF NIPPARD WEEK\s+(\d+)([AB])?\b/i;
const LOADED_OPTION = "B";

/** "(OR ...)" names: [exercise, substitution]. Keys are the raw cell after collapsing whitespace. */
const NAME_CHOICES: Record<string, [string, string]> = {
  "PIN GOOD MORNING (OR 45° BACK EXTENSION)": ["PIN GOOD MORNING", "45° BACK EXTENSION"],
  // EZ bar first, as the 4x program's "BARBELL OR EZ BAR CURL" was resolved.
  "BARBELL (OR EZ-BAR) STRICT CURL": ["EZ-BAR STRICT CURL", "BARBELL STRICT CURL"],
};

export function blockFor(week: number): string {
  if (week === 5) return "Semi-Deload";
  if (week === 9) return "Taper";
  if (week === 10) return "Max Testing";
  return "Loading";
}

function isHeader(r: string[] | undefined): boolean {
  return !!r && r.length === 13 && /^WEEK\s+\d+[AB]?$/i.test(cellText(r[0]) ?? "") && r[1] === "EXERCISE";
}

/** The table's rows after its header, or null when it is not a day table. A banner row above the header is dropped. */
function dayRows(t: string[][]): string[][] | null {
  const h = t.findIndex(isHeader);
  if (h === -1 || h > 1 || t.length <= h + 1) return null;
  return t.slice(h + 1);
}

/** "FULL\nBODY\n1" to "Full Body 1", "SQUAT\nTEST:" to "Squat Test". */
export function dayName(cell: string): string {
  return titleCaseName(cell).replace(/:\s*$/, "").trim();
}

/** A "~" before an RPE marks a top set's target as approximate; the number stays the RPE and the "~" becomes a note. */
function rpeCell(raw: string | null | undefined): { rpe: string | null; note: string | null; loadNote: string | null } {
  const t = cellText(raw);
  if (t && t.startsWith("~")) {
    const r = percentOrRpe(t.slice(1));
    return { rpe: r.rpe, note: r.rpe ? "Approximate RPE" : null, loadNote: r.loadNote };
  }
  const r = percentOrRpe(raw);
  return { rpe: r.rpe, note: null, loadNote: r.loadNote };
}

function rowsToExercises(rows: string[][], where: { block: string; week: number; day: string }, skipped: PplSkippedRow[]): ProgramJsonExercise[] {
  const out: ProgramJsonExercise[] = [];
  for (const row of rows) {
    const rawName = cellText(row[1]);
    if (!rawName) continue;
    const sd = doseFromPdf(row[3], row[4]);
    if (!sd) {
      skipped.push({ ...where, name: rawName, reason: `no dose from sets ${JSON.stringify(row[3])} and reps ${JSON.stringify(row[4])}` });
      continue;
    }
    const choice = NAME_CHOICES[rawName];
    if (!choice && /\bOR\b/.test(rawName)) {
      skipped.push({ ...where, name: rawName, reason: "an \"OR\" name with no NAME_CHOICES entry" });
      continue;
    }
    const [exerciseName, subName] = choice ?? [rawName, null];
    const load = percentOrRpe(row[5]);
    const rpe = rpeCell(row[6]);
    const warm = cellText(row[2]);
    const split = splitVariant(titleCaseName(exerciseName));
    out.push({
      name: split.name,
      variant: split.variant,
      warmUp: warm && warm !== "0" ? warm : null,
      dose: sd.dose,
      rpe: rpe.rpe,
      rest: restFromPdf(row[7]),
      sub1: subName ? splitVariant(titleCaseName(subName)).name : null,
      sub2: null,
      notes: joinNotes([sentenceCase(row[12]), load.loadNote, load.rpe ? `Load: ${load.rpe} (as written)` : null, rpe.note, rpe.loadNote, sd.note]),
    });
  }
  return out;
}

export function parsePowerbuilding3(dump: PdfTables, meta: SheetMeta): Powerbuilding3ParseResult {
  const skipped: PplSkippedRow[] = [];
  const omitted: string[] = [];
  const weeks = new Map<number, ProgramJsonWeek>();
  let otherOptionTables = 0;

  for (const page of dump.pages) {
    const m = WEEK_RE.exec(page.text.join("\n"));
    if (!m) continue;
    const tables = page.tables.map(dayRows).filter((r): r is string[][] => r !== null);
    if (tables.length === 0) continue;
    const weekNumber = Number(m[1]);
    if (m[2] && m[2].toUpperCase() !== LOADED_OPTION) {
      otherOptionTables += tables.length;
      continue;
    }
    let week = weeks.get(weekNumber);
    if (!week) {
      week = { week: weekNumber, days: [] };
      weeks.set(weekNumber, week);
    }
    for (const rows of tables) {
      const name = dayName(rows[0][0]);
      const day: ProgramJsonDay = { name, exercises: rowsToExercises(rows, { block: blockFor(weekNumber), week: weekNumber, day: name }, skipped) };
      week.days.push(day);
    }
  }
  if (otherOptionTables > 0) {
    omitted.push(`Week 10A (max testing option A, heavy singles for competitive powerlifters): ${otherOptionTables} table${otherOptionTables === 1 ? "" : "s"} not converted; option B (AMRAP) is the one loaded`);
  }

  // Renumber so a missing page fails validation rather than shifting weeks.
  const blocks: ProgramJsonBlock[] = [];
  [...weeks.values()]
    .sort((a, b) => a.week - b.week)
    .forEach((w, i) => {
      const name = blockFor(w.week);
      let block = blocks[blocks.length - 1];
      if (!block || block.name !== name) {
        block = { name, weeks: [] };
        blocks.push(block);
      }
      block.weeks.push({ week: i + 1, days: w.days });
    });

  const program: ProgramJson = { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
  return { program, skipped, omitted };
}
