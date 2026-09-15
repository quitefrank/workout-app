/**
 * Parse the Arm Hypertrophy PDF dump into the programme contract. One
 * page per week ("PROGRAM: WEEK N", block from the BLOCK table), three
 * tables per page (Arm Day, Supplemental A, Supplemental B) whose
 * second row is the column header and whose last rows may be weekly
 * volume totals. Tempo goes into the notes; rest is written in minutes
 * as a decimal. Week pages are counted in page order, so the contract
 * week is consecutive whatever number the page prints.
 *
 * Four rows are written with 0 sets and 0 reps (an open-ended set to
 * failure the notes describe, RPE 10); OPEN_ENDED_ROWS gives them a
 * dose and says so.
 */

import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonWeek } from "../data/programs/schema";
import { splitVariant } from "./exercise-variant";
import { cellText, doseFromPdf, joinNotes, percentOrRpe, restFromPdf, sentenceCase, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplParseResult, PplSkippedRow, SheetMeta } from "./ppl-sheet";

const WEEK_RE = /PROGRAM:\s*WEEK\s+(\d+)/i;
const BLOCK_RE = /^BLOCK\s+(\d)$/i;

/** Raw names (whitespace collapsed) written with 0 sets and 0 reps. */
const OPEN_ENDED_ROWS = new Set([
  "HEAVY NEGATIVE CONCENTRATION CURLS",
  "LYING INCLINE DEATH CURLS",
  "PREACHER DEATH CURLS",
  "REVERSE GRIP EZ BAR CURL (METABOLIC)",
]);
const OPEN_ENDED_NOTE = "Sets and reps as written: 0 / 0, an open-ended set; see the notes";

function isDayTable(t: string[][]): boolean {
  return t.length > 2 && t[0].length === 11 && t[1][1] === "SETS" && t[1][2] === "REPS";
}

function blockOf(page: PdfTables["pages"][number]): string | null {
  for (const t of page.tables) {
    if (t.length === 2 && t[0].length === 1 && t[0][0] === "BLOCK" && /^\d$/.test(t[1][0])) return `Block ${t[1][0]}`;
  }
  const joined = page.text.map((l) => l.trim());
  const i = joined.indexOf("BLOCK");
  if (i >= 0 && /^\d$/.test(joined[i + 1] ?? "")) return `Block ${joined[i + 1]}`;
  const m = joined.map((l) => BLOCK_RE.exec(l)).find(Boolean);
  return m ? `Block ${m[1]}` : null;
}

export function parseArm(dump: PdfTables, meta: SheetMeta): PplParseResult {
  const blocks: ProgramJsonBlock[] = [];
  const skipped: PplSkippedRow[] = [];
  let globalWeek = 0;

  for (const page of dump.pages) {
    const weekLine = page.text.map((l) => WEEK_RE.exec(l)).find(Boolean);
    if (!weekLine) continue;
    const blockName = blockOf(page);
    if (!blockName) throw new Error(`page ${page.page}: week ${weekLine[1]} has no block marker`);
    let block = blocks[blocks.length - 1];
    if (!block || block.name !== blockName) {
      block = { name: blockName, weeks: [] };
      blocks.push(block);
    }
    globalWeek++;
    const week: ProgramJsonWeek = { week: globalWeek, days: [] };
    block.weeks.push(week);

    for (const table of page.tables) {
      if (!isDayTable(table)) continue;
      const day: ProgramJsonDay = { name: titleCaseName(table[0][0]), exercises: [] };
      week.days.push(day);
      for (const row of table.slice(2)) {
        const rawName = cellText(row[0]);
        if (!rawName || /^WEEKLY\s/i.test(rawName)) continue;
        let sd = doseFromPdf(row[1], row[2]);
        let openEnded: string | null = null;
        if (!sd && OPEN_ENDED_ROWS.has(rawName)) {
          sd = { dose: "1 x AMRAP", note: null };
          openEnded = OPEN_ENDED_NOTE;
        }
        if (!sd) {
          skipped.push({ block: block.name, week: week.week, day: day.name, name: rawName, reason: `no dose from sets ${JSON.stringify(row[1])} and reps ${JSON.stringify(row[2])}` });
          continue;
        }
        const tempo = cellText(row[3]);
        const split = splitVariant(titleCaseName(rawName));
        day.exercises.push({
          name: split.name,
          variant: split.variant,
          warmUp: null,
          dose: sd.dose,
          rpe: percentOrRpe(row[4]).rpe,
          rest: restFromPdf(row[5]),
          sub1: null,
          sub2: null,
          notes: joinNotes([sentenceCase(row[10]), tempo ? `Tempo ${tempo}` : null, sd.note, openEnded]),
        });
      }
    }
  }

  const program: ProgramJson = { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
  return { program, skipped };
}
