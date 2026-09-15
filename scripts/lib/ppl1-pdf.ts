/**
 * Parse the Legs/Push/Pull (PPL 1.0) PDF dump into the programme
 * contract. Cover pages carry the block ("B L O C K 1"); table pages
 * carry "WEEK N: DAYS a-b" and one table per day whose header starts
 * with the day name ("LEGS #1"). Weeks restart per block, so the
 * contract week is counted globally.
 */

import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonWeek } from "../data/programs/schema";
import { splitVariant } from "./exercise-variant";
import { cellText, complexReps, doseFromPdf, joinNotes, percentOrRpe, restFromPdf, sentenceCase, SUPERSET_RE, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplParseResult, PplSkippedRow, SheetMeta } from "./ppl-sheet";

const COVER_BLOCK_RE = /^B\s*L\s*O\s*C\s*K\s*(\d)$/;
const WEEK_RE = /^WEEK\s+(\d+):\s*DAYS/i;

function isDayTable(t: string[][]): boolean {
  return t.length > 1 && t[0].length === 11 && t[0][1] === "SETS" && t[0][2] === "REPS";
}

export function parsePpl1(dump: PdfTables, meta: SheetMeta): PplParseResult {
  const blocks: ProgramJsonBlock[] = [];
  const skipped: PplSkippedRow[] = [];
  let block: ProgramJsonBlock | null = null;
  let week: ProgramJsonWeek | null = null;
  let localWeek = 0;
  let globalWeek = 0;

  for (const page of dump.pages) {
    const lines = page.text.map((l) => l.trim());
    const dayTables = page.tables.filter(isDayTable);
    // A cover page has no day tables and names the block in spaced
    // letters. A table page also prints "BLOCK 1" in its running head,
    // so the block is only read from pages without day tables.
    if (dayTables.length === 0) {
      const coverBlock = lines.map((l) => COVER_BLOCK_RE.exec(l)).find(Boolean);
      if (coverBlock) {
        const name = `Block ${coverBlock[1]}`;
        if (!block || block.name !== name) {
          block = { name, weeks: [] };
          blocks.push(block);
          localWeek = 0;
        }
      }
      continue;
    }
    const weekLine = lines.map((l) => WEEK_RE.exec(l)).find(Boolean);
    if (weekLine) {
      if (!block) throw new Error(`page ${page.page}: week header before any block cover`);
      const n = Number(weekLine[1]);
      if (n !== localWeek) {
        localWeek = n;
        globalWeek++;
        week = { week: globalWeek, days: [] };
        block.weeks.push(week);
      }
    }
    for (const table of dayTables) {
      if (!week || !block) throw new Error(`page ${page.page}: day table before any week header`);
      const day: ProgramJsonDay = { name: titleCaseName(table[0][0]), exercises: [] };
      week.days.push(day);
      for (const row of table.slice(1)) {
        const rawName = cellText(row[0]);
        if (!rawName) continue;
        const ss = SUPERSET_RE.exec(rawName);
        const bare = rawName.replace(SUPERSET_RE, "");
        const sd = doseFromPdf(row[1], complexReps(bare, row[2]));
        if (!sd) {
          skipped.push({ block: block.name, week: week.week, day: day.name, name: rawName, reason: `no dose from sets ${JSON.stringify(row[1])} and reps ${JSON.stringify(row[2])}` });
          continue;
        }
        const { rpe, loadNote } = percentOrRpe(row[3]);
        const split = splitVariant(titleCaseName(bare));
        day.exercises.push({
          name: split.name,
          variant: split.variant,
          warmUp: null,
          dose: sd.dose,
          rpe,
          rest: restFromPdf(row[4]),
          sub1: null,
          sub2: null,
          notes: joinNotes([ss ? `Superset ${ss[1]}` : null, sentenceCase(row[9]), loadNote, sd.note]),
        });
      }
    }
  }

  const program: ProgramJson = { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
  return { program, skipped };
}
