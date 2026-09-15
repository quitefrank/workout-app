# Programme Row Variants and Library Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fold set-type spellings such as "Bench Press (Top Set)" into their base exercise with the set type on the template row, and give the programme seed a committed map that merges seed-inserted exercises into Frank's Notion rows and fills muscle group and equipment for the rest.

**Architecture:** One nullable column `template_exercises.variant`, mirrored by an optional `variant` field in the programme JSON contract. A pure module splits a workbook name into base name plus variant (or drops a dose hint) and splits a "A + B" superset cell into two rows; the converter applies it. A committed data file carries two tables, aliases (JSON slug to curated library slug) and attributes (seed slug to muscle group and equipment), which the seed applies on every run so a fresh database ends up the same.

**Tech Stack:** Supabase Postgres migrations, PGlite migration test, TypeScript pure modules with Vitest, bun scripts, supabase-js.

---

## Context for the implementer

Frank's workout app seeds Jeff Nippard's PPL workbook into Supabase as a programme (`scripts/seed-programs.ts`, `scripts/lib/ppl-sheet.ts`, `scripts/convert-ppl-sheet.ts`). The programme JSON is gitignored (copyright); `scripts/data/programs/example.json` documents the contract in `scripts/data/programs/schema.ts`.

The last run left 80 seed-owned exercises (rows whose `_notion_id` starts with `program:exercise:`) that lack a muscle group. Frank decided:

1. Names that carry a set type ("(Top Set)", "(Feeder Sets)", "Ladder", "21's") fold into the base exercise, and the set type becomes a property of the template row.
2. Seed-inserted exercises that are one of his Notion rows under another name merge into that row; the rest get a muscle group and equipment from a committed table.
3. Alternate slots that hold his Notion sub-option stay as they are (already the seed's behaviour; nothing to do).

House rules: no em dashes anywhere; Conventional Commit prefixes; parsers get tests before they hit real data; never run `supabase db reset` (the linked project holds another app's data); never print keys. `.env.local` holds the Supabase URL and service key for the linked project. The seed is idempotent; run it twice and the second run must insert and remove nothing.

Muscle group names in the database: Abs, Back, Biceps, Calves, Cardio, Chest, Glutes, Hamstrings, Quadriceps, Shoulders, Stretches, Triceps. Equipment enum: barbell, dumbbell, machine, cable, bodyweight, cardio_machine, other.

---

### Task 1: Migration 0007, `template_exercises.variant`

**Files:**
- Create: `supabase/migrations/0007_template_exercise_variant.sql`
- Modify: `scripts/__tests__/migrations.test.ts` (the ordered migration list near line 91-100, plus one new test)
- Regenerate: `src/lib/supabase/database.types.ts` via `bun run db:types`

- [ ] **Step 1: Write the failing test**

In `scripts/__tests__/migrations.test.ts`, add `"0007_template_exercise_variant.sql"` to the ordered list the "applies every migration in order" test checks, and add this test after "override rule and reason travel together" (reuse that test's helpers for creating a template and an exercise; copy how it builds `templateId` and `exerciseId`):

```ts
  it("a template row can carry a set-type variant", async () => {
    const templateId = await newTemplate();
    const exerciseId = await newExercise("variant-test");
    await db.query(
      `insert into template_exercises (template_id, exercise_id, position, variant)
       values ($1, $2, 1, 'Top Set')`,
      [templateId, exerciseId],
    );
    const { rows } = await db.query<{ variant: string | null }>(
      `select variant from template_exercises where template_id = $1`,
      [templateId],
    );
    expect(rows[0].variant).toBe("Top Set");
  });
```

If the file's helpers are named differently, use its names; the point is one insert with `variant` and one read back.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test scripts/__tests__/migrations.test.ts`
Expected: FAIL, `column "variant" of relation "template_exercises" does not exist` (and the ordered-list test fails because the file is missing).

- [ ] **Step 3: Write the migration**

```sql
-- A set-type or technique label on a template row, from the programme's
-- own wording: "Top Set", "Back Off AMRAP", "Feeder Sets", "21's",
-- "Ladder", "Slow (3 up, 3 down)". The exercise stays the base movement
-- so history and alternates attach to one library row. Null when the
-- row is a plain prescription.

alter table template_exercises
  add column variant text;
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test scripts/__tests__/migrations.test.ts`
Expected: PASS (9 tests).

- [ ] **Step 5: Push and regenerate types**

Run: `supabase db push` then `bun run db:types`.
Expected: push reports `0007_template_exercise_variant.sql` applied; `git diff --stat src/lib/supabase/database.types.ts` shows the `variant` column added under `template_exercises`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0007_template_exercise_variant.sql scripts/__tests__/migrations.test.ts src/lib/supabase/database.types.ts
git commit -m "feat(programs): template row variant"
```

---

### Task 2: `exercise-variant.ts`, the name splitter

**Files:**
- Create: `scripts/lib/exercise-variant.ts`
- Test: `scripts/lib/__tests__/exercise-variant.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// @vitest-environment node

import { describe, expect, it } from "vitest";
import { splitCompound, splitVariant } from "../exercise-variant";

describe("splitVariant", () => {
  it("moves a known set-type parenthetical onto the variant", () => {
    expect(splitVariant("Bench Press (Top Set)")).toEqual({ name: "Bench Press", variant: "Top Set", dropped: null });
    expect(splitVariant("Bench Press (Back Off AMRAP)")).toEqual({ name: "Bench Press", variant: "Back Off AMRAP", dropped: null });
    expect(splitVariant("Pause Squat (Back off)")).toEqual({ name: "Pause Squat", variant: "Back off", dropped: null });
    expect(splitVariant("Lat Pulldown (Feeder Sets)")).toEqual({ name: "Lat Pulldown", variant: "Feeder Sets", dropped: null });
    expect(splitVariant("Lat Pulldown (Failure Set)")).toEqual({ name: "Lat Pulldown", variant: "Failure Set", dropped: null });
    expect(splitVariant("EZ-Bar Curl (Heavy)")).toEqual({ name: "EZ-Bar Curl", variant: "Heavy", dropped: null });
  });

  it("leaves a parenthetical that is not a set type alone", () => {
    expect(splitVariant("Cross-Body Cable Y-Raise (Side Delt)")).toEqual({ name: "Cross-Body Cable Y-Raise (Side Delt)", variant: null, dropped: null });
    expect(splitVariant("Bench Press (Flat)")).toEqual({ name: "Bench Press (Flat)", variant: null, dropped: null });
  });

  it("drops a rep hint or a seconds suffix, which the dose already carries", () => {
    expect(splitVariant("Triceps Pressdown (12-15 reps)")).toEqual({ name: "Triceps Pressdown", variant: null, dropped: "12-15 reps" });
    expect(splitVariant("DB Skull Crusher (12-15 reps)")).toEqual({ name: "DB Skull Crusher", variant: null, dropped: "12-15 reps" });
    expect(splitVariant("Pec Static Stretch 30s")).toEqual({ name: "Pec Static Stretch", variant: null, dropped: "30s" });
    expect(splitVariant("Side Delt Static Stretch (30s)")).toEqual({ name: "Side Delt Static Stretch", variant: null, dropped: "30s" });
  });

  it("turns a trailing scheme word into the variant", () => {
    expect(splitVariant("Cable Crossover Ladder")).toEqual({ name: "Cable Crossover", variant: "Ladder", dropped: null });
    expect(splitVariant("DB Curl 21's")).toEqual({ name: "DB Curl", variant: "21's", dropped: null });
    expect(splitVariant("Cable Curl 21's")).toEqual({ name: "Cable Curl", variant: "21's", dropped: null });
  });

  it("joins a leading tempo word with its parenthetical", () => {
    expect(splitVariant("Slow Seated Leg Curl (3 up, 3 down)")).toEqual({ name: "Seated Leg Curl", variant: "Slow (3 up, 3 down)", dropped: null });
    expect(splitVariant("Slow Eccentric Curl")).toEqual({ name: "Eccentric Curl", variant: "Slow", dropped: null });
  });

  it("moves a squeeze-only or stretch-only prefix onto the variant", () => {
    expect(splitVariant("Squeeze-Only Triceps Pressdown")).toEqual({ name: "Triceps Pressdown", variant: "Squeeze-only", dropped: null });
    expect(splitVariant("Stretch-Only Overhead Triceps Extension")).toEqual({ name: "Overhead Triceps Extension", variant: "Stretch-only", dropped: null });
  });

  it("applies the explicit aliases first", () => {
    expect(splitVariant("EZ-Bar Modified Bicep 21's")).toEqual({ name: "EZ-Bar Curl", variant: "Modified 21's", dropped: null });
    expect(splitVariant("Squat or Machine Squat")).toEqual({ name: "Squat", variant: null, dropped: null });
  });

  it("keeps a plain name unchanged", () => {
    expect(splitVariant("Hammer Cheat Curl")).toEqual({ name: "Hammer Cheat Curl", variant: null, dropped: null });
    expect(splitVariant("Pause Squat")).toEqual({ name: "Pause Squat", variant: null, dropped: null });
    expect(splitVariant("  Kroc Row  ")).toEqual({ name: "Kroc Row", variant: null, dropped: null });
  });
});

describe("splitCompound", () => {
  it("splits an A + B superset cell into two names", () => {
    expect(splitCompound("Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension")).toEqual([
      "Squeeze-Only Triceps Pressdown",
      "Stretch-Only Overhead Triceps Extension",
    ]);
  });

  it("returns a single name otherwise", () => {
    expect(splitCompound("Bench Press")).toEqual(["Bench Press"]);
    expect(splitCompound("DB Curl 21's")).toEqual(["DB Curl 21's"]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `bun run test scripts/lib/__tests__/exercise-variant.test.ts`
Expected: FAIL, cannot find module `../exercise-variant`.

- [ ] **Step 3: Write the module**

```ts
/**
 * Split a programme's exercise spelling into the base exercise and the
 * set type it carries, so "Bench Press (Top Set)" resolves to the same
 * library row as "Bench Press" and the set type lives on the template
 * row (template_exercises.variant).
 *
 * Only known set-type words move to the variant; any other
 * parenthetical ("(Side Delt)", "(Flat)") is part of the name. A rep
 * hint or a seconds suffix is dropped, since the dose already says it.
 * A cell naming two movements joined by " + " is a superset performed
 * as one set; splitCompound turns it into two rows.
 */

export type VariantSplit = {
  name: string;
  variant: string | null;
  /** Text removed from the name that carried no information beyond the dose. */
  dropped: string | null;
};

/** Spellings no rule can derive. Exact match after whitespace collapse. */
const ALIASES: Record<string, VariantSplit> = {
  "EZ-Bar Modified Bicep 21's": { name: "EZ-Bar Curl", variant: "Modified 21's", dropped: null },
  "Squat or Machine Squat": { name: "Squat", variant: null, dropped: null },
};

/** Parenthetical set types, matched whole and case-insensitively; the variant keeps the source spelling. */
const SET_TYPE_RE = /^(top set|back ?off(?: amrap)?|feeder sets?|failure set|heavy|light|drop ?set|rest[- ]?pause|myo[- ]?reps?|amrap|cluster)$/i;
const REP_HINT_RE = /^\d+(?:\s*-\s*\d+)?\s*reps?$/i;
const SECONDS_RE = /^\d+\s*s(?:ec)?$/i;
const TEMPO_RE = /^\d+\s*up,?\s*\d+\s*down$/i;
const TRAILING_PAREN_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;
const TRAILING_SECONDS_RE = /^(.*?)\s+(\d+s)$/i;
const TRAILING_SCHEME_RE = /^(.*?)\s+(ladder|21's|21s)$/i;
const LEADING_SLOW_RE = /^slow\s+(.+)$/i;
const LEADING_HALF_RE = /^(squeeze|stretch)-only\s+(.+)$/i;

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

export function splitVariant(rawName: string): VariantSplit {
  let name = collapse(rawName);
  const alias = ALIASES[name];
  if (alias) return { ...alias };

  const variantParts: string[] = [];
  let dropped: string | null = null;

  const half = LEADING_HALF_RE.exec(name);
  if (half) {
    variantParts.push(`${half[1][0].toUpperCase()}${half[1].slice(1).toLowerCase()}-only`);
    name = half[2];
  }

  const slow = LEADING_SLOW_RE.exec(name);
  if (slow) {
    variantParts.push("Slow");
    name = slow[1];
  }

  const paren = TRAILING_PAREN_RE.exec(name);
  if (paren) {
    const inner = collapse(paren[2]);
    if (REP_HINT_RE.test(inner) || SECONDS_RE.test(inner)) {
      dropped = inner;
      name = paren[1];
    } else if (TEMPO_RE.test(inner)) {
      variantParts.push(`(${inner})`);
      name = paren[1];
    } else if (SET_TYPE_RE.test(inner)) {
      variantParts.push(inner);
      name = paren[1];
    }
  }

  const seconds = TRAILING_SECONDS_RE.exec(name);
  if (seconds) {
    dropped = seconds[2];
    name = seconds[1];
  }

  const scheme = TRAILING_SCHEME_RE.exec(name);
  if (scheme) {
    variantParts.push(scheme[2].toLowerCase() === "21s" ? "21's" : scheme[2]);
    name = scheme[1];
  }

  return { name: collapse(name), variant: variantParts.length ? variantParts.join(" ") : null, dropped };
}

/** "A + B" is two movements done as one set; anything else is one name. */
export function splitCompound(rawName: string): string[] {
  const parts = collapse(rawName).split(/\s\+\s/);
  return parts.length === 2 ? parts.map(collapse) : [collapse(rawName)];
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `bun run test scripts/lib/__tests__/exercise-variant.test.ts`
Expected: PASS. If "Slow Eccentric Curl" or "Squeeze-Only" casing fails, fix the module, not the test.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/exercise-variant.ts scripts/lib/__tests__/exercise-variant.test.ts
git commit -m "feat(programs): split set-type variants out of exercise names"
```

---

### Task 3: Contract and converter carry `variant`

**Files:**
- Modify: `scripts/data/programs/schema.ts` (type `ProgramJsonExercise`, validator around line 112-121, header comment)
- Modify: `scripts/data/programs/example.json` (add `"variant": null` to every exercise, and `"variant": "Top Set"` on the first one)
- Modify: `scripts/lib/ppl-sheet.ts` (row emission around lines 166-191)
- Test: `scripts/data/programs/__tests__/schema.test.ts`, `scripts/lib/__tests__/ppl-sheet.test.ts`

- [ ] **Step 1: Write the failing schema test**

Add to `schema.test.ts`, next to the existing exercise-shape tests:

```ts
  it("carries an optional variant on an exercise, defaulting to null", () => {
    const base = JSON.parse(JSON.stringify(example)) as Record<string, unknown>;
    const first = ((base.blocks as any[])[0].weeks[0].days[0].exercises as any[])[0];
    first.variant = "Top Set";
    const second = ((base.blocks as any[])[0].weeks[0].days[0].exercises as any[])[1];
    delete second.variant;
    const p = validateProgramJson(base);
    expect(p.blocks[0].weeks[0].days[0].exercises[0].variant).toBe("Top Set");
    expect(p.blocks[0].weeks[0].days[0].exercises[1].variant).toBeNull();
  });
```

Use whatever the file already names the loaded example (`example`, `EXAMPLE`); if it uses `any` nowhere, type the walk with `as { blocks: { weeks: { days: { exercises: Record<string, unknown>[] }[] }[] }[] }` instead so lint stays clean.

- [ ] **Step 2: Write the failing converter test**

Add to `ppl-sheet.test.ts`. The fixture rows are arrays in column order `[day, name, warmUp, workingSets, reps, load, rpe, rest, sub1, sub2, notes]`.

```ts
  it("folds set-type names onto the row variant and keeps the base name", () => {
    const rows: unknown[][] = [
      ["Test Program"],
      ["Phase 1 - Block One (Test)"],
      HEADER,
      ["Push #1", "Bench Press (Top Set)", 2, 1, "2-4", null, 44782, "~3-4 min", "DB Bench Press", "Machine Chest Press", "Explode"],
      [null, "Bench Press (Back Off AMRAP)", 0, 1, "AMRAP", "~60%", 10, "~3-4 min", "DB Bench Press", "Machine Chest Press", null],
      [null, "Pec Static Stretch 30s", 0, 2, "30s HOLD", null, "N/A", "0 min", "N/A", "N/A", "Hold"],
      [null, "Triceps Pressdown", 0, 3, "8", null, 9, "~1-2 min", "Triceps Pressdown (12-15 reps)", "DB Skull Crusher (12-15 reps)", null],
    ];
    const { program, skipped } = parsePplRows([rows], META);
    expect(skipped).toEqual([]);
    const ex = program.blocks[0].weeks[0].days[0].exercises;
    expect(ex.map((e) => [e.name, e.variant])).toEqual([
      ["Bench Press", "Top Set"],
      ["Bench Press", "Back Off AMRAP"],
      ["Pec Static Stretch", null],
      ["Triceps Pressdown", null],
    ]);
    expect(ex[3].sub1).toBe("Triceps Pressdown");
    expect(ex[3].sub2).toBe("DB Skull Crusher");
  });

  it("splits an A + B superset cell into two rows sharing the prescription", () => {
    const rows: unknown[][] = [
      ["Test Program"],
      ["Phase 1 - Block One (Test)"],
      HEADER,
      ["Push #1", "A1. Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension", 0, 3, "8 + 8", null, "9-10", "~1-2 min", "Triceps Pressdown (12-15 reps)", "DB Skull Crusher (12-15 reps)", "Do the squeeze then the stretch"],
    ];
    const { program, skipped } = parsePplRows([rows], META);
    expect(skipped).toEqual([]);
    const ex = program.blocks[0].weeks[0].days[0].exercises;
    expect(ex).toHaveLength(2);
    expect(ex[0]).toMatchObject({ name: "Triceps Pressdown", variant: "Squeeze-only", dose: "3 x 8", sub1: "Triceps Pressdown", sub2: null });
    expect(ex[1]).toMatchObject({ name: "Overhead Triceps Extension", variant: "Stretch-only", dose: "3 x 8", sub1: "DB Skull Crusher", sub2: null });
    expect(ex[0].notes).toContain("Superset A");
    expect(ex[0].notes).toContain("8 + 8");
    expect(ex[1].notes).toContain("8 + 8");
    expect(ex[1].notes).toContain("Do the squeeze then the stretch");
  });
```

`META` is whatever the file already passes as `SheetMeta`; if it inlines the object, inline it here too. Note `sub1` is itself "Triceps Pressdown", the same as the row's own name: the seed already skips an alternate equal to its exercise, so the converter keeps it.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `bun run test scripts/data/programs scripts/lib/__tests__/ppl-sheet.test.ts`
Expected: FAIL on `variant` (schema drops it; converter does not emit it, names are unsplit, one row instead of two).

- [ ] **Step 4: Update the contract**

In `schema.ts`, add to `ProgramJsonExercise` after `name`:

```ts
  /** Set type or technique the source put in the name ("Top Set", "21's"); null for a plain row. */
  variant: string | null;
```

In the validator's exercise mapping add `variant: strOrNull(e.variant, \`${ep}.variant\`),` after `name`. Extend the header comment's second paragraph with: "A set type the source spelled into the name (\"Bench Press (Top Set)\") is `variant` on the row, and the name is the base exercise."

In `example.json`, add `"variant": null` after `"name"` on every exercise and set the first exercise's to `"Top Set"`.

- [ ] **Step 5: Update the converter**

In `ppl-sheet.ts`, import the splitter:

```ts
import { splitCompound, splitVariant } from "./exercise-variant";
```

Replace the block from `let name = rawName;` through `day.exercises.push({...});` with:

```ts
      let cell = rawName;
      const noteParts: string[] = [];
      const ss = SUPERSET_RE.exec(cell);
      if (ss) {
        cell = cell.replace(SUPERSET_RE, "");
        noteParts.push(`Superset ${ss[1]}`);
      }
      const n = text(row[10]);
      if (n) noteParts.push(n);
      const load = text(row[5]);
      if (load) noteParts.push(`Load: ${load}`);
      if (sd.note) noteParts.push(sd.note);

      const warmUp = decodeRangeCell(row[2]);
      const rpe = decodeRangeCell(row[6]);
      const subs = [text(row[8]), text(row[9])].map((s) => (s ? splitVariant(s).name : null));

      // "A + B" is two movements done as one set: two rows with the same
      // prescription, the first substitution on the first row and the
      // second on the second.
      const parts = splitCompound(cell);
      for (const [i, part] of parts.entries()) {
        const split = splitVariant(part);
        const [sub1, sub2] = parts.length === 2 ? [subs[i] ?? null, null] : subs;
        day.exercises.push({
          name: split.name,
          variant: split.variant,
          warmUp: warmUp !== null && /^\d+(-\d+)?$/.test(warmUp) ? warmUp : null,
          dose: sd.dose,
          rpe: rpe !== null && /^\d+(-\d+)?$/.test(rpe) ? rpe : null,
          rest: text(row[7]),
          sub1,
          sub2,
          notes: noteParts.length ? noteParts.join(". ") : null,
        });
      }
```

Update the module header comment: after the sentence about doseFromSheet add "Set types spelled into a name move to the row's variant and a \"+\" cell becomes two rows (exercise-variant.ts)."

- [ ] **Step 6: Run the tests to verify they pass**

Run: `bun run test`
Expected: PASS, all files. Fix the existing ppl-sheet test that reads the fixture's "A2: Example Stretch 30s" if it asserted the old name; it should now expect `name: "Example Stretch"` and `variant: null`.

- [ ] **Step 7: Regenerate the programme JSON and check it**

Run: `bun run convert:ppl`
Expected: `wrote ... 3 blocks, 13 weeks, 52 days, 353 exercise rows` (347 plus the six superset rows that became two; if the count differs, print the names that changed and explain in the report).

Then: `bun -e 'const p=JSON.parse(await Bun.file("scripts/data/programs/nippard-ultimate-ppl-4x.json").text()); const v=new Map(); for(const b of p.blocks)for(const w of b.weeks)for(const d of w.days)for(const e of d.exercises){ if(e.variant) v.set(e.name+" | "+e.variant,(v.get(e.name+" | "+e.variant)??0)+1)} console.log([...v].sort().join("\n"))'`
Expected: exactly these name | variant pairs (counts may vary): Bench Press | Back Off AMRAP, Bench Press | Top Set, Cable Crossover | Ladder, EZ-Bar Curl | Heavy, EZ-Bar Curl | Modified 21's, Lat Pulldown | Failure Set, Lat Pulldown | Feeder Sets, Overhead Triceps Extension | Stretch-only, Pause Squat | Back off, Seated Leg Curl | Slow (3 up, 3 down), Triceps Pressdown | Squeeze-only. If "DB Curl | 21's" or "Cable Curl | 21's" appear as prescribed rows, that is fine too (they were substitutions in the source; check).

- [ ] **Step 8: Commit**

```bash
git add scripts/data/programs/schema.ts scripts/data/programs/example.json scripts/data/programs/__tests__/schema.test.ts scripts/lib/ppl-sheet.ts scripts/lib/__tests__/ppl-sheet.test.ts
git commit -m "feat(programs): row variant in the contract and the workbook converter"
```

---

### Task 4: The library map

**Files:**
- Create: `scripts/data/programs/library.ts`
- Test: `scripts/data/programs/__tests__/library.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node

import { describe, expect, it } from "vitest";
import { LIBRARY_ALIASES, LIBRARY_ATTRIBUTES, MUSCLE_GROUP_NAMES } from "../library";
import { exerciseSlug } from "../../../lib/exercise-name";

describe("library map", () => {
  it("keys are slugs", () => {
    for (const k of [...Object.keys(LIBRARY_ALIASES), ...Object.values(LIBRARY_ALIASES), ...Object.keys(LIBRARY_ATTRIBUTES)]) {
      expect(k).toBe(exerciseSlug(k, null));
    }
  });

  it("an alias key never also has attributes, and never aliases itself", () => {
    for (const [from, to] of Object.entries(LIBRARY_ALIASES)) {
      expect(from).not.toBe(to);
      expect(LIBRARY_ATTRIBUTES[from]).toBeUndefined();
    }
  });

  it("every attribute names a known muscle group", () => {
    for (const [slug, a] of Object.entries(LIBRARY_ATTRIBUTES)) {
      expect(MUSCLE_GROUP_NAMES, slug).toContain(a.muscleGroup);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test scripts/data/programs/__tests__/library.test.ts`
Expected: FAIL, cannot find module `../library`.

- [ ] **Step 3: Write the data file**

```ts
/**
 * How programme exercises map onto Frank's library.
 *
 * LIBRARY_ALIASES: a programme spelling (as a slug) that is one of the
 * curated Notion rows under another name. The seed resolves the alias
 * before near-duplicate matching, so no seed row is inserted for it.
 *
 * LIBRARY_ATTRIBUTES: muscle group and equipment for exercises the seed
 * inserts because no curated row exists. Applied on every run to
 * seed-owned rows only; a curated row is never touched.
 *
 * Slugs are exerciseSlug(name, null) of the JSON name after the variant
 * split ("Bench Press (Top Set)" is "bench-press").
 */

import type { EquipmentType } from "../../lib/exercise-name";

export const MUSCLE_GROUP_NAMES = [
  "Abs", "Back", "Biceps", "Calves", "Cardio", "Chest", "Glutes", "Hamstrings", "Quadriceps", "Shoulders", "Stretches", "Triceps",
] as const;
export type MuscleGroupName = (typeof MUSCLE_GROUP_NAMES)[number];

export type LibraryAttributes = { muscleGroup: MuscleGroupName; equipmentType: EquipmentType };

export const LIBRARY_ALIASES: Record<string, string> = {
  "barbell-hip-thrust": "hip-thrust",
  "bench-press": "bench-press-flat",
  "bulgarian-split-squat": "db-bulgarian-split-squats",
  "cable-lat-pullover": "cable-pullover",
  "cable-triceps-kickback": "cable-tricep-kickback",
  "close-grip-seated-cable-row": "cable-seated-row",
  "decline-plate-weighted-crunch": "decline-weighted-crunch",
  "diamond-pushup": "diamond-push-ups",
  "ez-bar-curl": "ez-bar-bicep-curls",
  "incline-db-press": "db-bench-press-incline",
  "lat-static-stretch": "static-lat-stretch",
  "low-incline-db-press": "db-bench-press-low-incline",
  "med-ball-close-grip-push-up": "med-ball-push-up",
  "overhead-triceps-extension": "overhead-cable-triceps-extension",
  "pec-static-stretch": "pec-stretch",
  "seated-db-shoulder-press": "db-shoulder-press",
  "side-delt-static-stretch": "delt-stretch",
  "single-arm-cable-tricep-kickback": "cable-tricep-kickback",
  "single-arm-db-row": "dumbbell-rows",
  "single-arm-row": "dumbbell-rows",
  "standing-dumbbell-arnold-press": "standing-arnold-press",
  "walking-lunge": "walking-db-lunge",
};

export const LIBRARY_ATTRIBUTES: Record<string, LibraryAttributes> = {
  "1-arm-half-kneeling-lat-pulldown": { muscleGroup: "Back", equipmentType: "cable" },
  "ab-wheel-rollout": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "bent-over-reverse-db-flye": { muscleGroup: "Shoulders", equipmentType: "dumbbell" },
  "bottom-half-db-lat-pullover": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "cable-crossover": { muscleGroup: "Chest", equipmentType: "cable" },
  "cable-crunch": { muscleGroup: "Abs", equipmentType: "cable" },
  "cable-shrug-in": { muscleGroup: "Back", equipmentType: "cable" },
  "close-grip-barbell-incline-press": { muscleGroup: "Triceps", equipmentType: "barbell" },
  "close-grip-push-up": { muscleGroup: "Triceps", equipmentType: "bodyweight" },
  "constant-tension-cable-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "constant-tension-machine-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "machine" },
  "cross-body-cable-y-raise-side-delt": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "db-floor-skull-crusher": { muscleGroup: "Triceps", equipmentType: "dumbbell" },
  "db-french-press": { muscleGroup: "Triceps", equipmentType: "dumbbell" },
  "db-shrug": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "db-triceps-kickback": { muscleGroup: "Triceps", equipmentType: "dumbbell" },
  "hammer-cheat-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "high-bar-box-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "high-incline-smith-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "incline-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "kneeling-modified-push-up": { muscleGroup: "Chest", equipmentType: "bodyweight" },
  "kroc-row": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "lat-pulldown": { muscleGroup: "Back", equipmentType: "cable" },
  "lean-in-constant-tension-db-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "dumbbell" },
  "llpt-plank": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "low-incline-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "low-incline-smith-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "machine-squat": { muscleGroup: "Quadriceps", equipmentType: "machine" },
  "n1-style-cross-body-triceps-extension": { muscleGroup: "Triceps", equipmentType: "cable" },
  "omni-direction-face-pull": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "omni-grip-machine-chest-supported-row": { muscleGroup: "Back", equipmentType: "machine" },
  "pendlay-row": { muscleGroup: "Back", equipmentType: "barbell" },
  "plank": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "plate-shrug": { muscleGroup: "Back", equipmentType: "other" },
  "plate-weighted-crunch": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "press-around": { muscleGroup: "Chest", equipmentType: "cable" },
  "reverse-cable-flye": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "reverse-pec-deck": { muscleGroup: "Shoulders", equipmentType: "machine" },
  "squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "t-bar-row": { muscleGroup: "Back", equipmentType: "barbell" },
  "trap-bar-deadlift": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "triceps-pressdown": { muscleGroup: "Triceps", equipmentType: "cable" },
  "wide-grip-machine-row": { muscleGroup: "Back", equipmentType: "machine" },
  "wide-grip-t-bar-row": { muscleGroup: "Back", equipmentType: "barbell" },
};
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test scripts/data/programs/__tests__/library.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add scripts/data/programs/library.ts scripts/data/programs/__tests__/library.test.ts
git commit -m "feat(programs): library aliases and attributes for programme exercises"
```

---

### Task 5: Seed applies the variant and the map

**Files:**
- Modify: `scripts/seed-programs.ts`

No unit test reaches the seed (it runs `main()` on import and needs a live client); verification is the two-run check in Step 5 and the REST checks in Step 6.

- [ ] **Step 1: Report fields**

Add to `Report` after `fuzzyMatches`:

```ts
  /** Matched a curated row through LIBRARY_ALIASES. */
  aliasMatches: { wanted: string; matched: string }[];
  /** Alias targets that are not in the library; the alias is ignored and the name resolved as usual. */
  aliasesMissing: { wanted: string; target: string }[];
  /** Seed-owned rows whose muscle group or equipment LIBRARY_ATTRIBUTES set or corrected this run. */
  attributesApplied: string[];
  /** LIBRARY_ATTRIBUTES keys that are not seed-owned rows (aliased away, renamed, or never inserted). */
  attributesUnused: string[];
```

Initialise them in `main()` (`[]` each). Import at the top:

```ts
import { LIBRARY_ALIASES, LIBRARY_ATTRIBUTES } from "./data/programs/library";
```

- [ ] **Step 2: Aliases in the resolver**

In `makeResolver`, replace `const candidates = slugCandidates(slug);` with:

```ts
    const alias = LIBRARY_ALIASES[slug];
    const fuzzy = slugCandidates(slug);
    const candidates = alias ? [slug, alias, ...fuzzy.filter((c) => c !== slug && c !== alias)] : fuzzy;
```

After `const hit = pick(false) ?? pick(true);` and inside `if (hit) {`, replace the `fuzzyMatches` push with:

```ts
      if (hit.slug === alias) report.aliasMatches.push({ wanted: slug, matched: hit.slug as string });
      else if (hit.slug !== slug) report.fuzzyMatches.push({ wanted: slug, matched: hit.slug as string });
```

Before the `if (!insertIfMissing) return null;` line add:

```ts
    if (alias && !(rows ?? []).some((r) => r.slug === alias)) report.aliasesMissing.push({ wanted: slug, target: alias });
```

Update the resolver's doc comment: "by its slug, its alias in LIBRARY_ALIASES, or a near-duplicate".

- [ ] **Step 3: Variant on template rows**

In step 3's `rows.push({...})` add `variant: ex.variant,` after `position: pos,`.

- [ ] **Step 4: Attributes step and hand-fix rule**

Rename the console labels so the steps read `[0/7]` to `[7/7]`. Insert a new step after the current step 4 (unreferenced seed exercises) and before the orphans step:

```ts
  // 5. Attributes for seed-owned rows from LIBRARY_ATTRIBUTES. Curated
  // rows are never touched; a key that is not a seed-owned row (aliased
  // away, or renamed) is reported so the table does not rot.
  console.log("\n[5/7] library attributes");
  const { data: groups, error: gErr } = await sb.from("muscle_groups").select("id,name");
  if (gErr) fail(`muscle_groups listing failed: ${gErr.message}`);
  const groupId = new Map((groups ?? []).map((g) => [g.name as string, g.id as string]));
  for (const [slug, a] of Object.entries(LIBRARY_ATTRIBUTES)) {
    if (!groupId.has(a.muscleGroup)) fail(`LIBRARY_ATTRIBUTES ${slug}: muscle group "${a.muscleGroup}" is not in muscle_groups`);
  }
  const { data: ownedRows, error: ownedRowsErr } = await sb
    .from("exercises")
    .select("id,slug,equipment_type,muscle_group_id")
    .like("_notion_id", `${EXERCISE_OWNER}%`);
  if (ownedRowsErr) fail(`seed exercise listing failed: ${ownedRowsErr.message}`);
  const ownedBySlug = new Map((ownedRows ?? []).map((r) => [r.slug as string, r]));
  for (const [slug, a] of Object.entries(LIBRARY_ATTRIBUTES)) {
    const row = ownedBySlug.get(slug);
    if (!row) {
      report.attributesUnused.push(slug);
      continue;
    }
    const wantedGroup = groupId.get(a.muscleGroup) as string;
    if (row.muscle_group_id === wantedGroup && row.equipment_type === a.equipmentType) continue;
    const { error: updErr } = await sb
      .from("exercises")
      .update({ muscle_group_id: wantedGroup, equipment_type: a.equipmentType })
      .eq("id", row.id as string);
    if (updErr) fail(`attribute update failed (${slug}): ${updErr.message}`);
    report.attributesApplied.push(slug);
  }
  console.log(`  ${report.attributesApplied.length} applied, ${report.attributesUnused.length} unused keys`);
```

Then change the hand-fix rule. Replace the `report.handFix = ...` mapping so a deliberate `other` in the table does not count:

```ts
  report.handFix = (fixRows ?? [])
    .map((r) => {
      const group = r.muscle_group as { name: string } | { name: string }[] | null;
      return {
        slug: r.slug as string,
        equipmentType: r.equipment_type as string,
        muscleGroup: Array.isArray(group) ? (group[0]?.name ?? null) : (group?.name ?? null),
      };
    })
    .filter((r) => r.muscleGroup === null || !(r.slug in LIBRARY_ATTRIBUTES));
```

Update the `handFix` field comment: "Seed-owned exercises with no muscle group, or at equipment_type "other" without a LIBRARY_ATTRIBUTES entry saying so; computed every run."

Add to the final report printout a line: `console.log(\`  aliases: ${report.aliasMatches.length} matched, ${report.aliasesMissing.length} missing; attributes: ${report.attributesApplied.length} applied, ${report.attributesUnused.length} unused\`);`

Update the header comment (the "Exercises match the library" paragraph) to mention the alias table and the attributes step.

- [ ] **Step 5: Run the seed twice**

Run: `bunx tsc --noEmit && bun run lint && bun run seed:programs`
Expected first run: `aliasMatches` about 22 (one per alias key that the JSON still names), `aliasesMissing` 0, `fuzzyMatches` includes `db-skull-crusher -> db-skull-crushers` and `db-curl -> db-curls`, `exercisesInserted` includes `lat-pulldown` and `cable-crossover`, `exercisesRemoved` lists the folded and aliased seed rows (`bench-press-top-set`, `bench-press-back-off-amrap`, `bench-press`, `ez-bar-curl-heavy`, `cable-crossover-ladder`, the four `*-static-stretch-30s`, `triceps-pressdown-12-15-reps`, `db-skull-crusher-12-15-reps`, `squat-or-machine-squat`, `slow-seated-leg-curl-3-up-3-down`, `ez-bar-modified-bicep-21-s`, `db-curl-21-s`, `cable-curl-21-s`, `pause-squat-back-off`, `lat-pulldown-feeder-sets`, `lat-pulldown-failure-set`, the aliased ones), `attributesApplied` about 44, `attributesUnused` 0, `handFix` 0.

Run again: `bun run seed:programs`
Expected: `exercisesInserted` 0, `exercisesRemoved` 0, `attributesApplied` 0, `attributesUnused` 0, `handFix` 0, row counts identical to the first run's.

If `attributesUnused` is not empty, the key is misspelled or the row was aliased: fix the table (not the data) and rerun. If `handFix` is not empty, add the row to `LIBRARY_ATTRIBUTES` and rerun. If `aliasesMissing` is not empty, the curated slug is wrong; check with the REST query in Step 6 and fix the table.

- [ ] **Step 6: REST verification**

With a scratch script in the scratchpad (never print keys), confirm:
1. `select slug from exercises where _notion_id like 'program:exercise:%' and muscle_group_id is null` returns 0 rows.
2. `select count(*) from template_exercises where variant is not null` is about 40 (all rows of the 13 name|variant pairs from Task 3 Step 7 across the weeks they appear in); list the distinct `(exercise slug, variant)` pairs and compare with that list.
3. `select slug from exercises where slug in ('bench-press','bench-press-top-set','ez-bar-curl','cable-crossover-ladder','walking-lunge','standing-dumbbell-arnold-press')` returns 0 rows.
4. No Notion or Achilles row's `updated_at` is later than the first run's start time (the seed must not touch curated rows).
5. Every `exercise_alternates` row keyed `program:%` points at an existing exercise (the FK guarantees this; just count them and compare with the report's `alternatesInPlace`).

- [ ] **Step 7: Commit**

```bash
git add scripts/seed-programs.ts
git commit -m "feat(programs): seed writes row variants and applies the library map"
```

---

### Task 6: Docs

**Files:**
- Modify: `CLAUDE.md` (Programmes section; Parsers list; Database "Eighteen tables" paragraph unchanged; migrations mention)
- Modify: `docs/superpowers/specs/2026-09-14-achilles-recovery-design.md` (section 4.10 template rows or wherever `override_rule` is described: one sentence on `variant`)
- Modify: `README.md` if it lists the parser modules or the migration files

- [ ] **Step 1: CLAUDE.md**

In the Parsers list add after `ppl-sheet.ts`:

```
- `scripts/lib/exercise-variant.ts` Split a programme spelling into the
  base exercise and its set type ("Bench Press (Top Set)"), drop a rep
  or seconds hint the dose already carries, and split an "A + B"
  superset cell into two rows.
```

In the Programmes section, after the paragraph on exercise matching, add:

```
A set type spelled into a name ("Bench Press (Top Set)", "DB Curl 21's",
"Cable Crossover Ladder") is split off by the converter: the row's
exercise is the base movement and `template_exercises.variant` carries
the set type, so history and alternates attach to one library row. A
workbook cell naming two movements with "+" becomes two rows sharing
the prescription.

`scripts/data/programs/library.ts` is the committed map from programme
spellings to the library: `LIBRARY_ALIASES` sends a programme slug to
the curated Notion row it really is (`bench-press` to
`bench-press-flat`), tried before near-duplicate matching; and
`LIBRARY_ATTRIBUTES` gives muscle group and equipment to the exercises
the seed inserts, applied to seed-owned rows on every run so a fresh
database ends up the same. The report lists `aliasMatches`,
`aliasesMissing`, `attributesApplied` and `attributesUnused`; `handFix`
is now the seed-owned rows the table does not cover.
```

Update the test count line ("suite now N") to the live number after `bun run test`.

- [ ] **Step 2: Spec**

In the spec's section on template rows (search for `override_rule`), add one sentence: "`variant` (added in `0007`) carries a set type the programme spelled into the exercise name, such as \"Top Set\" or \"21's\"; the row's exercise is the base movement."

- [ ] **Step 3: Check, then commit**

Run: `bun run test && bunx tsc --noEmit && bun run lint && grep -rn "—" CLAUDE.md README.md docs/superpowers/specs/2026-09-14-achilles-recovery-design.md scripts/lib/exercise-variant.ts scripts/data/programs/library.ts scripts/seed-programs.ts`
Expected: all green, grep finds nothing.

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-09-14-achilles-recovery-design.md
git commit -m "docs: row variants and the library map"
```

---

## Report back

Commit SHAs; the second-run report counts (row counts, inserted, removed, aliasMatches, aliasesMissing, fuzzyMatches, attributesApplied, attributesUnused, handFix); the distinct (exercise, variant) pairs found in `template_exercises`; the REST results from Task 5 Step 6; the live test count; anything not done and why.
