/**
 * Convert the Arm Hypertrophy PDF dump into programme JSON under
 * scripts/data/programs/ (gitignored).
 *
 *   bun run convert:arm [path-to-dump.json]
 *
 * Writes nothing and exits 1 when any row could not be dosed.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArm } from "./lib/arm-pdf";
import { loadPdfTables } from "./lib/pdf-program";
import { formatSkippedRow } from "./lib/ppl-sheet";
import { programWeeks, validateProgramJson } from "./data/programs/schema";

const input = process.argv[2] ?? fileURLToPath(new URL("./data/programs/raw/nippard-arm-hypertrophy.json", import.meta.url));
const out = fileURLToPath(new URL("./data/programs/nippard-arm-hypertrophy.json", import.meta.url));

const { program: parsed, skipped } = parseArm(loadPdfTables(input), {
  name: "Jeff Nippard, Arm Hypertrophy Program",
  description: "Eight weeks in two blocks of four, three add-on days a week (Arm Day, Supplemental A, Supplemental B) run alongside another split. Tempo is in the row notes. Personal copy; not redistributed.",
  citation: "Nippard J. Arm Hypertrophy Program.",
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
