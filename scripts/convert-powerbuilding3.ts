/**
 * Convert the Powerbuilding Phase 3.0 (5x) PDF dump into program JSON
 * under scripts/data/programs/ (gitignored).
 *
 *   bun run convert:powerbuilding3 [path-to-dump.json]
 *
 * Writes nothing and exits 1 when any row could not be dosed. What the
 * parser left out on purpose (max testing option A) is printed as a
 * note, not an error.
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { loadPdfTables } from "./lib/pdf-program";
import { parsePowerbuilding3 } from "./lib/powerbuilding3-pdf";
import { formatSkippedRow } from "./lib/ppl-sheet";
import { programWeeks, validateProgramJson } from "./data/programs/schema";

const input = process.argv[2] ?? fileURLToPath(new URL("./data/programs/raw/nippard-powerbuilding-3-5x.json", import.meta.url));
const out = fileURLToPath(new URL("./data/programs/nippard-powerbuilding-3-5x.json", import.meta.url));

const { program: parsed, skipped, omitted } = parsePowerbuilding3(loadPdfTables(input), {
  name: "Powerbuilding Phase 3.0",
  description: "Ten weeks, five full body days a week, peaking for strength on squat, bench press and deadlift: eight loading weeks with a semi-deload in week 5, a taper in week 9 and max testing in week 10 (option B, an AMRAP at 90%; option A, heavy singles for competitive powerlifters, is not loaded). Squat and bench three times a week, deadlift once. Loads given as a percentage of 1RM are in the row notes. Personal copy; not redistributed.",
  citation: "Nippard J. Powerbuilding Phase 3.0, 5x version. 2022.",
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
