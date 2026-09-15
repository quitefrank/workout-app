/**
 * Dump the Nippard PDFs in scripts/data/programs/sources/ (gitignored,
 * purchased content) to scripts/data/programs/raw/ (gitignored) for the
 * converters. One JSON per PDF, via scripts/extract-pdf-tables.py.
 *
 *   bun run extract:pdfs [sources-dir]
 */

import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCES = ["nippard-ppl-1.0.pdf", "nippard-powerbuilding-4x.pdf", "nippard-arm-hypertrophy.pdf"];

const dir = process.argv[2] ?? fileURLToPath(new URL("./data/programs/sources/", import.meta.url));
const outDir = fileURLToPath(new URL("./data/programs/raw/", import.meta.url));
const script = fileURLToPath(new URL("./extract-pdf-tables.py", import.meta.url));
mkdirSync(outDir, { recursive: true });

for (const file of SOURCES) {
  const out = join(outDir, file.replace(/\.pdf$/, ".json"));
  const proc = spawnSync("python3", [script, join(dir, file), out], { stdio: "inherit" });
  if (proc.status !== 0) {
    console.error(`${file}: extraction failed (exit ${proc.status ?? "signal"})`);
    process.exit(1);
  }
}
