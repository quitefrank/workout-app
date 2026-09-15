/**
 * Convert the Powerbuilding 4x PDF dump into programme JSON under
 * scripts/data/programs/ (gitignored).
 *
 *   bun run convert:powerbuilding [path-to-dump.json]
 *
 * Writes nothing and exits 1 when any row could not be dosed. What the
 * parser left out on purpose (max testing option B) is printed as a
 * note, not an error.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPdfTables } from "./lib/pdf-program";
import { parsePowerbuilding } from "./lib/powerbuilding-pdf";
import { formatSkippedRow } from "./lib/ppl-sheet";
import { programWeeks, validateProgramJson } from "./data/programs/schema";

const input = process.argv[2] ?? fileURLToPath(new URL("./data/programs/raw/nippard-powerbuilding-4x.json", import.meta.url));
const out = fileURLToPath(new URL("./data/programs/nippard-powerbuilding-4x.json", import.meta.url));

const { program: parsed, skipped, omitted } = parsePowerbuilding(loadPdfTables(input), {
  name: "Jeff Nippard, Powerbuilding System (4x per week)",
  description: "Eleven weeks, four days a week: odd weeks are full body strength days, even weeks are upper and lower hypertrophy days. Week 10 is max testing (option A; option B, for competitive powerlifters, is not loaded) and week 11 is a deload. The optional arm and pump day is the fifth day of the odd weeks. Loads given as a percentage of 1RM are in the row notes. Personal copy; not redistributed.",
  citation: "Nippard J. Powerbuilding System, 4x version. 2020.",
  sourceUrl: null,
});

for (const line of omitted) console.log(`note: ${line}`);

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
