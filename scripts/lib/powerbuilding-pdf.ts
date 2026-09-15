/**
 * Parse the Powerbuilding System (4x) PDF dump into the programme
 * contract. Programme pages carry "POWERBUILDING SYSTEM WEEK N" (or
 * "WEEK 10A", "WEEK 10B", "OPTIONAL DAY"); each table is one workout
 * whose name sits in the WORKOUT cell of its first row.
 *
 * Weeks 1-9 are the "Powerbuilding" block, week 10 is "Max Testing"
 * using option A (option B is for competitive powerlifters and is
 * reported as omitted), week 11 is "Deload". The optional arm and pump
 * day is appended as the last day of the odd weeks 1, 3, 5, 7 and 9,
 * as the PDF suggests. A page with the table header but no week
 * marker is an example in the explanatory text and is skipped.
 *
 * A name written as "X OR Y" is two choices; NAME_CHOICES says which is
 * the exercise and which the substitution, because the split is not
 * derivable ("BARBELL OR EZ BAR CURL" shares its tail).
 */

import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonExercise, ProgramJsonWeek } from "../data/programs/schema";
import { splitVariant } from "./exercise-variant";
import { cellText, complexReps, doseFromPdf, joinNotes, percentOrRpe, restFromPdf, sentenceCase, SUPERSET_RE, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplSkippedRow, SheetMeta } from "./ppl-sheet";

export type PowerbuildingParseResult = { program: ProgramJson; skipped: PplSkippedRow[]; omitted: string[] };

const WEEK_RE = /POWERBUILDING SYSTEM WEEK\s+(\d+)([AB])?\b/i;
const OPTIONAL_RE = /POWERBUILDING SYSTEM OPTIONAL DAY/i;
const OPTIONAL_DAY_NAME = "Optional Arm and Pump Day";
const OPTIONAL_WEEKS = [1, 3, 5, 7, 9];

/** "X OR Y" names: [exercise, substitution]. Keys are the raw cell after collapsing whitespace. */
const NAME_CHOICES: Record<string, [string, string]> = {
  "BANDED LATERAL WALK OR HIP ABDUCTION": ["BANDED LATERAL WALK", "HIP ABDUCTION"],
  "BARBELL OR EZ BAR CURL": ["EZ BAR CURL", "BARBELL CURL"],
  "CHEST-SUPPORTED T-BAR ROW OR PENDLAY ROW": ["CHEST-SUPPORTED T-BAR ROW", "PENDLAY ROW"],
  "SUMO BOX SQUAT OR PAUSE HIGH-BAR SQUAT": ["SUMO BOX SQUAT", "PAUSE HIGH-BAR SQUAT"],
};

function blockFor(week: number): string {
  if (week <= 9) return "Powerbuilding";
  if (week === 10) return "Max Testing";
  return "Deload";
}

function isWorkoutTable(t: string[][]): boolean {
  return t.length > 1 && t[0].length === 13 && t[0][0] === "WORKOUT" && t[0][1] === "EXERCISE";
}

function dayName(cell: string): string {
  const flat = titleCaseName(cell).replace(/#\s+(\d)/, "#$1");
  const colon = flat.indexOf(":");
  if (colon === -1) return flat;
  return `${flat.slice(0, colon).trim()} (${flat.slice(colon + 1).trim()})`;
}

function rowsToExercises(table: string[][], where: { block: string; week: number; day: string }, skipped: PplSkippedRow[]): ProgramJsonExercise[] {
  const out: ProgramJsonExercise[] = [];
  for (const row of table.slice(1)) {
    const rawName = cellText(row[1]);
    if (!rawName) continue;
    const ss = SUPERSET_RE.exec(rawName);
    const bare = rawName.replace(SUPERSET_RE, "");
    const sd = doseFromPdf(row[3], complexReps(bare, row[4]));
    if (!sd) {
      skipped.push({ ...where, name: rawName, reason: `no dose from sets ${JSON.stringify(row[3])} and reps ${JSON.stringify(row[4])}` });
      continue;
    }
    const choice = NAME_CHOICES[bare];
    if (!choice && /\sOR\s/.test(bare)) {
      skipped.push({ ...where, name: rawName, reason: "an \"X OR Y\" name with no NAME_CHOICES entry" });
      continue;
    }
    const [exerciseName, subName] = choice ?? [bare, null];
    const load = percentOrRpe(row[5]);
    const rpe = percentOrRpe(row[6]);
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
      notes: joinNotes([ss ? `Superset ${ss[1]}` : null, sentenceCase(row[12]), load.loadNote, load.rpe ? `Load: ${load.rpe} (as written)` : null, rpe.loadNote, sd.note]),
    });
  }
  return out;
}

export function parsePowerbuilding(dump: PdfTables, meta: SheetMeta): PowerbuildingParseResult {
  const skipped: PplSkippedRow[] = [];
  const omitted: string[] = [];
  const weeks = new Map<number, ProgramJsonWeek>();
  let optionalDay: ProgramJsonDay | null = null;
  let optionBTables = 0;

  for (const page of dump.pages) {
    const text = page.text.join("\n");
    const tables = page.tables.filter(isWorkoutTable);
    if (tables.length === 0) continue;
    if (OPTIONAL_RE.test(text)) {
      const table = tables[0];
      optionalDay = { name: OPTIONAL_DAY_NAME, exercises: rowsToExercises(table, { block: "Powerbuilding", week: 0, day: OPTIONAL_DAY_NAME }, skipped) };
      continue;
    }
    const m = WEEK_RE.exec(text);
    if (!m) continue;
    const weekNumber = Number(m[1]);
    if (m[2] === "B") {
      optionBTables += tables.length;
      continue;
    }
    let week = weeks.get(weekNumber);
    if (!week) {
      week = { week: weekNumber, days: [] };
      weeks.set(weekNumber, week);
    }
    for (const table of tables) {
      const name = dayName(table[1][0]);
      const day: ProgramJsonDay = { name, exercises: [] };
      week.days.push(day);
      day.exercises = rowsToExercises(table, { block: blockFor(weekNumber), week: weekNumber, day: name }, skipped);
    }
  }
  if (optionBTables > 0) {
    omitted.push(`Week 10B (max testing option B, competitive powerlifters): ${optionBTables} table${optionBTables === 1 ? "" : "s"} not converted; option A is the one loaded`);
  }

  const ordered = [...weeks.values()].sort((a, b) => a.week - b.week);
  if (optionalDay) {
    for (const w of ordered) if (OPTIONAL_WEEKS.includes(w.week)) w.days.push({ name: optionalDay.name, exercises: optionalDay.exercises.map((e) => ({ ...e })) });
  }
  // Contract weeks are consecutive from 1; the PDF's numbering already is,
  // but renumber so a missing page fails validation loudly rather than
  // silently shifting.
  const blocks: ProgramJsonBlock[] = [];
  ordered.forEach((w, i) => {
    const contractWeek = i + 1;
    const name = blockFor(w.week);
    let block = blocks[blocks.length - 1];
    if (!block || block.name !== name) {
      block = { name, weeks: [] };
      blocks.push(block);
    }
    block.weeks.push({ week: contractWeek, days: w.days });
  });

  const program: ProgramJson = { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
  return { program, skipped, omitted };
}
