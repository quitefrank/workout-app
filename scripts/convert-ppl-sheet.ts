/**
 * Convert the vault's Ultimate Push Pull Legs workbook into programme
 * JSON under scripts/data/programs/ (gitignored).
 *
 *   bun run convert:ppl [path-to-workbook.xlsx]
 *
 * Writes nothing and exits 1 when any exercise row could not be placed
 * or turned into a dose; every such row is printed.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { formatSkippedRow, parsePplWorkbook } from "./lib/ppl-sheet";
import { programWeeks, validateProgramJson } from "./data/programs/schema";

const input = process.argv[2] ?? "/Users/quitefrank/Claude/Personal/raw/training/nippard-ultimate-ppl-4x.xlsx";
const out = fileURLToPath(new URL("./data/programs/nippard-ultimate-ppl-4x.json", import.meta.url));

const { program: parsed, skipped } = parsePplWorkbook(XLSX.readFile(input), {
  name: "Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)",
  description: "Thirteen weeks in three blocks: base hypertrophy, maximum effort, supercompensation. Four days a week: Legs, Push, Pull, Full Body. Personal copy; not redistributed.",
  citation: "Nippard J. The Ultimate Push Pull Legs System, 4x version. 2023.",
  sourceUrl: null,
});

if (skipped.length > 0) {
  console.error(`${skipped.length} exercise rows did not convert; nothing written`);
  for (const s of skipped) console.error("  " + formatSkippedRow(s));
  process.exit(1);
}

const program = validateProgramJson(parsed);
writeFileSync(out, JSON.stringify(program, null, 2));
const days = program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days)).length;
const exercises = program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises))).length;
console.log(`wrote ${out}: ${program.blocks.length} blocks, ${programWeeks(program)} weeks, ${days} days, ${exercises} exercise rows`);
