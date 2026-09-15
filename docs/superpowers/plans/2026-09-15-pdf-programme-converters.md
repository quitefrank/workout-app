# PDF Programme Converters Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert three Jeff Nippard PDF programmes (PPL 1.0, Powerbuilding 4x, Arm Hypertrophy) into the programme JSON contract and seed them, so they sit in the library next to the PPL 4x programme.

**Architecture:** A small Python script (pdfplumber, already installed) dumps every page's text lines and tables from a PDF to a gitignored JSON file. One shared TypeScript helper module turns PDF cells into contract values (title-cased names, doses, rest, RPE or %1RM). One tested TypeScript parser per programme walks the dumped pages and builds the contract; one thin CLI per programme writes the gitignored programme JSON and exits 1 on any row it could not place. The existing seed loads them unchanged; the library map gets entries for the new exercises.

**Tech Stack:** Python 3 + pdfplumber (extraction only), TypeScript pure modules with Vitest, bun scripts, the existing programme contract and seed.

---

## Context for the implementer

Frank's workout app (Next.js + Supabase, bun, Vitest) already converts a Nippard workbook to programme JSON (`scripts/lib/ppl-sheet.ts`, `scripts/convert-ppl-sheet.ts`) and seeds it (`scripts/seed-programs.ts`). Read those two files, `scripts/data/programs/schema.ts` (the contract), `scripts/lib/exercise-variant.ts` (set-type splitting) and `scripts/data/programs/library.ts` (aliases and attributes the seed applies) before starting. The CLAUDE.md "Programmes" section describes the pipeline.

Sources (never modified, copyrighted, never committed) live in `/Users/quitefrank/Claude/Personal/raw/training/`: `nippard-ppl-1.0.pdf` (48 pages), `nippard-powerbuilding-4x.pdf` (115 pages), `nippard-arm-hypertrophy.pdf` (31 pages). `nippard-get-ready-manual.pdf` has no programme tables (gear checklist, 1RM testing, nutrition) and is out of scope.

Programme JSON and the raw dumps go under `scripts/data/programs/` and are gitignored by the existing rule `/scripts/data/programs/**/*.json` (only `example.json` is committed). Never `git add -f` them.

House rules: no em dashes anywhere (code, comments, docs, commit messages); Conventional Commit prefixes; parsers get tests before they hit real data; never `supabase db reset`; never print keys. Commit messages end with a blank line then `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`.

### What the PDFs contain (verified with pdfplumber)

**PPL 1.0.** Cover pages carry "B L O C K 1" or "B L O C K 2" as spaced letters. Table pages carry a text line `WEEK N: DAYS 1-4` (block 1: two pages per week, days 1-4 then 5-6) or `WEEK N: DAYS 1-3` (block 2: two pages per week, days 1-3 then 4-6); the second page of a week has no WEEK line. Each week restarts at 1 inside its block; there are 8 weeks per block, 16 total. Each day is one table with header `[dayName, "SETS", "REPS", "RPE/%1RM", "REST", "1", "2", "3", "4", "NOTES", "LSRPE"]` where dayName is `LEGS #1`, `PUSH #1`, `PULL #1`, `LEGS #2`, `PUSH #2`, `PULL #2`. Row cells: name (may contain `\n`), sets, reps, RPE or percent, rest, four log cells, notes (may contain `\n`), LSRPE. Superset rows start with `A1: `, `A2: `, `A3: `. Distinct cell forms seen: sets `1`..`5` and one `` ` 1`` artifact; reps `10`, `10-12`, `12 STEPS\nEACH LEG`, `15/15`, `20 EACH LEG`, `30SEC`, `4, 4`, `AMRAP`, `RPE 9 TEST`, plain ranges; RPE/%1RM `5`..`10`, `60%`, `65.00%`, `72.5%`, `90 %`; rest `0 MIN`, `0MIN`, `1-2 MIN`, `1-2MIN`, `2-3MIN`, `3-4MIN`.

**Powerbuilding 4x.** Programme pages 36-71. Each page's text has a line `JEFF NIPPARD'S - POWERBUILDING SYSTEM WEEK N`, or `WEEK 10A`, `WEEK 10B`, or `OPTIONAL DAY`. Tables have header `["WORKOUT", "EXERCISE", "WARM-UP SETS", "WORKING SETS", "REPS", "%1RM", "RPE", "REST", "SET 1", "SET 2", "SET 3", "SET 4", "NOTES"]`; the WORKOUT cell is filled on the first data row only (`FULL\nBODY 1:\nSQUAT,\nOHP`, `LOWER #1`, `LOWER # 2`, `UPPER #1`, `SQUAT\nTEST`, `FULL\nBODY 5:\nARM &\nPUMP DAY`). Weeks 1-9 have four workouts across two pages; 10A and 10B have three each on one page; 11 has four; the optional day page has one table. Pages 78 and 80 contain example tables with the same header but no WEEK line: skip any page without a week or optional-day marker. Superset rows start with `A1. `, `B2. `. Distinct forms: warm-up `0`..`5`; sets `1`, `1-3`, `2`, `3`, `4`; reps `1`, `10-SEC`, `12/12`, `15/15`, `3/3`, `21`, `AMRAP`, plain and ranges; %1RM `N/A`, `70%`, `72.5-77.5%`, `100-105%`; RPE `N/A`, `5`..`10`, `7.5`, `NO REPS`; rest `1-2 MIN`, `3-5 MIN`, `30SEC`.

**Arm Hypertrophy.** Programme pages 7-14, one page per week (text line `PROGRAM: WEEK N`, N = 1..8), block from a 2x1 table `["BLOCK"], ["1"]` (block 1 weeks 1-4, block 2 weeks 5-8). Three 11-column tables per page: first row `["ARM DAY", "", ...]` / `["SUPPLEMENTAL A", ...]` / `["SUPPLEMENTAL B", ...]`, second row `["DAY 1", "SETS", "REPS", "TEMPO", "APE", "REST", "1", "2", "3", "4", "NOTES"]` (APE is the PDF's spelling of RPE), then data rows, and at the end of Supplemental B two rows `WEEKLY BICEP VOLUME` and `WEEKLY TRICEP VOLUME`. Names span lines (`CLOSE GRIP BENCH\nPRESS`). Distinct forms: sets `0`, `2`, `3`, `4`; reps `0`, `10+5+5`, `7+7+7`, `40`, `50`, plain and ranges; tempo `-`, `1:0:1:0`, `2:0:1:0`, `2:0:2:0`, `2:1:1:1`; RPE ``, `7`..`10`; rest `1.0`, `1.5`, `2.0`, `3.0` (minutes). Two rows have sets `0` and reps `0` (`HEAVY NEGATIVE CONCENTRATION CURLS`, `REVERSE GRIP EZ BAR CURL (METABOLIC)`): the notes describe an open-ended set.

---

### Task 1: PDF table extractor

**Files:**
- Create: `scripts/extract-pdf-tables.py`
- Create: `scripts/extract-training-pdfs.ts`
- Modify: `package.json` (scripts)
- Modify: `scripts/lib/pdf-program.ts` is created in Task 2; this task only produces JSON

- [ ] **Step 1: The Python extractor**

```python
#!/usr/bin/env python3
"""Dump a PDF's pages to JSON for the programme converters.

    python3 scripts/extract-pdf-tables.py <input.pdf> <output.json>

Each page becomes {"page": n, "text": [lines], "tables": [[[cell]]]}
with pdfplumber's default table detection. Cells keep their line breaks;
the converters collapse them. Needs pdfplumber: python3 -m pip install pdfplumber
"""

import json
import os
import sys

import pdfplumber


def main(src: str, out: str) -> None:
    pages = []
    with pdfplumber.open(src) as pdf:
        for number, page in enumerate(pdf.pages, 1):
            text = (page.extract_text() or "").split("\n")
            tables = [
                [[cell if cell is not None else "" for cell in row] for row in table]
                for table in page.extract_tables()
            ]
            pages.append({"page": number, "text": text, "tables": tables})
    with open(out, "w", encoding="utf-8") as handle:
        json.dump({"file": os.path.basename(src), "pages": pages}, handle, ensure_ascii=False)
    print(f"wrote {out}: {len(pages)} pages, {sum(len(p['tables']) for p in pages)} tables")


if __name__ == "__main__":
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1], sys.argv[2])
```

- [ ] **Step 2: The bun wrapper that runs it for the three programmes**

```ts
/**
 * Dump the vault's Nippard PDFs to scripts/data/programs/raw/ (gitignored)
 * for the converters. One JSON per PDF, via scripts/extract-pdf-tables.py.
 *
 *   bun run extract:pdfs [vault-training-dir]
 */

import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SOURCES = ["nippard-ppl-1.0.pdf", "nippard-powerbuilding-4x.pdf", "nippard-arm-hypertrophy.pdf"];

const dir = process.argv[2] ?? "/Users/quitefrank/Claude/Personal/raw/training";
const outDir = fileURLToPath(new URL("./data/programs/raw/", import.meta.url));
const script = fileURLToPath(new URL("./extract-pdf-tables.py", import.meta.url));
mkdirSync(outDir, { recursive: true });

for (const file of SOURCES) {
  const out = join(outDir, file.replace(/\.pdf$/, ".json"));
  const proc = Bun.spawnSync(["python3", script, join(dir, file), out], { stdout: "inherit", stderr: "inherit" });
  if (proc.exitCode !== 0) {
    console.error(`${file}: extraction failed (exit ${proc.exitCode})`);
    process.exit(1);
  }
}
```

Add to `package.json` scripts, next to `convert:ppl`:

```json
"extract:pdfs": "bun run scripts/extract-training-pdfs.ts",
```

- [ ] **Step 3: Run it and check the dumps**

Run: `bun run extract:pdfs`
Expected: three lines like `wrote .../nippard-ppl-1.0.json: 48 pages, 128 tables`; files exist under `scripts/data/programs/raw/` and `git status` shows nothing new under `scripts/data/programs/` (gitignored). Confirm with: `git status --short scripts/data/programs` prints nothing.

- [ ] **Step 4: Commit**

```bash
git add scripts/extract-pdf-tables.py scripts/extract-training-pdfs.ts package.json
git commit -m "feat(programs): dump programme PDFs to JSON with pdfplumber"
```

---

### Task 2: Shared PDF helpers

**Files:**
- Create: `scripts/lib/pdf-program.ts`
- Test: `scripts/lib/__tests__/pdf-program.test.ts`
- Modify: `scripts/lib/exercise-variant.ts` (widen two regexes)
- Modify: `scripts/lib/__tests__/exercise-variant.test.ts`
- Modify: `scripts/lib/ppl-sheet.ts` (import `SUPERSET_RE` from the new module instead of defining it)

- [ ] **Step 1: Write the failing helper tests**

```ts
// @vitest-environment node

import { describe, expect, it } from "vitest";
import { cellText, doseFromPdf, percentOrRpe, restFromPdf, SUPERSET_RE, titleCaseName } from "../pdf-program";

describe("cellText", () => {
  it("collapses line breaks and blanks", () => {
    expect(cellText("CLOSE GRIP BENCH\nPRESS")).toBe("CLOSE GRIP BENCH PRESS");
    expect(cellText("  ")).toBeNull();
    expect(cellText("-")).toBeNull();
    expect(cellText("N/A")).toBeNull();
    expect(cellText(null)).toBeNull();
  });
});

describe("titleCaseName", () => {
  it("title-cases an all-caps name and keeps the known acronyms", () => {
    expect(titleCaseName("BARBELL BENCH PRESS")).toBe("Barbell Bench Press");
    expect(titleCaseName("REVERSE GRIP EZ BAR CURL")).toBe("Reverse Grip EZ Bar Curl");
    expect(titleCaseName("CHEST-SUPPORTED T-BAR ROW W/ BAND")).toBe("Chest-Supported T-Bar Row w/ Band");
    expect(titleCaseName("1-ARM OVERHEAD CABLE EXTENSION")).toBe("1-Arm Overhead Cable Extension");
    expect(titleCaseName("INCLINE DUMBBELL CURL (REVERSE 21'S)")).toBe("Incline Dumbbell Curl (Reverse 21's)");
    expect(titleCaseName("BARBELL OR EZ BAR CURL")).toBe("Barbell or EZ Bar Curl");
    expect(titleCaseName("ROUND-BACK DUMBBELL 45° HYPEREXTENSION")).toBe("Round-Back Dumbbell 45° Hyperextension");
    expect(titleCaseName("MILITARY PRESS / PUSH PRESS COMPLEX")).toBe("Military Press / Push Press Complex");
    expect(titleCaseName("NECK FLEXION/EXTENSION")).toBe("Neck Flexion/Extension");
  });
});

describe("SUPERSET_RE", () => {
  it("matches colon and dot prefixes", () => {
    expect("A1: LEG EXTENSION".replace(SUPERSET_RE, "")).toBe("LEG EXTENSION");
    expect("B2. TRICEPS PRESSDOWN".replace(SUPERSET_RE, "")).toBe("TRICEPS PRESSDOWN");
    expect(SUPERSET_RE.exec("C3. STANDING CALF RAISE")?.[1]).toBe("C");
  });
});

describe("restFromPdf", () => {
  it("normalises the PDF spellings to what the seed parses", () => {
    expect(restFromPdf("3-4MIN")).toBe("~3-4 min");
    expect(restFromPdf("1-2 MIN")).toBe("~1-2 min");
    expect(restFromPdf("0MIN")).toBe("0 min");
    expect(restFromPdf("0 MIN")).toBe("0 min");
    expect(restFromPdf("30SEC")).toBe("30 sec");
    expect(restFromPdf("3.0")).toBe("3 min");
    expect(restFromPdf("1.5")).toBe("90 sec");
    expect(restFromPdf("1.0")).toBe("1 min");
    expect(restFromPdf(null)).toBeNull();
  });
});

describe("percentOrRpe", () => {
  it("keeps an RPE and turns a percentage into a load note", () => {
    expect(percentOrRpe("7")).toEqual({ rpe: "7", loadNote: null });
    expect(percentOrRpe("7.5")).toEqual({ rpe: "7.5", loadNote: null });
    expect(percentOrRpe("8-9")).toEqual({ rpe: "8-9", loadNote: null });
    expect(percentOrRpe("70%")).toEqual({ rpe: null, loadNote: "Load: 70% 1RM" });
    expect(percentOrRpe("65.00%")).toEqual({ rpe: null, loadNote: "Load: 65% 1RM" });
    expect(percentOrRpe("72.5-77.5%")).toEqual({ rpe: null, loadNote: "Load: 72.5-77.5% 1RM" });
    expect(percentOrRpe("90 %")).toEqual({ rpe: null, loadNote: "Load: 90% 1RM" });
    expect(percentOrRpe("N/A")).toEqual({ rpe: null, loadNote: null });
    expect(percentOrRpe("NO REPS")).toEqual({ rpe: null, loadNote: "RPE as written: NO REPS" });
  });
});

describe("doseFromPdf", () => {
  it("passes plain sets and reps through", () => {
    expect(doseFromPdf("3", "8-10")).toEqual({ dose: "3 x 8-10", note: null });
    expect(doseFromPdf("1-3", "5")).toEqual({ dose: "1-3 x 5", note: null });
    expect(doseFromPdf("` 1", "AMRAP")).toEqual({ dose: "1 x AMRAP", note: null });
    expect(doseFromPdf("3", "30SEC")).toEqual({ dose: "3 x 30 sec", note: null });
    expect(doseFromPdf("1", "10-SEC")).toEqual({ dose: "1 x 10 sec", note: null });
  });

  it("keeps per-side and each-leg counts as a note", () => {
    expect(doseFromPdf("3", "15/15")).toEqual({ dose: "3 x 15", note: "15 per side" });
    expect(doseFromPdf("2", "20 EACH LEG")).toEqual({ dose: "2 x 20", note: "As written: 20 each leg" });
    expect(doseFromPdf("2", "12 STEPS\nEACH LEG")).toEqual({ dose: "2 x 12", note: "As written: 12 steps each leg" });
  });

  it("sums a rep-scheme cell and keeps the scheme", () => {
    expect(doseFromPdf("2", "7+7+7")).toEqual({ dose: "2 x 21", note: "Reps: 7 + 7 + 7" });
    expect(doseFromPdf("2", "10+5+5")).toEqual({ dose: "2 x 20", note: "Reps: 10 + 5 + 5" });
    expect(doseFromPdf("3", "4, 4")).toEqual({ dose: "3 x 4-4", note: "Reps per set: 4, 4" });
  });

  it("treats an RPE test cell as one rep and refuses what it cannot dose", () => {
    expect(doseFromPdf("1", "RPE 9 TEST")).toEqual({ dose: "1 x 1", note: "As written: RPE 9 TEST" });
    expect(doseFromPdf("0", "0")).toBeNull();
    expect(doseFromPdf("3", "")).toBeNull();
    expect(doseFromPdf("3", "SEE NOTES")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `bun run test scripts/lib/__tests__/pdf-program.test.ts`
Expected: FAIL, cannot find module `../pdf-program`.

- [ ] **Step 3: Write the module**

```ts
/**
 * Shared helpers for the PDF programme converters. The Python extractor
 * (scripts/extract-pdf-tables.py) dumps each page's text lines and
 * tables; these turn table cells into contract values the way
 * ppl-sheet.ts does for the workbook.
 */

import { existsSync, readFileSync } from "node:fs";
import { doseFromSheet, type SheetDose } from "./ppl-sheet";
import { parseDose } from "../../src/lib/recovery/dose";

export type PdfPage = { page: number; text: string[]; tables: string[][][] };
export type PdfTables = { file: string; pages: PdfPage[] };

/** Read a dump written by scripts/extract-pdf-tables.py; throws with a hint when it is missing. */
export function loadPdfTables(path: string): PdfTables {
  if (!existsSync(path)) throw new Error(`${path} is missing; run \`bun run extract:pdfs\` first`);
  const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as PdfTables).pages)) {
    throw new Error(`${path}: expected {"file", "pages": [...]}`);
  }
  return raw as PdfTables;
}

/** "A1: " or "B2. " superset prefix; group 1 is the letter, group 2 the slot. */
export const SUPERSET_RE = /^([A-Z])(\d)[.:]\s*/;

/** Collapse a cell to one line; blanks, "-" and "N/A" are null. */
export function cellText(v: string | null | undefined): string | null {
  if (v === null || v === undefined) return null;
  const t = v.replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
  if (t === "" || t === "-" || t.toUpperCase() === "N/A") return null;
  return t;
}

const KEEP_UPPER = new Set(["EZ", "DB", "BB", "RDL", "OHP", "GHR", "ROM", "AMRAP", "RPE"]);
const SMALL_WORDS = new Set(["or", "and", "w/", "to", "of", "the", "a", "with", "at", "in", "on", "for"]);

function capitalise(word: string): string {
  if (word === "") return word;
  const upper = word.toUpperCase();
  if (KEEP_UPPER.has(upper)) return upper;
  return word[0].toUpperCase() + word.slice(1).toLowerCase();
}

/**
 * Title-case an all-caps PDF name: each word and each hyphen or slash
 * part capitalised, known acronyms kept, small words lowered after the
 * first. Punctuation stays where it is.
 */
export function titleCaseName(raw: string): string {
  const words = (cellText(raw) ?? "").split(" ");
  return words
    .map((word, i) => {
      const lower = word.toLowerCase();
      if (i > 0 && SMALL_WORDS.has(lower)) return lower;
      return word
        .split(/([-/(])/)
        .map((part) => (part === "-" || part === "/" || part === "(" ? part : capitalise(part)))
        .join("");
    })
    .join(" ");
}

/** Rest as the seed's parseRestSeconds reads it: "~3-4 min", "0 min", "30 sec", "90 sec". */
export function restFromPdf(raw: string | null | undefined): string | null {
  const t = cellText(raw);
  if (!t) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)(?:\s*-\s*(\d+))?\s*min$/i.exec(t))) return m[2] ? `~${m[1]}-${m[2]} min` : `${m[1]} min`;
  if ((m = /^(\d+)\s*sec$/i.exec(t))) return `${m[1]} sec`;
  if ((m = /^\d+(?:\.\d+)?$/.exec(t))) {
    const minutes = Number(t);
    return Number.isInteger(minutes) ? `${minutes} min` : `${Math.round(minutes * 60)} sec`;
  }
  return t;
}

export type RpeCell = { rpe: string | null; loadNote: string | null };

/** An RPE cell that may hold a percentage of 1RM instead; the percentage becomes a note. */
export function percentOrRpe(raw: string | null | undefined): RpeCell {
  const t = cellText(raw);
  if (!t) return { rpe: null, loadNote: null };
  let m: RegExpExecArray | null;
  if ((m = /^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?\s*%$/.exec(t))) {
    const trim = (x: string) => String(Number(x));
    return { rpe: null, loadNote: `Load: ${trim(m[1])}${m[2] ? `-${trim(m[2])}` : ""}% 1RM` };
  }
  if (/^\d+(?:\.\d+)?(?:\s*-\s*\d+(?:\.\d+)?)?$/.test(t)) return { rpe: t.replace(/\s+/g, ""), loadNote: null };
  return { rpe: null, loadNote: `RPE as written: ${t}` };
}

/**
 * Sets and reps cells to a parseDose string plus a note for what the
 * dose cannot carry (per side, each leg, a rep scheme, a test set).
 * Null when the pair cannot be dosed; the converter reports the row.
 */
export function doseFromPdf(setsCell: string | null | undefined, repsCell: string | null | undefined): SheetDose | null {
  const sets = (cellText(setsCell) ?? "").replace(/[^0-9-]/g, "");
  let reps = cellText(repsCell) ?? "";
  // "0 / 0" is how the arm programme writes an open-ended set; the
  // converter decides what to do with it, not the dose.
  if (/^0+$/.test(sets) || /^0+$/.test(reps)) return null;
  let note: string | null = null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d+)\s*\/\s*(\d+)$/.exec(reps)) && m[1] === m[2]) {
    note = `${m[1]} per side`;
    reps = m[1];
  } else if ((m = /^(\d+)\s+(?:steps\s+)?each\s+(?:leg|side|arm)$/i.exec(reps))) {
    note = `As written: ${reps.toLowerCase()}`;
    reps = m[1];
  } else if (/^\d+(?:\s*\+\s*\d+)+$/.test(reps)) {
    const parts = reps.split("+").map((x) => Number(x.trim()));
    note = `Reps: ${parts.join(" + ")}`;
    reps = String(parts.reduce((a, b) => a + b, 0));
  } else if ((m = /^(\d+)\s*-\s*sec$/i.exec(reps))) {
    reps = `${m[1]}sec`;
  } else if (/^rpe\s*\d+\s*test$/i.test(reps)) {
    note = `As written: ${reps}`;
    reps = "1";
  }
  const sd = doseFromSheet(sets, reps);
  if (!sd || !parseDose(sd.dose)) return null;
  return { dose: sd.dose, note: [note, sd.note].filter(Boolean).join(". ") || null };
}
```

`doseFromSheet` in `ppl-sheet.ts` handles `AMRAP`, `30SEC`, plain, ranges and `4, 4`; check its seconds regex accepts `10sec` (it accepts `s`, `sec`, `secs` after digits with optional space). If `"3 x 4-4"` is rejected by `parseDose`, change the per-set-list branch of `doseFromSheet` to emit `${min}` when min equals max, and adjust the test to expect `"3 x 4"`.

`SUPERSET_RE` stays defined in `ppl-sheet.ts` (change its regex there to `/^([A-Z])(\d)[.:]\s*/` and add `export`); `pdf-program.ts` re-exports it with `export { SUPERSET_RE } from "./ppl-sheet";` instead of the definition shown above, so there is no import cycle (`pdf-program.ts` already imports `doseFromSheet` from `ppl-sheet.ts`).

- [ ] **Step 4: Widen the variant regexes**

In `scripts/lib/exercise-variant.ts`:
- `SET_TYPE_RE`: add `(?:reverse )?21'?s`, `descending rom`, `metabolic`, `optional` to the alternation.
- `TRAILING_SCHEME_RE`: `/^(.*?)\s+(ladder|(?:reverse )?21'?s)$/i`. Normalise the captured scheme: `21s` becomes `21's`, a leading `reverse ` becomes `Reverse `, and `ladder` keeps the source spelling as before (so "Incline Dumbbell Curl Reverse 21's" gives name "Incline Dumbbell Curl", variant "Reverse 21's"; "Cable Crossover Ladder" still gives "Ladder"). Parenthetical set types keep the source spelling, so "(Reverse 21's)" gives "Reverse 21's" and "(Descending ROM)" gives "Descending ROM".

Add tests to `exercise-variant.test.ts`:

```ts
  it("handles the PDF spellings of rep schemes and optional rows", () => {
    expect(splitVariant("Incline Dumbbell Curl (Reverse 21's)")).toEqual({ name: "Incline Dumbbell Curl", variant: "Reverse 21's", dropped: null });
    expect(splitVariant("Incline Dumbbell Curl Reverse 21's")).toEqual({ name: "Incline Dumbbell Curl", variant: "Reverse 21's", dropped: null });
    expect(splitVariant("Standing EZ Bar Curl (Descending ROM)")).toEqual({ name: "Standing EZ Bar Curl", variant: "Descending ROM", dropped: null });
    expect(splitVariant("Reverse Grip EZ Bar Curl (Metabolic)")).toEqual({ name: "Reverse Grip EZ Bar Curl", variant: "Metabolic", dropped: null });
    expect(splitVariant("Neck Flexion/Extension (Optional)")).toEqual({ name: "Neck Flexion/Extension", variant: "Optional", dropped: null });
    expect(splitVariant("Weighted Dip (Close Grip)")).toEqual({ name: "Weighted Dip (Close Grip)", variant: null, dropped: null });
  });
```

- [ ] **Step 5: Run all tests**

Run: `bun run test && bunx tsc --noEmit && bun run lint`
Expected: PASS (previous 253 plus the new ones), clean.

- [ ] **Step 6: Commit**

```bash
git add scripts/lib/pdf-program.ts scripts/lib/__tests__/pdf-program.test.ts scripts/lib/exercise-variant.ts scripts/lib/__tests__/exercise-variant.test.ts scripts/lib/ppl-sheet.ts
git commit -m "feat(programs): shared helpers for PDF programme cells"
```

---

### Task 3: PPL 1.0 converter

**Files:**
- Create: `scripts/lib/ppl1-pdf.ts`
- Create: `scripts/convert-ppl1.ts`
- Test: `scripts/lib/__tests__/ppl1-pdf.test.ts`
- Modify: `package.json` (add `"convert:ppl1": "bun run scripts/convert-ppl1.ts"`)

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parsePpl1 } from "../ppl1-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const HEADER = (day: string) => [day, "SETS", "REPS", "RPE/%1RM", "REST", "1", "2", "3", "4", "NOTES", "LSRPE"];
const META = { name: "Test PPL", description: "d", citation: null, sourceUrl: null };

function cover(block: number): PdfTables["pages"][number] {
  return { page: 0, text: [`B L O C K ${block}`, "L E G S / P U S H / P U L L", "PROGRAM"], tables: [[["", `B L O C K ${block}`]], [["W E E K"], ["1"]]] };
}

const DUMP: PdfTables = {
  file: "test.pdf",
  pages: [
    cover(1),
    {
      page: 2,
      text: ["LEGS/PUSH/PULL HYPERTROPHY PROGRAM", "WEEK 1: DAYS 1-4", "BLOCK 1"],
      tables: [
        [HEADER("LEGS #1"), ["BACK SQUAT", "4", "5", "70%", "3-4MIN", "", "", "", "", "SIT BACK AND DOWN", ""], ["A1: LEG EXTENSION", "3", "15", "7", "0 MIN", "", "", "", "", "SQUEEZE", ""], ["A2: SEATED LEG CURL", "3", "15", "7", "1-2MIN", "", "", "", "", "", ""]],
        [HEADER("PUSH #1"), ["DUMBBELL ISOLATERAL SKULL\nCRUSHER", "3", "12", "8", "1-2MIN", "", "", "", "", "USE 1 DUMBBELL\nIN EACH HAND", ""], ["PLANK", "3", "30SEC", "7", "1-2MIN", "", "", "", "", "", ""]],
      ],
    },
    {
      page: 3,
      text: ["PULL #1 SETS REPS RPE/%1RM REST 1 2 3 4 NOTES LSRPE"],
      tables: [[HEADER("PULL #1"), ["REVERSE PEC DECK", "3", "15/15", "7", "1-2MIN", "", "", "", "", "", ""], ["DUMBBELL WALKING LUNGE", "2", "20 EACH LEG", "7", "1-2MIN", "", "", "", "", "", ""]]],
    },
    cover(1),
    {
      page: 5,
      text: ["LEGS/PUSH/PULL HYPERTROPHY PROGRAM", "WEEK 2: DAYS 1-4"],
      tables: [[HEADER("LEGS #1"), ["BACK SQUAT", "4", "5", "72.50%", "3-4MIN", "", "", "", "", "", ""]]],
    },
    cover(2),
    {
      page: 7,
      text: ["LEGS/PUSH/PULL HYPERTROPHY PROGRAM", "WEEK 1: DAYS 1-3"],
      tables: [[HEADER("LEGS #1"), ["DEADLIFT", "` 1", "RPE 9 TEST", "9", "3-4MIN", "", "", "", "", "", ""], ["MYSTERY MOVE", "3", "SEE NOTES", "7", "1-2MIN", "", "", "", "", "", ""]]],
    },
  ],
};

describe("parsePpl1", () => {
  it("builds blocks, global weeks and days from the page markers", () => {
    const { program } = parsePpl1(DUMP, META);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([
      ["Block 1", [1, 2]],
      ["Block 2", [3]],
    ]);
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Legs #1", "Push #1", "Pull #1"]);
  });

  it("maps cells to the contract", () => {
    const { program } = parsePpl1(DUMP, META);
    const legs = program.blocks[0].weeks[0].days[0].exercises;
    expect(legs[0]).toMatchObject({ name: "Back Squat", variant: null, dose: "4 x 5", rpe: null, rest: "~3-4 min", warmUp: null, sub1: null, sub2: null });
    expect(legs[0].notes).toBe("Sit back and down. Load: 70% 1RM");
    expect(legs[1]).toMatchObject({ name: "Leg Extension", dose: "3 x 15", rpe: "7", rest: "0 min" });
    expect(legs[1].notes).toBe("Superset A. Squeeze");
    expect(legs[2].notes).toBe("Superset A");
    const push = program.blocks[0].weeks[0].days[1].exercises;
    expect(push[0]).toMatchObject({ name: "Dumbbell Isolateral Skull Crusher", notes: "Use 1 dumbbell in each hand" });
    expect(push[1]).toMatchObject({ dose: "3 x 30 sec" });
    const pull = program.blocks[0].weeks[0].days[2].exercises;
    expect(pull[0]).toMatchObject({ dose: "3 x 15", notes: "15 per side" });
    expect(pull[1]).toMatchObject({ dose: "2 x 20", notes: "As written: 20 each leg" });
    expect(program.blocks[0].weeks[1].days[0].exercises[0].notes).toBe("Load: 72.5% 1RM");
  });

  it("reports rows it cannot dose and never drops them", () => {
    const { program, skipped } = parsePpl1(DUMP, META);
    expect(skipped).toEqual([{ block: "Block 2", week: 3, day: "Legs #1", name: "MYSTERY MOVE", reason: expect.stringContaining("no dose") }]);
    expect(program.blocks[1].weeks[0].days[0].exercises[0]).toMatchObject({ name: "Deadlift", dose: "1 x 1", notes: "As written: RPE 9 TEST" });
  });

  it("produces a valid programme whose doses all parse", () => {
    const { program } = parsePpl1(DUMP, META);
    const valid = validateProgramJson(program);
    for (const b of valid.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) expect(parseDose(e.dose), e.name).not.toBeNull();
  });
});
```

Notes sentence-casing: the PDF notes are ALL CAPS. The converter lowercases them and capitalises the first letter of each sentence (split on `. `), so "SIT BACK AND DOWN" becomes "Sit back and down". Acronyms inside notes (ROM, RPE, DB, GHR) stay upper through the same `KEEP_UPPER` set: implement `sentenceCase(raw)` in `pdf-program.ts` (lowercase everything, capitalise sentence starts, restore `KEEP_UPPER` tokens word by word) and add two tests for it in `pdf-program.test.ts`:

```ts
describe("sentenceCase", () => {
  it("lowercases shouted notes and keeps acronyms", () => {
    expect(sentenceCase("SIT BACK AND DOWN. FULL ROM, KEEP YOUR RPE HONEST")).toBe("Sit back and down. Full ROM, keep your RPE honest");
    expect(sentenceCase("USE 1 DUMBBELL\nIN EACH HAND")).toBe("Use 1 dumbbell in each hand");
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test scripts/lib/__tests__/ppl1-pdf.test.ts`
Expected: FAIL, cannot find module `../ppl1-pdf`.

- [ ] **Step 3: Write the parser**

```ts
/**
 * Parse the Legs/Push/Pull (PPL 1.0) PDF dump into the programme
 * contract. Cover pages carry the block ("B L O C K 1"); table pages
 * carry "WEEK N: DAYS a-b" and one table per day whose header starts
 * with the day name ("LEGS #1"). Weeks restart per block, so the
 * contract week is counted globally.
 */

import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonWeek } from "../data/programs/schema";
import { splitVariant } from "./exercise-variant";
import { cellText, doseFromPdf, percentOrRpe, restFromPdf, sentenceCase, SUPERSET_RE, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplParseResult, PplSkippedRow } from "./ppl-sheet";
import type { SheetMeta } from "./ppl-sheet";

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
        const sd = doseFromPdf(row[1], row[2]);
        if (!sd) {
          skipped.push({ block: block.name, week: week.week, day: day.name, name: rawName, reason: `no dose from sets ${JSON.stringify(row[1])} and reps ${JSON.stringify(row[2])}` });
          continue;
        }
        const { rpe, loadNote } = percentOrRpe(row[3]);
        const split = splitVariant(titleCaseName(bare));
        const notes = [ss ? `Superset ${ss[1]}` : null, sentenceCase(row[9]), loadNote, sd.note].filter(Boolean).join(". ");
        day.exercises.push({
          name: split.name,
          variant: split.variant,
          warmUp: null,
          dose: sd.dose,
          rpe,
          rest: restFromPdf(row[4]),
          sub1: null,
          sub2: null,
          notes: notes || null,
        });
      }
    }
  }

  const program: ProgramJson = { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
  return { program, skipped };
}
```

`sentenceCase(null)` must return null (it takes `string | null | undefined` and uses `cellText` first).

- [ ] **Step 4: Run the tests**

Run: `bun run test scripts/lib/__tests__/ppl1-pdf.test.ts`
Expected: PASS. If `"Legs #1"` title-cases to something else, fix `titleCaseName` so `#1` survives.

- [ ] **Step 5: The CLI**

```ts
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
```

- [ ] **Step 6: Run it on the real dump**

Run: `bun run convert:ppl1`
Expected: `2 blocks, 16 weeks, 96 days` and around 780 rows. If rows are skipped, print them, then decide: a cell form the helpers should handle (add it to `doseFromPdf` with a test) or a one-off (add a `ROW_OVERRIDES` map in `ppl1-pdf.ts` keyed by the raw name with the dose and note, documented in the module comment). Then rerun until it writes.

Check the distinct names and variants: `bun -e 'const p=JSON.parse(await Bun.file("scripts/data/programs/nippard-ppl-1.0.json").text()); const s=new Set(); for(const b of p.blocks)for(const w of b.weeks)for(const d of w.days)for(const e of d.exercises)s.add(e.name+(e.variant?" | "+e.variant:"")); console.log([...s].sort().join("\n"))'`. Read the list for casing mistakes (a stray "Ez", "Db", "Rom") and fix `KEEP_UPPER` or `titleCaseName` rather than the data.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/ppl1-pdf.ts scripts/lib/__tests__/ppl1-pdf.test.ts scripts/convert-ppl1.ts package.json scripts/lib/pdf-program.ts scripts/lib/__tests__/pdf-program.test.ts
git commit -m "feat(programs): convert the PPL 1.0 PDF to programme JSON"
```

---

### Task 4: Powerbuilding 4x converter

**Files:**
- Create: `scripts/lib/powerbuilding-pdf.ts`
- Create: `scripts/convert-powerbuilding.ts`
- Test: `scripts/lib/__tests__/powerbuilding-pdf.test.ts`
- Modify: `package.json` (add `"convert:powerbuilding": "bun run scripts/convert-powerbuilding.ts"`)

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parsePowerbuilding } from "../powerbuilding-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const HEADER = ["WORKOUT", "EXERCISE", "WARM-UP SETS", "WORKING SETS", "REPS", "%1RM", "RPE", "REST", "SET 1", "SET 2", "SET 3", "SET 4", "NOTES"];
const META = { name: "Test PB", description: "d", citation: null, sourceUrl: null };
const row = (workout: string, name: string, warm: string, sets: string, reps: string, pct: string, rpe: string, rest: string, notes: string) => [workout, name, warm, sets, reps, pct, rpe, rest, "", "", "", "", notes];

function weekPage(n: string, tables: string[][][]): PdfTables["pages"][number] {
  return { page: 0, text: [`JEFF NIPPARD'S - POWERBUILDING SYSTEM WEEK ${n}`], tables };
}

const DUMP: PdfTables = {
  file: "test.pdf",
  pages: [
    { page: 1, text: ["W E E K 1", "POWERBUILDING", "SYSTEM"], tables: [] },
    weekPage("1", [
      [HEADER, row("FULL\nBODY 1:\nSQUAT,\nOHP", "BACK SQUAT", "4", "1", "5", "75-80%", "7.5", "3-4 MIN", "FOCUS ON TECHNIQUE"), row("", "BACK SQUAT", "0", "2", "8", "70%", "N/A", "3-4 MIN", "")],
      [HEADER, row("FULL\nBODY 2:\nDEADLIFT,\nBENCH\nPRESS", "CHEST-SUPPORTED T-BAR ROW\nOR PENDLAY ROW", "1", "3", "10", "N/A", "7", "1-2 MIN", "STAY LIGHT")],
    ]),
    weekPage("2", [[HEADER, row("LOWER # 2", "LEG PRESS", "1", "3", "12/12", "N/A", "8", "1-2 MIN", "")]]),
    weekPage("10A", [[HEADER, row("SQUAT\nTEST", "BACK SQUAT", "4", "1", "AMRAP", "90%", "9.5", "4-5 MIN", "AIM TO 3+ REPS")]]),
    weekPage("10B", [[HEADER, row("SQUAT\nMAX", "BACK SQUAT", "4", "1", "1", "100-105%", "NO REPS", "4-5 MIN", "")]]),
    weekPage("11", [[HEADER, row("LOWER #1", "BACK SQUAT", "2", "2", "5", "60%", "N/A", "3-4 MIN", "")]]),
    { page: 9, text: ["JEFF NIPPARD'S - POWERBUILDING SYSTEM OPTIONAL DAY", "ARM & HYPERTROPHY DAY: OPTIONALLY RUN THIS DAY ON THE ODD WEEKS"], tables: [[HEADER, row("FULL\nBODY 5:\nARM &\nPUMP DAY", "A1. BARBELL OR EZ BAR CURL", "1", "3", "12", "N/A", "8", "30SEC", "MINIMIZE MOMENTUM."), row("", "B1. INCLINE DUMBBELL CURL\n(REVERSE 21'S)", "0", "3", "21", "N/A", "10", "30SEC", "")]] },
    { page: 10, text: ["TABLE 1: RESISTANCE TRAINING-SPECIFIC RIR-BASED RPE SCALE"], tables: [[HEADER, row("EXAMPLE", "BACK SQUAT", "4", "1", "5", "75-80%", "8", "3-4 MIN", "TOP SET")]] },
  ],
};

describe("parsePowerbuilding", () => {
  it("builds the three blocks, keeps option A for week 10 and reports option B as omitted", () => {
    const { program, omitted } = parsePowerbuilding(DUMP, META);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([
      ["Powerbuilding", [1, 2]],
      ["Max Testing", [3]],
      ["Deload", [4]],
    ]);
    expect(omitted).toEqual(["Week 10B (max testing option B, competitive powerlifters): 1 table not converted; option A is the one loaded"]);
  });

  it("names days from the WORKOUT cell without a colon", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Full Body 1 (Squat, OHP)", "Full Body 2 (Deadlift, Bench Press)", "Optional Arm and Pump Day"]);
    expect(program.blocks[0].weeks[1].days.map((d) => d.name)).toEqual(["Lower #2"]);
    expect(program.blocks[1].weeks[0].days.map((d) => d.name)).toEqual(["Squat Test"]);
  });

  it("maps cells to the contract", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const fb1 = program.blocks[0].weeks[0].days[0].exercises;
    expect(fb1[0]).toMatchObject({ name: "Back Squat", warmUp: "4", dose: "1 x 5", rpe: "7.5", rest: "~3-4 min", notes: "Focus on technique. Load: 75-80% 1RM" });
    expect(fb1[1]).toMatchObject({ name: "Back Squat", warmUp: null, dose: "2 x 8", rpe: null, notes: "Load: 70% 1RM" });
    const fb2 = program.blocks[0].weeks[0].days[1].exercises;
    expect(fb2[0]).toMatchObject({ name: "Chest-Supported T-Bar Row", sub1: "Pendlay Row", sub2: null, dose: "3 x 10", rpe: "7" });
    expect(program.blocks[0].weeks[1].days[0].exercises[0]).toMatchObject({ dose: "3 x 12", notes: "12 per side" });
    expect(program.blocks[1].weeks[0].days[0].exercises[0]).toMatchObject({ dose: "1 x AMRAP", rpe: "9.5", notes: "Aim to 3+ reps. Load: 90% 1RM" });
  });

  it("puts the optional day last on odd weeks only, with its arm-curl choice as a substitution", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const optional = program.blocks[0].weeks[0].days[2].exercises;
    expect(optional[0]).toMatchObject({ name: "EZ Bar Curl", sub1: "Barbell Curl", rest: "30 sec", notes: "Superset A. Minimize momentum." });
    expect(optional[1]).toMatchObject({ name: "Incline Dumbbell Curl", variant: "Reverse 21's", dose: "3 x 21", notes: "Superset B" });
    expect(program.blocks[0].weeks[1].days.some((d) => d.name.startsWith("Optional"))).toBe(false);
  });

  it("skips example tables on pages without a week marker", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const all = program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days.map((d) => d.name)));
    expect(all).not.toContain("Example");
  });

  it("produces a valid programme whose doses all parse", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const valid = validateProgramJson(program);
    for (const b of valid.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) expect(parseDose(e.dose), e.name).not.toBeNull();
  });
});
```

Warm-up sets `0` become `null` (no warm-up sets), any other count stays as written.

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test scripts/lib/__tests__/powerbuilding-pdf.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the parser**

```ts
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
import { cellText, doseFromPdf, percentOrRpe, restFromPdf, sentenceCase, SUPERSET_RE, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplSkippedRow, SheetMeta } from "./ppl-sheet";

export type PowerbuildingParseResult = { program: ProgramJson; skipped: PplSkippedRow[]; omitted: string[] };

const WEEK_RE = /POWERBUILDING SYSTEM WEEK\s+(\d+)([AB])?\b/i;
const OPTIONAL_RE = /POWERBUILDING SYSTEM OPTIONAL DAY/i;
const OPTIONAL_DAY_NAME = "Optional Arm and Pump Day";
const OPTIONAL_WEEKS = [1, 3, 5, 7, 9];

/** "X OR Y" names: [exercise, substitution]. Keys are the raw cell after collapsing whitespace. */
const NAME_CHOICES: Record<string, [string, string]> = {
  "CHEST-SUPPORTED T-BAR ROW OR PENDLAY ROW": ["CHEST-SUPPORTED T-BAR ROW", "PENDLAY ROW"],
  "BARBELL OR EZ BAR CURL": ["EZ BAR CURL", "BARBELL CURL"],
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
    const sd = doseFromPdf(row[3], row[4]);
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
    const notes = [ss ? `Superset ${ss[1]}` : null, sentenceCase(row[12]), load.loadNote, load.rpe ? `Load: ${load.rpe} (as written)` : null, rpe.loadNote, sd.note].filter(Boolean).join(". ");
    out.push({
      name: split.name,
      variant: split.variant,
      warmUp: warm && warm !== "0" ? warm : null,
      dose: sd.dose,
      rpe: rpe.rpe,
      rest: restFromPdf(row[7]),
      sub1: subName ? splitVariant(titleCaseName(subName)).name : null,
      sub2: null,
      notes: notes || null,
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
```

The test fixture has weeks 1, 2, 10A, 11, so contract weeks become 1, 2, 3, 4 with blocks Powerbuilding [1, 2], Max Testing [3], Deload [4]; on the real PDF they are 1-9, 10, 11. Note the `Load: ${load.rpe} (as written)` branch only fires if a %1RM cell carried a bare number; on the real file it never does, but it keeps the value.

- [ ] **Step 4: Run the tests**

Run: `bun run test scripts/lib/__tests__/powerbuilding-pdf.test.ts`
Expected: PASS.

- [ ] **Step 5: The CLI**

Same shape as `convert-ppl1.ts`, importing `parsePowerbuilding`, reading `./data/programs/raw/nippard-powerbuilding-4x.json`, writing `./data/programs/nippard-powerbuilding-4x.json`, printing each `omitted` line to stdout prefixed with `note:` (not an error), and exiting 1 on `skipped`. Meta:

```ts
{
  name: "Jeff Nippard, Powerbuilding System (4x per week)",
  description: "Eleven weeks, four days a week: odd weeks are full body strength days, even weeks are upper and lower hypertrophy days. Week 10 is max testing (option A; option B, for competitive powerlifters, is not loaded) and week 11 is a deload. The optional arm and pump day is the fifth day of the odd weeks. Loads given as a percentage of 1RM are in the row notes. Personal copy; not redistributed.",
  citation: "Nippard J. Powerbuilding System, 4x version. 2020.",
  sourceUrl: null,
}
```

- [ ] **Step 6: Run it on the real dump**

Run: `bun run convert:powerbuilding`
Expected: `3 blocks, 11 weeks`, 4 days on even weeks and week 11, 5 days on odd weeks, 3 days in week 10, plus the omitted note. Handle skipped rows as in Task 3 Step 6 (helper first, `ROW_OVERRIDES` or `NAME_CHOICES` second). Check the name list for casing and for any "X or Y" that slipped through as a name.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/powerbuilding-pdf.ts scripts/lib/__tests__/powerbuilding-pdf.test.ts scripts/convert-powerbuilding.ts package.json
git commit -m "feat(programs): convert the Powerbuilding 4x PDF to programme JSON"
```

---

### Task 5: Arm Hypertrophy converter

**Files:**
- Create: `scripts/lib/arm-pdf.ts`
- Create: `scripts/convert-arm.ts`
- Test: `scripts/lib/__tests__/arm-pdf.test.ts`
- Modify: `package.json` (add `"convert:arm": "bun run scripts/convert-arm.ts"`)

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseArm } from "../arm-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const META = { name: "Test Arms", description: "d", citation: null, sourceUrl: null };
const HEAD = (day: string) => [day, "SETS", "REPS", "TEMPO", "APE", "REST", "1", "2", "3", "4", "NOTES"];
const row = (name: string, sets: string, reps: string, tempo: string, rpe: string, rest: string, notes: string) => [name, sets, reps, tempo, rpe, rest, "", "", "", "", notes];

function weekPage(block: string, week: number, tables: string[][][]): PdfTables["pages"][number] {
  return { page: 0, text: ["ARM HYPERTROPHY", "BLOCK", block, `PROGRAM: WEEK ${week}`], tables: [[["BLOCK"], [block]], ...tables, [["JEFF NIPPARD", "ARM HYPERTROPHY PROGRAM", "7"]]] };
}

const DUMP: PdfTables = {
  file: "test.pdf",
  pages: [
    weekPage("1", 1, [
      [["ARM DAY", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 1"), row("CLOSE GRIP BENCH\nPRESS", "3", "6-8", "2:1:1:1", "8", "3.0", "SHOULDER WIDTH GRIP"), row("FOREARM WRIST\nCURL", "3", "15-20", "2:0:1:0", "9", "1.0", "OPTIONAL, BRACED")],
      [["SUPPLEMENTAL A", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 2"), row("INCLINE DUMBBELL\nCURL REVERSE 21'S", "2", "7+7+7", "-", "9", "1.5", "BOTH ARMS AT ONCE")],
      [["SUPPLEMENTAL B", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 3"), row("HEAVY NEGATIVE\nCONCENTRATION\nCURLS", "0", "0", "-", "10", "1.5", "CONTROL THE NEGATIVE"), row("FARMERS WALKS", "3", "40", "-", "", "1.0", "40 TOTAL STRIDES"), ["WEEKLY BICEP VOLUME", "19", "", "", "", "", "", "", "", "", ""], ["WEEKLY TRICEP VOLUME", "19", "", "", "", "", "", "", "", "", ""]],
    ]),
    weekPage("2", 5, [
      [["ARM DAY", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 1"), row("STANDING EZ BAR\nCURL (DESCENDING\nROM)", "2", "10+5+5", "-", "9", "1.5", "")],
    ]),
  ],
};

describe("parseArm", () => {
  it("builds blocks and weeks from the page markers", () => {
    const { program } = parseArm(DUMP, META);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([["Block 1", [1]], ["Block 2", [2]]]);
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Arm Day", "Supplemental A", "Supplemental B"]);
  });

  it("maps cells, tempo and decimal rest to the contract", () => {
    const { program } = parseArm(DUMP, META);
    const arm = program.blocks[0].weeks[0].days[0].exercises;
    expect(arm[0]).toMatchObject({ name: "Close Grip Bench Press", dose: "3 x 6-8", rpe: "8", rest: "3 min", notes: "Shoulder width grip. Tempo 2:1:1:1" });
    expect(arm[1]).toMatchObject({ name: "Forearm Wrist Curl", rest: "1 min", notes: "Optional, braced. Tempo 2:0:1:0" });
    const a = program.blocks[0].weeks[0].days[1].exercises;
    expect(a[0]).toMatchObject({ name: "Incline Dumbbell Curl", variant: "Reverse 21's", dose: "2 x 21", rest: "90 sec", notes: "Both arms at once. Reps: 7 + 7 + 7" });
    const b = program.blocks[0].weeks[0].days[2].exercises;
    expect(b[1]).toMatchObject({ name: "Farmers Walks", dose: "3 x 40", rpe: null, rest: "1 min" });
    expect(b.map((e) => e.name)).not.toContain("Weekly Bicep Volume");
    expect(program.blocks[1].weeks[0].days[0].exercises[0]).toMatchObject({ name: "Standing EZ Bar Curl", variant: "Descending ROM", dose: "2 x 20", notes: "Reps: 10 + 5 + 5" });
  });

  it("applies the open-ended set override and reports nothing else", () => {
    const { program, skipped } = parseArm(DUMP, META);
    expect(skipped).toEqual([]);
    const b = program.blocks[0].weeks[0].days[2].exercises;
    expect(b[0]).toMatchObject({ name: "Heavy Negative Concentration Curls", dose: "1 x AMRAP", notes: "Control the negative. Sets and reps as written: 0 / 0, an open-ended set; see the notes" });
  });

  it("produces a valid programme whose doses all parse", () => {
    const { program } = parseArm(DUMP, META);
    const valid = validateProgramJson(program);
    for (const bl of valid.blocks) for (const w of bl.weeks) for (const d of w.days) for (const e of d.exercises) expect(parseDose(e.dose), e.name).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `bun run test scripts/lib/__tests__/arm-pdf.test.ts`
Expected: FAIL, cannot find module.

- [ ] **Step 3: Write the parser**

```ts
/**
 * Parse the Arm Hypertrophy PDF dump into the programme contract. One
 * page per week ("PROGRAM: WEEK N", block from the BLOCK table), three
 * tables per page (Arm Day, Supplemental A, Supplemental B) whose
 * second row is the column header and whose last rows may be weekly
 * volume totals. Tempo goes into the notes; rest is written in minutes
 * as a decimal.
 *
 * Two rows are written with 0 sets and 0 reps (an open-ended set the
 * notes describe); OPEN_ENDED_ROWS gives them a dose and says so.
 */

import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonWeek } from "../data/programs/schema";
import { splitVariant } from "./exercise-variant";
import { cellText, doseFromPdf, percentOrRpe, restFromPdf, sentenceCase, titleCaseName, type PdfTables } from "./pdf-program";
import type { PplParseResult, PplSkippedRow, SheetMeta } from "./ppl-sheet";

const WEEK_RE = /PROGRAM:\s*WEEK\s+(\d+)/i;
const BLOCK_RE = /^BLOCK\s+(\d)$/i;

/** Raw names (whitespace collapsed) written with 0 sets and 0 reps. */
const OPEN_ENDED_ROWS = new Set(["HEAVY NEGATIVE CONCENTRATION CURLS", "REVERSE GRIP EZ BAR CURL (METABOLIC)"]);
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
    const week: ProgramJsonWeek = { week: Number(weekLine[1]), days: [] };
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
        const notes = [sentenceCase(row[10]), tempo ? `Tempo ${tempo}` : null, sd.note, openEnded].filter(Boolean).join(". ");
        day.exercises.push({
          name: split.name,
          variant: split.variant,
          warmUp: null,
          dose: sd.dose,
          rpe: percentOrRpe(row[4]).rpe,
          rest: restFromPdf(row[5]),
          sub1: null,
          sub2: null,
          notes: notes || null,
        });
      }
    }
  }

  const program: ProgramJson = { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
  return { program, skipped };
}
```

- [ ] **Step 4: Run the tests**

Run: `bun run test scripts/lib/__tests__/arm-pdf.test.ts`
Expected: PASS.

- [ ] **Step 5: The CLI**

Same shape as `convert-ppl1.ts` with `parseArm`, reading `./data/programs/raw/nippard-arm-hypertrophy.json`, writing `./data/programs/nippard-arm-hypertrophy.json`. Meta:

```ts
{
  name: "Jeff Nippard, Arm Hypertrophy Program",
  description: "Eight weeks in two blocks of four, three add-on days a week (Arm Day, Supplemental A, Supplemental B) run alongside another split. Tempo is in the row notes. Personal copy; not redistributed.",
  citation: "Nippard J. Arm Hypertrophy Program.",
  sourceUrl: null,
}
```

- [ ] **Step 6: Run it on the real dump**

Run: `bun run convert:arm`
Expected: `2 blocks, 8 weeks, 24 days` and around 150 rows. Handle skipped rows as before. Check the name list.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/arm-pdf.ts scripts/lib/__tests__/arm-pdf.test.ts scripts/convert-arm.ts package.json
git commit -m "feat(programs): convert the Arm Hypertrophy PDF to programme JSON"
```

---

### Task 6: Seed, library map, docs

**Files:**
- Modify: `scripts/data/programs/library.ts`
- Modify: `CLAUDE.md` (Commands, Parsers, Programmes sections; test count)
- Modify: `README.md` if it lists commands or parser modules

- [ ] **Step 1: First seed run**

Run: `bun run seed:programs`
Expected: 5 programmes loaded (recovery is not a file; the four training JSONs plus the existing PPL 4x count as programs 5 in `rowCounts.programs`), no rejected doses, `handFix` non-empty (every new exercise the seed inserted with no muscle group). Read `scripts/seed-programs-report.json`: `fuzzyMatches`, `aliasMatches`, `exercisesInserted`, `handFix`, `alternatesKeptExisting`, `alternateConflicts`.

- [ ] **Step 2: Extend the library map**

For every slug in `handFix`, add either an alias (when it is one of Frank's Notion rows under another name) or attributes. Rules, the same ones used for the PPL 4x rows:
- Alias when the movement is the same and only the spelling differs (`barbell-bench-press` to `bench-press-flat`, `dumbbell-lateral-raise` to `db-lateral-raise`, `pull-up` is already fuzzy-matched to `pull-ups`). List every Notion slug first: `bun -e` with the service key over REST, `select slug,name from exercises where _notion_id not like 'program:%' order by slug`, saved to the scratchpad, never printed with the key.
- Do not alias to an upstairs or downstairs row; those are Frank's gym locations.
- Do not alias a technique variant (pause, tempo, slow eccentric, enhanced-eccentric, bottom-half, cheat) to the base movement; give it attributes.
- Attributes: muscle group by the movement's target (Notion's convention: deadlifts Glutes, RDLs and leg curls Hamstrings, rows and pulldowns and shrugs Back, face pulls and lateral raises and rear delt work Shoulders, close-grip pressing and dips and skull crushers and pressdowns Triceps, curls Biceps, planks and crunches and rollouts and leg raises Abs, calf raises Calves, stretches Stretches, walking or cardio Cardio), equipment from the name (barbell, dumbbell, cable, machine, bodyweight), `other` only when nothing fits (band work, plate work, farmer's walks, neck work).
- Keep both tables alphabetical.

Run `bun run test scripts/data/programs/__tests__/library.test.ts` (the map tests) after editing.

- [ ] **Step 3: Second and third seed runs**

Run: `bun run seed:programs` twice.
Expected after the first of these: `aliasMatches` grew, `exercisesRemoved` lists the seed rows the new aliases replaced, `attributesApplied` equals the number of new attribute keys, `attributesUnused` 0, `handFix` 0, `aliasesMissing` 0. After the second: inserted 0, removed 0, attributesApplied 0, row counts identical. Record the row counts and the per-programme lines (`report.programs`).

If `alternateConflicts` or `alternatesKeptExisting` list anything for the new programmes, leave them; report them.

- [ ] **Step 4: REST checks**

With a scratch script (never print keys): 0 seed-owned exercises with a null muscle group; every `programs` row of kind `training` has `program_phases` rows equal to its week count (16, 11, 8, 13); every training template has exactly one `template_phases` row; `template_exercises` rows with `variant` not null grouped by (slug, variant) listed; no curated (`_notion_id` not like `program:%`) exercise row has `updated_at` after the first run's start.

- [ ] **Step 5: Docs**

CLAUDE.md:
- Commands: add `bun run extract:pdfs`, `bun run convert:ppl1`, `bun run convert:powerbuilding`, `bun run convert:arm` with one-line comments; note the Python dependency (`python3 -m pip install pdfplumber`).
- Parsers: add `scripts/lib/pdf-program.ts`, `ppl1-pdf.ts`, `powerbuilding-pdf.ts`, `arm-pdf.ts` with one line each.
- Programmes: replace the last paragraph ("The other four Nippard PDFs...") with a paragraph on the PDF pipeline: extractor to gitignored dumps, one parser per programme, what each programme became (blocks, weeks, days), that Powerbuilding week 10 is option A and the optional day sits on odd weeks, that the Get Ready Manual holds no programme and stays a reference.
- Test count line.

README: mirror the command list if it has one.

- [ ] **Step 6: Final gate and commit**

Run: `bun run test && bunx tsc --noEmit && bun run lint && grep -rn "—" CLAUDE.md README.md scripts/lib/pdf-program.ts scripts/lib/ppl1-pdf.ts scripts/lib/powerbuilding-pdf.ts scripts/lib/arm-pdf.ts scripts/data/programs/library.ts scripts/extract-pdf-tables.py scripts/extract-training-pdfs.ts`
Expected: all green; grep finds nothing.

```bash
git add scripts/data/programs/library.ts CLAUDE.md README.md
git commit -m "feat(programs): library map for the PDF programmes, docs"
```

---

## Report back

Commit SHAs; the three converters' output lines (blocks, weeks, days, rows) and any `ROW_OVERRIDES` or `NAME_CHOICES` entries you had to add with the row they cover; the final seed report counts (row counts, `report.programs`, inserted, removed, aliasMatches, aliasesMissing, fuzzyMatches, attributesApplied, attributesUnused, handFix, alternatesKeptExisting, alternateConflicts, omitted notes); how many aliases and attributes you added and the ones you were unsure about; the (exercise, variant) pairs across all programmes; the REST results; the live test count; anything not done and why.
