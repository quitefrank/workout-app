/**
 * Convert the PPL 1.0 PDF dump into programme JSON under
 * scripts/data/programs/ (gitignored).
 *
 *   bun run convert:ppl1 [path-to-dump.json]
 *
 * Writes nothing and exits 1 when any row could not be dosed.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPdfTables } from "./lib/pdf-program";
import { parsePpl1 } from "./lib/ppl1-pdf";
import { formatSkippedRow } from "./lib/ppl-sheet";
import { programWeeks, validateProgramJson } from "./data/programs/schema";

const input = process.argv[2] ?? fileURLToPath(new URL("./data/programs/raw/nippard-ppl-1.0.json", import.meta.url));
const out = fileURLToPath(new URL("./data/programs/nippard-ppl-1.0.json", import.meta.url));

const { program: parsed, skipped } = parsePpl1(loadPdfTables(input), {
  name: "Jeff Nippard, Legs/Push/Pull Hypertrophy Program (PPL 1.0)",
  description: "Sixteen weeks in two eight-week blocks, six days a week: Legs, Push, Pull, Legs, Push, Pull. Block 1 is the technique phase. Loads given as a percentage of 1RM are in the row notes. Personal copy; not redistributed.",
  citation: "Nippard J. Legs/Push/Pull Hypertrophy Program.",
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
