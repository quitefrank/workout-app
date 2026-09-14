# Programs Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick a training programme and follow it week by week without choosing templates: a JSON programme contract, a converter that turns the Nippard Ultimate Push Pull Legs sheet into that JSON, and a generic seed that loads any programme JSON into `programs`, `program_phases` (one per week, grouped into blocks), `templates`, `template_exercises`, `template_phases` and `exercise_alternates`.

**Architecture:** Programme content is copyrighted, so it is never committed. `scripts/data/programs/*.json` is gitignored except `example.json`; the seed loads whatever JSON files are present. The JSON shape is the contract a future in-app importer will produce, which is the "add programmes without Claude Code" path. Weekly phases are what let the app answer "what do I do today": current phase (week) plus the ordered templates inside it.

**Tech Stack:** bun 1.3, Vitest 4, Supabase JS, `scripts/lib/parse-prescription.ts`, `scripts/lib/template-name.ts`, `src/lib/recovery/dose.ts`.

**Depends on:** `2026-09-14-achilles-content.md` Task 2 (migration 0006 adds `program_phases.block` and `template_phases.position`). Run that first.

**Ground rules for every task**

- No em dashes anywhere.
- Every commit ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` as a second `-m`.
- The Nippard programme files live in `/Users/quitefrank/Claude/Personal/raw/training/`: `nippard-ultimate-ppl-4x.xlsx` (the workbook, three tabs named `4x - Phase 1`, `4x - Phase 2`, `4x - Phase 3`, each holding that phase's weeks), `nippard-ultimate-ppl-4x.md` (a flattened markdown export of the same sheet, reference only), and four PDFs: `nippard-ppl-1.0.pdf`, `nippard-powerbuilding-4x.pdf`, `nippard-get-ready-manual.pdf`, `nippard-arm-hypertrophy.pdf`. Read them freely; commit none of their content. Test fixtures use made-up exercises and numbers. The converter in Task 3 reads the workbook; the PDFs get their own converters or hand-written JSON later, in the same contract.
- `bun run test` before every commit; the count only goes up.

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `src/lib/recovery/dose.ts` + test | Minutes and AMRAP doses | 1 |
| `scripts/data/programs/schema.ts` | The JSON contract as types plus a validator | 2 |
| `scripts/data/programs/example.json` | A tiny committed programme in the contract's shape | 2 |
| `scripts/data/programs/__tests__/schema.test.ts` | Validator tests, example validates | 2 |
| `.gitignore` | Ignore programme JSON except the example | 2 |
| `scripts/lib/ppl-sheet.ts` + test | Parse the workbook's rows into the contract | 3 |
| `scripts/convert-ppl-sheet.ts` | CLI: vault workbook in, JSON out | 3 |
| `scripts/seed-programs.ts` | Load every programme JSON into Supabase | 4 |
| `package.json`, `CLAUDE.md`, `README.md`, spec | Wiring and docs | 3, 4, 5 |

---

### Task 1: Minutes and AMRAP in `parseDose`

**Files:**
- Modify: `src/lib/recovery/dose.ts`
- Test: `src/lib/recovery/__tests__/dose.test.ts`

Cardio rows in the sheet read "1 x 45 min" and finishers read "1 x AMRAP". Today both are rejected.

- [ ] **Step 1: Failing tests**

Add to `describe("parseDose")`:

```ts
it("reads minutes as seconds", () => {
  expect(parseDose("1 x 45 min")).toEqual({
    sets: { min: 1, max: 1 },
    reps: null,
    rir: null,
    seconds: { min: 2700, max: 2700 },
    modifier: null,
  });
  expect(parseDose("1 x 5-10 mins easy")).toMatchObject({ seconds: { min: 300, max: 600 }, modifier: "easy" });
});

it("reads AMRAP as a sets-only dose with the modifier", () => {
  expect(parseDose("1 x AMRAP")).toEqual({
    sets: { min: 1, max: 1 },
    reps: null,
    rir: null,
    seconds: null,
    modifier: "AMRAP",
  });
});
```

And to `describe("formatDose")`:

```ts
it("renders minutes when the seconds divide evenly", () => {
  expect(formatDose(parseDose("1 x 45 min")!)).toBe("1 x 45 min");
  expect(formatDose(parseDose("3 x 90 sec")!)).toBe("3 x 90 sec");
});

it("renders AMRAP", () => {
  expect(formatDose(parseDose("1 x AMRAP")!)).toBe("1 x AMRAP");
});
```

Run the file. Expected: the four new tests fail.

- [ ] **Step 2: Implement**

In `dose.ts`, add after `SECONDS_RE`:

```ts
const MINUTES_RE = new RegExp(`^(${RANGE})\\s*(?:min|mins|minutes)\\b${MOD}$`, "i");
const AMRAP_RE = new RegExp(`^amrap${MOD}$`, "i");
```

Remove `min|mins|minutes` and `amrap` from the keyword list inside `MOD` is NOT needed: MOD only guards the tail after a number. Leave MOD as is.

In `parseDose`, after the seconds branch and before the reps branch:

```ts
  const mins = MINUTES_RE.exec(rest);
  if (mins) {
    const r = parseRange(mins[1]);
    if (!r) return null;
    return { sets, reps: null, rir: null, seconds: { min: r.min * 60, max: r.max * 60 }, modifier: modifierOf(mins[2]) };
  }

  const amrap = AMRAP_RE.exec(rest);
  if (amrap) {
    return { sets, reps: null, rir: null, seconds: null, modifier: `AMRAP${amrap[1] ? " " + amrap[1].trim() : ""}` };
  }
```

In `formatDose`, replace the seconds line with:

```ts
  else if (d.seconds) {
    const wholeMinutes = d.seconds.min % 60 === 0 && d.seconds.max % 60 === 0 && d.seconds.min >= 120;
    body = wholeMinutes
      ? `${range({ min: d.seconds.min / 60, max: d.seconds.max / 60 })} min`
      : `${range(d.seconds)} sec`;
  }
```

and make the sets-only branch render the modifier without the word "sets" when the modifier is AMRAP: replace `const head = body ? ... : \`${range(d.sets)} sets\`;` with:

```ts
  const mod = d.modifier?.trim();
  if (!body && mod?.toUpperCase().startsWith("AMRAP")) return `${range(d.sets)} x ${mod}`;
  const head = body ? `${range(d.sets)} x ${body}` : `${range(d.sets)} sets`;
  return mod ? `${head} ${mod}` : head;
```

The 90-second case stays in seconds because of the `>= 120` guard, so "3 x 90 sec" round-trips.

- [ ] **Step 3: Run the whole suite**

`bun run test`: previous count plus 4. The existing reject test `expect(parseDose("3 x 1 min")).toBeNull()` now conflicts; change that line to `expect(parseDose("3 x 1 min")).toMatchObject({ seconds: { min: 60, max: 60 } });` since minutes are now a real unit. Keep `"3 x 20 seconds"` rejected (the word "seconds" is not in SECONDS_RE; add `seconds` to that alternation so it parses too, and update its test to expect `{ seconds: { min: 20, max: 20 } }`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/recovery/dose.ts src/lib/recovery/__tests__/dose.test.ts
git commit -m "feat(recovery): minutes and AMRAP doses" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: The programme JSON contract

**Files:**
- Create: `scripts/data/programs/schema.ts`
- Create: `scripts/data/programs/example.json`
- Test: `scripts/data/programs/__tests__/schema.test.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Gitignore first**

```
# programme content is copyrighted; only the example and the loader are committed
/scripts/data/programs/*.json
!/scripts/data/programs/example.json
/scripts/seed-programs-report.json
```

Commit alone: `chore: ignore programme JSON except the example`.

- [ ] **Step 2: Types and validator**

`scripts/data/programs/schema.ts`:

```ts
/**
 * The programme contract. A programme is blocks of weeks; each week has
 * ordered days; each day has ordered exercises with a prescription.
 * Every seeded training programme and, later, every programme imported
 * through the app, arrives in this shape.
 *
 * Doses are strings parseDose accepts ("1 x 3-5", "1 x 45 min",
 * "1 x AMRAP", "2 x 30 sec hold"). Anything the source wrote that does
 * not fit (per-set rep lists, drop sets) goes into `notes`.
 */

export type ProgramJsonExercise = {
  name: string;
  /** Warm-up sets as written, "3-4" or null. */
  warmUp: string | null;
  dose: string;
  rpe: string | null;
  /** Rest as written, "~3-4 min" or null. */
  rest: string | null;
  sub1: string | null;
  sub2: string | null;
  notes: string | null;
};

export type ProgramJsonDay = {
  name: string;
  exercises: ProgramJsonExercise[];
};

export type ProgramJsonWeek = {
  week: number;
  days: ProgramJsonDay[];
};

export type ProgramJsonBlock = {
  name: string;
  weeks: ProgramJsonWeek[];
};

export type ProgramJson = {
  name: string;
  kind: "training";
  description: string;
  citation: string | null;
  sourceUrl: string | null;
  blocks: ProgramJsonBlock[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${path}: expected a non-empty string`);
  return v;
}

function strOrNull(v: unknown, path: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Error(`${path}: expected a string or null`);
  return v.trim() === "" ? null : v;
}

/** Throws with a path on the first shape error. Returns the typed programme. */
export function validateProgramJson(input: unknown): ProgramJson {
  if (!isRecord(input)) throw new Error("programme: expected an object");
  const name = str(input.name, "name");
  if (input.kind !== "training") throw new Error("kind: expected \"training\"");
  const description = str(input.description, "description");
  const citation = strOrNull(input.citation, "citation");
  const sourceUrl = strOrNull(input.sourceUrl, "sourceUrl");
  if (!Array.isArray(input.blocks) || input.blocks.length === 0) throw new Error("blocks: expected a non-empty array");

  let expectedWeek = 1;
  const blocks: ProgramJsonBlock[] = input.blocks.map((b, bi) => {
    const bp = `blocks[${bi}]`;
    if (!isRecord(b)) throw new Error(`${bp}: expected an object`);
    const bname = str(b.name, `${bp}.name`);
    if (!Array.isArray(b.weeks) || b.weeks.length === 0) throw new Error(`${bp}.weeks: expected a non-empty array`);
    const weeks: ProgramJsonWeek[] = b.weeks.map((w, wi) => {
      const wp = `${bp}.weeks[${wi}]`;
      if (!isRecord(w)) throw new Error(`${wp}: expected an object`);
      if (w.week !== expectedWeek) throw new Error(`${wp}.week: expected ${expectedWeek}, got ${String(w.week)}`);
      expectedWeek++;
      if (!Array.isArray(w.days) || w.days.length === 0) throw new Error(`${wp}.days: expected a non-empty array`);
      const days: ProgramJsonDay[] = w.days.map((d, di) => {
        const dp = `${wp}.days[${di}]`;
        if (!isRecord(d)) throw new Error(`${dp}: expected an object`);
        const dname = str(d.name, `${dp}.name`);
        if (!Array.isArray(d.exercises) || d.exercises.length === 0) throw new Error(`${dp}.exercises: expected a non-empty array`);
        const exercises: ProgramJsonExercise[] = d.exercises.map((e, ei) => {
          const ep = `${dp}.exercises[${ei}]`;
          if (!isRecord(e)) throw new Error(`${ep}: expected an object`);
          return {
            name: str(e.name, `${ep}.name`),
            warmUp: strOrNull(e.warmUp, `${ep}.warmUp`),
            dose: str(e.dose, `${ep}.dose`),
            rpe: strOrNull(e.rpe, `${ep}.rpe`),
            rest: strOrNull(e.rest, `${ep}.rest`),
            sub1: strOrNull(e.sub1, `${ep}.sub1`),
            sub2: strOrNull(e.sub2, `${ep}.sub2`),
            notes: strOrNull(e.notes, `${ep}.notes`),
          };
        });
        return { name: dname, exercises };
      });
      return { week: w.week, days };
    });
    return { name: bname, weeks };
  });

  return { name, kind: "training", description, citation, sourceUrl, blocks };
}

/** Total weeks across blocks. */
export function programWeeks(p: ProgramJson): number {
  return p.blocks.reduce((n, b) => n + b.weeks.length, 0);
}
```

- [ ] **Step 3: Example**

`scripts/data/programs/example.json`, made up, two blocks, two weeks, two days, two exercises each:

```json
{
  "name": "Example two-week programme",
  "kind": "training",
  "description": "A made-up programme showing the contract shape. Not for training.",
  "citation": null,
  "sourceUrl": null,
  "blocks": [
    {
      "name": "Block A",
      "weeks": [
        {
          "week": 1,
          "days": [
            {
              "name": "Push",
              "exercises": [
                { "name": "Example Press", "warmUp": "2", "dose": "3 x 8-10", "rpe": "8", "rest": "2-3 min", "sub1": "Example Machine Press", "sub2": null, "notes": "Keep the shoulder blades set" },
                { "name": "Example Fly", "warmUp": null, "dose": "2 x 12-15", "rpe": "9", "rest": "1-2 min", "sub1": null, "sub2": null, "notes": null }
              ]
            },
            {
              "name": "Pull",
              "exercises": [
                { "name": "Example Row", "warmUp": "2", "dose": "3 x 8-10", "rpe": "8", "rest": "2-3 min", "sub1": null, "sub2": null, "notes": null },
                { "name": "Example Curl", "warmUp": null, "dose": "2 x 10-12", "rpe": "9", "rest": "1-2 min", "sub1": null, "sub2": null, "notes": null }
              ]
            }
          ]
        }
      ]
    },
    {
      "name": "Block B",
      "weeks": [
        {
          "week": 2,
          "days": [
            {
              "name": "Push",
              "exercises": [
                { "name": "Example Press", "warmUp": "2", "dose": "3 x 5-7", "rpe": "9", "rest": "3 min", "sub1": null, "sub2": null, "notes": null },
                { "name": "Example Finisher", "warmUp": null, "dose": "1 x AMRAP", "rpe": "10", "rest": null, "sub1": null, "sub2": null, "notes": null }
              ]
            },
            {
              "name": "Pull",
              "exercises": [
                { "name": "Example Row", "warmUp": "2", "dose": "3 x 5-7", "rpe": "9", "rest": "3 min", "sub1": null, "sub2": null, "notes": null },
                { "name": "Example Cardio", "warmUp": null, "dose": "1 x 20 min", "rpe": null, "rest": null, "sub1": null, "sub2": null, "notes": "Easy pace" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

- [ ] **Step 4: Tests**

```ts
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { programWeeks, validateProgramJson } from "../schema";
import { parseDose } from "../../../../src/lib/recovery/dose";

const example = JSON.parse(readFileSync(fileURLToPath(new URL("../example.json", import.meta.url)), "utf8"));

describe("validateProgramJson", () => {
  it("accepts the committed example and counts its weeks", () => {
    const p = validateProgramJson(example);
    expect(programWeeks(p)).toBe(2);
    expect(p.blocks[1].weeks[0].days[0].exercises[1].dose).toBe("1 x AMRAP");
  });

  it("every dose in the example parses", () => {
    const p = validateProgramJson(example);
    for (const b of p.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) {
      expect(parseDose(e.dose), `${d.name}: ${e.name}`).not.toBeNull();
    }
  });

  it("rejects weeks that do not run 1..n across blocks", () => {
    const bad = structuredClone(example);
    bad.blocks[1].weeks[0].week = 5;
    expect(() => validateProgramJson(bad)).toThrow(/blocks\[1\]\.weeks\[0\]\.week: expected 2/);
  });

  it("rejects a day with no exercises and names the path", () => {
    const bad = structuredClone(example);
    bad.blocks[0].weeks[0].days[0].exercises = [];
    expect(() => validateProgramJson(bad)).toThrow(/days\[0\]\.exercises/);
  });

  it("rejects the wrong kind", () => {
    expect(() => validateProgramJson({ ...example, kind: "recovery" })).toThrow(/kind/);
  });
});
```

Run; expected PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/programs
git commit -m "feat(programs): programme JSON contract with validator and example" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Convert the PPL workbook

**Files:**
- Create: `scripts/lib/ppl-sheet.ts`
- Test: `scripts/lib/__tests__/ppl-sheet.test.ts`
- Create: `scripts/convert-ppl-sheet.ts`
- Modify: `package.json` (`xlsx` is already a devDependency; add the `convert:ppl` script)

The workbook `nippard-ultimate-ppl-4x.xlsx` has three sheets, `4x - Phase 1`, `4x - Phase 2`, `4x - Phase 3`. Read each with `XLSX.utils.sheet_to_json(ws, { header: 1, blankrows: false })` to get rows as arrays. Row shapes, verified on the file:

- Row 0: title. Row 1: copyright. Row 2: `Phase N - <Name> (<detail>)` in column A.
- Week header: column A `Week N`, column B `Exercise`. Columns after B are: Warm-up Sets, Working Sets, Reps, Load, RPE, Rest, Substitution Option 1, Substitution Option 2, Notes (eleven columns, no "Prev").
- Exercise row: column A carries the day label only on the first row of a merged group (`Legs #1`, `Push #1`, `Pull #1`, `Full Body #1`); later rows of the same day have `null` in column A, so the day carries forward.
- Rest banner: column A `Mandatory 1-2 Rest Days`, nothing else. Skip.
- Excel has turned range-looking cells into dates: Warm-up `3-4` is stored as the serial `44624` (2022-03-04), RPE `8-9` as `44782` (2022-08-09), `9-10` as `44814`, `2-3` as `44595`, `7-8` as `44750`. Any number above 40000 in the Warm-up or RPE column is a date serial and must decode to `month-day`: serial to date via the Excel epoch (1899-12-30), then `${month}-${day}`.
- Superset markers are `A1.` in Phase 1 and `A1:` in Phase 3. Strip either form.
- Reps idioms seen: `2-4`, `10`, `AMRAP`, `30s HOLD`, `45mins`, `8, 5, 12`, `10+5`, `8 + 8`, and `See Notes` in the RPE column.

- [ ] **Step 1: Failing tests**

`scripts/lib/__tests__/ppl-sheet.test.ts`, with a made-up fixture built as row arrays (no real workbook content):

```ts
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import * as XLSX from "xlsx";
import { decodeRangeCell, doseFromSheet, parsePplWorkbook, parsePplRows } from "../ppl-sheet";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const HEADER = ["Week 1", "Exercise", "Warm-up Sets", "Working Sets", "Reps", "Load", "RPE", "Rest", "Substitution Option 1", "Substitution Option 2", "Notes"];

const PHASE_ONE: unknown[][] = [
  ["Test Program"],
  [null, null, null, null, null, null, null, null, null, null, "Copyright line"],
  ["Phase 1 - Block One (Test)"],
  HEADER,
  ["Legs #1", "Example Squat", 44624, 1, "2-4", null, 44782, "~3-4 min", "Example Hack Squat", "Example Split Squat", "Sit back and down"],
  [null, "Example Walk", "5mins", 1, "45mins", null, null, null, null, null, null],
  ["Push #2", "A1. Example Press-Around", 1, 2, "12-15", null, 44814, "0 min", "Example Flye", "N/A", "Brace"],
  [null, "A2: Example Stretch 30s", 0, 2, "30s HOLD", null, "N/A", "0 min", "N/A", "N/A", "Hold"],
  [null, "Example Finisher", 0, 1, "AMRAP", null, 10, "0 min", "N/A", "N/A", null],
  ["Mandatory 1-2 Rest Days"],
  ["Week 2", "Exercise", "Warm-up Sets", "Working Sets", "Reps", "Load", "RPE", "Rest", "Substitution Option 1", "Substitution Option 2", "Notes"],
  ["Legs #1", "Example Squat", 44624, 1, "3-5", null, 44782, "~3-4 min", "Example Hack Squat", "Example Split Squat", "Sit back and down"],
];

const PHASE_TWO: unknown[][] = [
  ["Test Program"],
  [null],
  ["Phase 2 - Block Two (Test)"],
  HEADER,
  ["Pull #1", "Example Row", 2, 3, "8, 5, 12", null, 44782, "~2-3 min", null, null, "Three set schemes"],
  [null, "Example Pulldown", 0, 1, "10+5", null, "See Notes", "~2-3 min", null, null, "Drop set"],
];

describe("decodeRangeCell", () => {
  it("turns Excel date serials back into month-day ranges and leaves everything else alone", () => {
    expect(decodeRangeCell(44624)).toBe("3-4");
    expect(decodeRangeCell(44782)).toBe("8-9");
    expect(decodeRangeCell(44814)).toBe("9-10");
    expect(decodeRangeCell(44595)).toBe("2-3");
    expect(decodeRangeCell(3)).toBe("3");
    expect(decodeRangeCell("3-4")).toBe("3-4");
    expect(decodeRangeCell(null)).toBeNull();
    expect(decodeRangeCell("N/A")).toBeNull();
  });
});

describe("doseFromSheet", () => {
  it("maps the sheet idioms to parseDose strings and notes", () => {
    expect(doseFromSheet(1, "2-4")).toEqual({ dose: "1 x 2-4", note: null });
    expect(doseFromSheet(1, "45mins")).toEqual({ dose: "1 x 45 min", note: null });
    expect(doseFromSheet(2, "30s HOLD")).toEqual({ dose: "2 x 30 sec hold", note: null });
    expect(doseFromSheet(1, "AMRAP")).toEqual({ dose: "1 x AMRAP", note: null });
    expect(doseFromSheet(3, "8, 5, 12")).toEqual({ dose: "3 x 5-12", note: "Reps per set: 8, 5, 12" });
    expect(doseFromSheet(1, "10+5")).toEqual({ dose: "1 x 10", note: "Then a drop set of 5" });
    expect(doseFromSheet(3, "8 + 8")).toEqual({ dose: "3 x 8", note: "8 + 8" });
    expect(doseFromSheet("3", 10)).toEqual({ dose: "3 x 10", note: null });
  });

  it("returns null for a shape it cannot map", () => {
    expect(doseFromSheet(3, "banana")).toBeNull();
    expect(doseFromSheet("-", "10")).toBeNull();
    expect(doseFromSheet(null, "10")).toBeNull();
  });
});

describe("parsePplRows", () => {
  const p = parsePplRows([PHASE_ONE, PHASE_TWO], { name: "Test programme", description: "d", citation: null, sourceUrl: null });

  it("groups weeks into blocks with global week numbers", () => {
    expect(p.blocks.map((b) => b.name)).toEqual(["Block One", "Block Two"]);
    expect(p.blocks[0].weeks.map((w) => w.week)).toEqual([1, 2]);
    expect(p.blocks[1].weeks.map((w) => w.week)).toEqual([3]);
  });

  it("carries the day forward through merged cells, strips the day number, and skips rest banners", () => {
    const w1 = p.blocks[0].weeks[0];
    expect(w1.days.map((d) => d.name)).toEqual(["Legs", "Push"]);
    expect(w1.days[0].exercises.map((e) => e.name)).toEqual(["Example Squat", "Example Walk"]);
    expect(w1.days[1].exercises.map((e) => e.name)).toEqual(["Example Press-Around", "Example Stretch 30s", "Example Finisher"]);
  });

  it("decodes date-serial ranges, strips superset prefixes into notes, and turns N/A into null", () => {
    const squat = p.blocks[0].weeks[0].days[0].exercises[0];
    expect(squat.warmUp).toBe("3-4");
    expect(squat.rpe).toBe("8-9");
    expect(squat.rest).toBe("~3-4 min");
    expect(squat.sub1).toBe("Example Hack Squat");
    const pa = p.blocks[0].weeks[0].days[1].exercises[0];
    expect(pa.notes).toBe("Superset A. Brace");
    expect(pa.rpe).toBe("9-10");
    expect(pa.sub2).toBeNull();
    const stretch = p.blocks[0].weeks[0].days[1].exercises[1];
    expect(stretch.name).toBe("Example Stretch 30s");
    expect(stretch.rpe).toBeNull();
    expect(stretch.notes).toBe("Superset A. Hold");
  });

  it("pushes lossy rep idioms into notes and drops the RPE placeholder", () => {
    const row = p.blocks[1].weeks[0].days[0].exercises[0];
    expect(row.dose).toBe("3 x 5-12");
    expect(row.notes).toBe("Three set schemes. Reps per set: 8, 5, 12");
    const drop = p.blocks[1].weeks[0].days[0].exercises[1];
    expect(drop.rpe).toBeNull();
    expect(drop.notes).toBe("Drop set. Then a drop set of 5");
  });

  it("produces doses parseDose accepts and a programme the validator accepts", () => {
    for (const b of p.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) {
      expect(parseDose(e.dose), `${d.name}: ${e.name} ${e.dose}`).not.toBeNull();
    }
    expect(() => validateProgramJson(p)).not.toThrow();
  });
});

describe("the real workbook, when present", () => {
  const path = "/Users/quitefrank/Claude/Personal/raw/training/nippard-ultimate-ppl-4x.xlsx";
  it.skipIf(!existsSync(path))("converts with every dose parsing, 13 weeks in 3 blocks, four days a week", () => {
    const p = parsePplWorkbook(XLSX.readFile(path), { name: "x", description: "x", citation: null, sourceUrl: null });
    expect(p.blocks).toHaveLength(3);
    expect(p.blocks.reduce((n, b) => n + b.weeks.length, 0)).toBe(13);
    const bad: string[] = [];
    for (const b of p.blocks) for (const w of b.weeks) {
      expect(w.days.map((d) => d.name), `week ${w.week}`).toEqual(["Legs", "Push", "Pull", "Full Body"]);
      for (const d of w.days) for (const e of d.exercises) {
        if (!parseDose(e.dose)) bad.push(`${b.name} W${w.week} ${d.name}: ${e.name} -> ${e.dose}`);
        expect(e.warmUp === null || /^\d+(-\d+)?$/.test(e.warmUp), `${e.name} warmUp ${e.warmUp}`).toBe(true);
        expect(e.rpe === null || /^\d+(-\d+)?$/.test(e.rpe), `${e.name} rpe ${e.rpe}`).toBe(true);
      }
    }
    expect(bad).toEqual([]);
  });
});
```

The phase 1 week 6 deload in the real file is only partly filled (Legs complete, Push cut off, no Pull or Full Body). If the four-days assertion fails only on week 6, relax it to `toEqual(expect.arrayContaining(["Legs"]))` for that week and record the gap in the report; do not invent the missing days.

Run; expected FAIL (module missing).

- [ ] **Step 2: Implement `scripts/lib/ppl-sheet.ts`**

```ts
/**
 * Parse the Ultimate Push Pull Legs workbook into the programme JSON
 * contract. One sheet per phase; rows are arrays as returned by
 * XLSX.utils.sheet_to_json with header: 1.
 *
 * Two quirks of the file are handled here. Excel stored range-looking
 * cells ("3-4", "8-9") as dates, so those come back as serial numbers
 * and are decoded to month-day. And the sheet writes reps in a few
 * idioms parseDose does not accept (per-set lists, drop sets, "8 + 8");
 * doseFromSheet maps each to a parseable dose and keeps the original in
 * the notes.
 */

import type * as XLSX from "xlsx";
import type { ProgramJson, ProgramJsonBlock, ProgramJsonDay, ProgramJsonWeek } from "../data/programs/schema";

export type SheetMeta = {
  name: string;
  description: string;
  citation: string | null;
  sourceUrl: string | null;
};

type Cell = unknown;

function text(v: Cell): string | null {
  if (v === null || v === undefined) return null;
  const t = String(v).replace(/\r\n|\r|\n/g, " ").replace(/\s+/g, " ").trim();
  if (t === "" || t === "-" || t.toUpperCase() === "N/A") return null;
  return t;
}

const EXCEL_EPOCH_MS = Date.UTC(1899, 11, 30);

/** A range cell: "3-4" as written, or an Excel date serial Excel made of it. */
export function decodeRangeCell(v: Cell): string | null {
  if (typeof v === "number") {
    if (v > 40000) {
      const d = new Date(EXCEL_EPOCH_MS + Math.round(v) * 86_400_000);
      return `${d.getUTCMonth() + 1}-${d.getUTCDate()}`;
    }
    return String(v);
  }
  return text(v);
}

export type SheetDose = { dose: string; note: string | null };

/** Map the Working Sets and Reps cells to a parseDose string plus a note for anything lossy. */
export function doseFromSheet(working: Cell, reps: Cell): SheetDose | null {
  const sets = decodeRangeCell(working);
  if (sets === null || !/^\d+(-\d+)?$/.test(sets)) return null;
  const r = reps === null || reps === undefined ? "" : String(reps).trim();
  if (r === "") return null;

  let m: RegExpExecArray | null;
  if ((m = /^(\d+)\s*(?:mins?|minutes)$/i.exec(r))) return { dose: `${sets} x ${m[1]} min`, note: null };
  if ((m = /^(\d+)\s*s(?:ec|ecs)?\s*(hold)?$/i.exec(r))) return { dose: `${sets} x ${m[1]} sec${m[2] ? " hold" : ""}`, note: null };
  if (/^amrap$/i.test(r)) return { dose: `${sets} x AMRAP`, note: null };
  if (/^\d+(-\d+)?$/.test(r)) return { dose: `${sets} x ${r}`, note: null };
  if ((m = /^(\d+)\s*\+\s*(\d+)$/.exec(r))) {
    return /\s\+\s/.test(r)
      ? { dose: `${sets} x ${m[1]}`, note: r }
      : { dose: `${sets} x ${m[1]}`, note: `Then a drop set of ${m[2]}` };
  }
  if (/^\d+(\s*,\s*\d+)+$/.test(r)) {
    const nums = r.split(",").map((x) => Number(x.trim()));
    return { dose: `${sets} x ${Math.min(...nums)}-${Math.max(...nums)}`, note: `Reps per set: ${r}` };
  }
  return null;
}

const PHASE_RE = /^Phase\s+\d+\s*-\s*(.+?)\s*(?:\(.*\))?$/i;
const WEEK_RE = /^Week\s+(\d+)$/i;
const DAY_RE = /^(.*?)\s*#\d+$/;
const SUPERSET_RE = /^([A-Z])(\d)[.:]\s*/;

/** Parse one or more phase sheets (rows as arrays) into a programme. */
export function parsePplRows(sheets: unknown[][][], meta: SheetMeta): ProgramJson {
  const blocks: ProgramJsonBlock[] = [];
  let globalWeek = 0;
  const skipped: string[] = [];

  for (const rows of sheets) {
    let block: ProgramJsonBlock | null = null;
    let week: ProgramJsonWeek | null = null;
    let day: ProgramJsonDay | null = null;

    for (const row of rows) {
      const a = text(row[0]);
      const phase = a ? PHASE_RE.exec(a) : null;
      if (phase) {
        block = { name: phase[1].trim(), weeks: [] };
        blocks.push(block);
        week = null;
        day = null;
        continue;
      }
      if (a && WEEK_RE.test(a) && text(row[1]) === "Exercise") {
        if (!block) throw new Error("week header before any phase header");
        globalWeek++;
        week = { week: globalWeek, days: [] };
        block.weeks.push(week);
        day = null;
        continue;
      }
      if (!week) continue;
      if (a && /rest day/i.test(a)) { day = null; continue; }

      if (a) {
        const dm = DAY_RE.exec(a);
        const dayName = (dm ? dm[1] : a).trim();
        day = week.days.find((d) => d.name === dayName) ?? null;
        if (!day) {
          day = { name: dayName, exercises: [] };
          week.days.push(day);
        }
      }
      if (!day) continue;

      const rawName = text(row[1]);
      if (!rawName || rawName === "Exercise") continue;
      const sd = doseFromSheet(row[3], row[4]);
      if (!sd) { skipped.push(`${block?.name} W${week.week} ${day.name}: ${rawName} (${String(row[3])}, ${String(row[4])})`); continue; }

      let name = rawName;
      const noteParts: string[] = [];
      const ss = SUPERSET_RE.exec(name);
      if (ss) {
        name = name.replace(SUPERSET_RE, "");
        noteParts.push(`Superset ${ss[1]}`);
      }
      const n = text(row[10]);
      if (n) noteParts.push(n);
      if (sd.note) noteParts.push(sd.note);

      const warmUp = decodeRangeCell(row[2]);
      const rpe = decodeRangeCell(row[6]);

      day.exercises.push({
        name,
        warmUp: warmUp !== null && /^\d+(-\d+)?$/.test(warmUp) ? warmUp : null,
        dose: sd.dose,
        rpe: rpe !== null && /^\d+(-\d+)?$/.test(rpe) ? rpe : null,
        rest: text(row[7]),
        sub1: text(row[8]),
        sub2: text(row[9]),
        notes: noteParts.length ? noteParts.join(". ") : null,
      });
    }
  }

  if (skipped.length) {
    console.warn(`ppl-sheet: skipped ${skipped.length} rows that did not map to a dose`);
    for (const s of skipped.slice(0, 10)) console.warn("  " + s);
  }
  return { name: meta.name, kind: "training", description: meta.description, citation: meta.citation, sourceUrl: meta.sourceUrl, blocks };
}

/** Read every sheet whose name starts with "4x - Phase", in sheet order. */
export function parsePplWorkbook(wb: XLSX.WorkBook, meta: SheetMeta): ProgramJson {
  const XLSXUtils = (wb as unknown as { utils?: typeof XLSX.utils }).utils;
  void XLSXUtils;
  const sheets = wb.SheetNames.filter((n) => /^4x - Phase \d+$/i.test(n)).map((n) =>
    // sheet_to_json is imported at the call site to keep this module free of a runtime xlsx import in tests that use rows directly
    require("xlsx").utils.sheet_to_json(wb.Sheets[n], { header: 1, blankrows: false }) as unknown[][],
  );
  return parsePplRows(sheets, meta);
}
```

Replace the awkward `require` in `parsePplWorkbook` with a top-level `import * as XLSX from "xlsx"` (value import) if `bunx tsc --noEmit` and Vitest are both happy with it; the `import type` plus `require` shape above is only a fallback if the ESM import causes trouble under Vitest's jsdom environment. Prefer the plain import; remove the `XLSXUtils` lines either way.

- [ ] **Step 3: Run the tests, iterate**

Run `bun run test scripts/lib/__tests__/ppl-sheet.test.ts`. The real-workbook test surfaces any row shape the fixture did not anticipate; extend `doseFromSheet` for each real shape (each new shape gets a fixture case) until `bad` is empty. Print skipped rows if any remain and decide whether each is a data row or a banner.

- [ ] **Step 4: The CLI**

`scripts/convert-ppl-sheet.ts`:

```ts
/**
 * Convert the vault's Ultimate Push Pull Legs workbook into programme
 * JSON under scripts/data/programs/ (gitignored).
 *
 *   bun run convert:ppl [path-to-workbook.xlsx]
 */

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { parsePplWorkbook } from "./lib/ppl-sheet";
import { programWeeks, validateProgramJson } from "./data/programs/schema";

const input = process.argv[2] ?? "/Users/quitefrank/Claude/Personal/raw/training/nippard-ultimate-ppl-4x.xlsx";
const out = fileURLToPath(new URL("./data/programs/nippard-ultimate-ppl-4x.json", import.meta.url));

const program = validateProgramJson(
  parsePplWorkbook(XLSX.readFile(input), {
    name: "Jeff Nippard, The Ultimate Push Pull Legs System (4x per week)",
    description: "Thirteen weeks in three blocks: base hypertrophy, maximum effort, supercompensation. Four days a week: Legs, Push, Pull, Full Body. Personal copy; not redistributed.",
    citation: "Nippard J. The Ultimate Push Pull Legs System, 4x version. 2023.",
    sourceUrl: null,
  }),
);
writeFileSync(out, JSON.stringify(program, null, 2));
const days = program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days)).length;
const exercises = program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises))).length;
console.log(`wrote ${out}: ${program.blocks.length} blocks, ${programWeeks(program)} weeks, ${days} days, ${exercises} exercise rows`);
```

Add `"convert:ppl": "bun run scripts/convert-ppl-sheet.ts"` to `package.json`. Run it; confirm the JSON is written and `git status` does not list it.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/ppl-sheet.ts scripts/lib/__tests__/ppl-sheet.test.ts scripts/convert-ppl-sheet.ts package.json bun.lock
git commit -m "feat(programs): convert the PPL workbook to programme JSON" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: `scripts/seed-programs.ts`

**Files:**
- Create: `scripts/seed-programs.ts`
- Modify: `package.json` (`"seed:programs": "bun run scripts/seed-programs.ts"`)

- [ ] **Step 1: The script**

```ts
/**
 * Load every programme JSON under scripts/data/programs/ (except the
 * example) into Supabase. One program row, one program_phases row per
 * week (block name in `block`), one template per day per week, ordered
 * inside the phase by template_phases.position.
 *
 *   bun run seed:programs [path.json ...]
 *
 * Idempotent. Rows this seed owns are keyed by _notion_id values
 * prefixed "program:" and are cleared and rewritten each run. Exercises
 * are matched to the library by slug; unknown ones are inserted unrated
 * (no authoring inputs), which the recovery rules report as unrated.
 */

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadAchillesSeedEnv } from "./lib/env";
import { exerciseSlug } from "./lib/exercise-name";
import { inferTemplateCategory } from "./lib/template-name";
import { parseRange, parseRestSeconds } from "./lib/parse-prescription";
import { parseDose } from "../src/lib/recovery/dose";
import { validateProgramJson, type ProgramJson } from "./data/programs/schema";

type Report = {
  programs: { name: string; weeks: number; templates: number; templateExercises: number }[];
  exercisesInserted: string[];
  exercisesMatched: number;
  rejectedDoses: { program: string; template: string; name: string; dose: string }[];
  rowCounts: Record<string, number>;
};

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function programFiles(): string[] {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const dir = fileURLToPath(new URL("./data/programs/", import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "example.json")
    .map((f) => dir + f);
}

async function main() {
  const env = loadAchillesSeedEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report: Report = { programs: [], exercisesInserted: [], exercisesMatched: 0, rejectedDoses: [], rowCounts: {} };

  const files = programFiles();
  if (files.length === 0) fail("no programme JSON found under scripts/data/programs/ (the example is skipped)");

  const { count: mgCount } = await sb.from("muscle_groups").select("*", { count: "exact", head: true });
  if (!mgCount) fail("muscle_groups is empty. Run the Notion seed first.");

  const slugToId = new Map<string, string>();
  async function exerciseIdFor(name: string): Promise<string> {
    const slug = exerciseSlug(name, null);
    const cached = slugToId.get(slug);
    if (cached) return cached;
    const { data: existing } = await sb.from("exercises").select("id").eq("slug", slug).maybeSingle();
    if (existing) {
      slugToId.set(slug, existing.id);
      report.exercisesMatched++;
      return existing.id;
    }
    const { data, error } = await sb
      .from("exercises")
      .insert({ name: name.trim(), slug, equipment_type: "other" })
      .select("id")
      .single();
    if (error) fail(`exercise insert failed (${name}): ${error.message}`);
    slugToId.set(slug, data.id);
    report.exercisesInserted.push(slug);
    return data.id;
  }

  for (const file of files) {
    const program: ProgramJson = validateProgramJson(JSON.parse(readFileSync(file, "utf8")));
    console.log(`\n== ${program.name}`);

    const { data: prog, error: progErr } = await sb
      .from("programs")
      .upsert(
        { name: program.name, kind: "training", description: program.description, citation: program.citation, authority_notes: null, source_id: null },
        { onConflict: "name" },
      )
      .select("id")
      .single();
    if (progErr) fail(`program upsert failed: ${progErr.message}`);
    const programId = prog.id as string;

    let templates = 0;
    let templateExercises = 0;
    let position = 0;
    for (const block of program.blocks) {
      for (const week of block.weeks) {
        position++;
        const { data: phase, error: phErr } = await sb
          .from("program_phases")
          .upsert(
            {
              program_id: programId,
              position,
              label: `Week ${week.week}, ${block.name}`,
              block: block.name,
              week_from: week.week - 1,
              week_to: week.week,
              load_pct: null,
              gate: null,
              guidance: [],
              flag: null,
              flag_source_id: null,
            },
            { onConflict: "program_id,position" },
          )
          .select("id")
          .single();
        if (phErr) fail(`phase upsert failed (week ${week.week}): ${phErr.message}`);
        const phaseId = phase.id as string;

        for (const [dayIndex, day] of week.days.entries()) {
          const key = `program:${program.name}:${block.name}:${week.week}:${day.name}`;
          const { data: tpl, error: tErr } = await sb
            .from("templates")
            .upsert(
              {
                name: `${day.name}, Week ${week.week} (${block.name})`,
                category: inferTemplateCategory(day.name),
                variant: `W${week.week}`,
                notes: null,
                program_id: programId,
                _notion_id: key,
              },
              { onConflict: "_notion_id" },
            )
            .select("id")
            .single();
          if (tErr) fail(`template upsert failed (${key}): ${tErr.message}`);
          const templateId = tpl.id as string;
          templates++;

          const { error: clearErr } = await sb.from("template_exercises").delete().eq("template_id", templateId).like("_notion_id", "program:%");
          if (clearErr) fail(`template_exercises clear failed (${key}): ${clearErr.message}`);

          const rows = [];
          let pos = 0;
          for (const ex of day.exercises) {
            const d = parseDose(ex.dose);
            if (!d) {
              report.rejectedDoses.push({ program: program.name, template: key, name: ex.name, dose: ex.dose });
              continue;
            }
            pos++;
            const exId = await exerciseIdFor(ex.name);
            const warm = parseRange(ex.warmUp ?? "");
            rows.push({
              template_id: templateId,
              exercise_id: exId,
              position: pos,
              prescribed_sets_min: d.sets.min,
              prescribed_sets_max: d.sets.max,
              prescribed_reps_min: d.reps?.min ?? null,
              prescribed_reps_max: d.reps?.max ?? null,
              prescribed_rir_min: d.rir?.min ?? null,
              prescribed_rir_max: d.rir?.max ?? null,
              prescribed_seconds_min: d.seconds?.min ?? null,
              prescribed_seconds_max: d.seconds?.max ?? null,
              prescribed_rest_seconds: parseRestSeconds((ex.rest ?? "").replace("~", "")),
              prescribed_rpe: ex.rpe,
              warm_up_sets_min: warm?.min ?? null,
              warm_up_sets_max: warm?.max ?? null,
              notes: [ex.notes, d.modifier].filter(Boolean).join(" ") || null,
              _notion_id: `${key}:${pos}`,
            });

            for (const [i, sub] of [ex.sub1, ex.sub2].entries()) {
              if (!sub) continue;
              const altId = await exerciseIdFor(sub);
              if (altId === exId) continue;
              const { error: aErr } = await sb
                .from("exercise_alternates")
                .upsert(
                  { exercise_id: exId, alternate_exercise_id: altId, position: i + 1, notes: `Substitution from ${program.name}` },
                  { onConflict: "exercise_id,position", ignoreDuplicates: true },
                );
              if (aErr) fail(`alternate upsert failed (${ex.name} -> ${sub}): ${aErr.message}`);
            }
          }
          if (rows.length) {
            const { error: insErr } = await sb.from("template_exercises").insert(rows);
            if (insErr) fail(`template_exercises insert failed (${key}): ${insErr.message}`);
            templateExercises += rows.length;
          }

          const { error: tpClear } = await sb.from("template_phases").delete().eq("template_id", templateId);
          if (tpClear) fail(`template_phases clear failed (${key}): ${tpClear.message}`);
          const { error: tpErr } = await sb.from("template_phases").insert({ template_id: templateId, phase_id: phaseId, position: dayIndex + 1 });
          if (tpErr) fail(`template_phases insert failed (${key}): ${tpErr.message}`);
        }
      }
    }
    report.programs.push({ name: program.name, weeks: position, templates, templateExercises });
    console.log(`  ${position} weeks, ${templates} templates, ${templateExercises} template_exercises`);
  }

  for (const t of ["programs", "program_phases", "templates", "template_exercises", "template_phases", "exercises", "exercise_alternates"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    report.rowCounts[t] = count ?? 0;
  }
  const reportPath = fileURLToPath(new URL("./seed-programs-report.json", import.meta.url));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("\nrow counts:", report.rowCounts);
  console.log(`exercises inserted: ${report.exercisesInserted.length}, matched: ${report.exercisesMatched}, rejected doses: ${report.rejectedDoses.length}`);
  console.log(`report: ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

`ignoreDuplicates: true` on alternates keeps a library exercise's existing Notion sub-options; the programme's substitution only fills empty slots. If that is not the intended precedence, drop the flag.

- [ ] **Step 2: Wire and check**

Add `"seed:programs"` to `package.json`. `bunx tsc --noEmit`, `bun run lint`, `bun run test` clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/seed-programs.ts package.json
git commit -m "feat(programs): generic programme seed" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Run, verify, document

- [ ] **Step 1: Convert and seed**

`bun run convert:ppl` (reads the workbook), then `bun run seed:programs` twice. Second run: identical counts.

- [ ] **Step 2: Verify through REST**

The programme has 13 phases with `block` set; 52 templates with `program_id`; each phase has 4 `template_phases` rows with positions 1 to 4; week 1 Legs template lists the sheet's exercises in order; substitutions appear in `exercise_alternates` for exercises that had no Notion sub-options; `exercises` grew by the number of new names (expect a few dozen) and every new one has null authoring inputs.

- [ ] **Step 3: Docs**

`CLAUDE.md`: commands `convert:ppl` and `seed:programs`; a "Programmes" section: the JSON contract lives in `scripts/data/programs/schema.ts`, programme JSON is gitignored because the content is copyrighted, the example shows the shape, phases are weeks grouped by block, templates inside a phase are ordered by `template_phases.position`. `README.md`: the same, shorter. Spec: add a section 4.11 "Training programmes" describing weekly phases, blocks, template ordering and the JSON contract; in section 12 add "an in-app importer that produces programme JSON from a pasted sheet or CSV" to the deferred list. Vault memory: `Personal/raw/training/` holds programme exports; the Nippard PDFs still need to be dropped there or linked.

- [ ] **Step 4: Commit and report**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-09-14-achilles-recovery-design.md
git commit -m "docs: programmes library" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Report row counts, the list of exercises inserted, any rejected doses, and which Notion templates now have a programme counterpart.

---

## Self-review notes

Spec: this plan extends the spec's programmes model (section 4.6) with weekly phases, blocks, and template ordering (migration 0006 in the Achilles plan), and adds the JSON contract as the importer's interface; Task 5 writes that into the spec. The Notion-derived templates ("Legs P1" and the rest) are separate rows keyed `template:` and are untouched; the programme's templates are keyed `program:`. No task edits `seed-from-notion.ts`.

Type consistency: `ProgramJson` and friends come from `schema.ts` (Task 2) and are used by `ppl-sheet.ts` (Task 3) and `seed-programs.ts` (Task 4) with the same field names (`warmUp`, `dose`, `rpe`, `rest`, `sub1`, `sub2`, `notes`). `parseDose` gains minutes and AMRAP in Task 1, which Task 3's `doseFromSheet` relies on.

The Arms, Ab Circuit and Run templates from Notion have no programme source yet; when the Nippard PDFs (Arm Hypertrophy, Powerbuilding, Get Ready) arrive in `Personal/raw/training/`, each gets its own converter or a hand-written JSON in the same contract and the same seed loads it.
