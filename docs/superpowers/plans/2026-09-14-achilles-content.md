# Achilles Content Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Put the Achilles material into the database: the recovery program and its phases, the sources, the reviewed exercises with every authoring input set and the 416 Physio demonstration clips attached, the recovery templates, and the user's clearances, events and rules, seeded from committed data plus one gitignored personal file, with tests that keep the committed data honest.

**Architecture:** Committed seed data lives in typed TypeScript modules under `scripts/data/achilles/`, validated by Vitest (every authoring input present, every dose parses, every phase matches the handout, no patient detail). `scripts/seed-achilles.ts` upserts them into Supabase through the service role, matching exercises to the Notion-seeded library by slug. A review document is the gate: nothing about exercise selection is written into data files until the user has approved it. The 416 Physio article takes precedence over the prototype's selection; where one of its exercises trips an authoring rule, the template row carries an explicit override naming the rule and the reason, so the decision is recorded rather than silent.

**Tech Stack:** bun 1.3, Vitest 4, Supabase JS, the domain modules in `src/lib/recovery/`, the helpers in `scripts/lib/`, PGlite for the migration test.

**Spec:** `docs/superpowers/specs/2026-09-14-achilles-recovery-design.md`, sections 7, 8, 9. The companion plan `2026-09-14-programs-library.md` covers the Nippard programme and the JSON programme contract; Task 2 here adds the migration both plans need.

**Prerequisite state (done):** migrations 0001 to 0005 applied on the linked project; Notion seed run; `.env.local` complete with `SEED_USER_ID`; 175 tests passing.

**Ground rules for every task**

- No em dashes anywhere.
- Every commit ends with `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>` as a second `-m`.
- Sources are at `/Users/quitefrank/Claude/Personal/raw/achilles/`. Read them freely. Copy NOTHING personal into the repository: no dates from 2026, no imaging findings, no clinician or clinic names, no injured side. `02-CASE-FILE.md` is the personal one; the handout in `05`, the training material in `06`, and the article in `08` are generic. The repository is public.
- `bun run test` before every commit; the count only goes up.
- The prototype's exercise arrays are `D_PULL`, `D_LEG`, `D_PUSH`, `D_PULL2` in `achilles-recovery-program.html`: 22 exercises across four workouts. Each row is `[name, dose, cue, alternates[]]`.
- The 416 Physio article's 14 exercises each have an unlisted Vimeo clip. The ids and hashes, verified on 2026-09-14 through Vimeo's oEmbed (titles match, player loads):

| Exercise | Vimeo id | hash |
|---|---|---|
| Straight Leg Raises | 1131834121 | 7c25a0f7d7 |
| Side-Lying Hip Abductions | 1132227018 | 12fe6ede9c |
| Leg Extensions with Band | 1132227414 | 971f218e2b |
| Glute Bridges | 1117498689 | (read from the page) |
| Ball Wall Squats | 1132237887 | (read from the page) |
| Sit-to-Stand from a High Surface | 1117498539 | (read from the page) |
| Tricep Extensions (supine) | 1132246391 | (read from the page) |
| Shoulder Press | 1117498397 | (read from the page) |
| Banded Rows | 1117498366 | (read from the page) |
| Seated Russian Twists | 1117498450 | (read from the page) |
| Supine Marches | 1117498578 | (read from the page) |
| Front Plank | 1132534126 | (read from the page) |
| Modified Push Ups | 1132534236 | (read from the page) |
| Stationary Bike | 1132558822 | (read from the page) |

The hashes marked "read from the page" are in the article HTML as `player.vimeo.com/video/<id>?h=<hash>`; Task 3 extracts all fourteen with the script in its Step 1. The embed URL stored in `video_url` is `https://player.vimeo.com/video/<id>?h=<hash>`. The clips are embedded through Vimeo's player, never downloaded or re-hosted, and `video_credit` names 416 Physio with the article URL.

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `docs/achilles-exercise-review.md` | The review: every candidate rated, ruled, and recommended. The gate | 1 |
| `supabase/migrations/0006_programs_weekly.sql` | `exercises.video_credit`, `template_phases.position`, `program_phases.block`, `template_exercises.override_rule` and `override_reason` | 2 |
| `scripts/data/achilles/types.ts` | Seed data shapes | 2 |
| `scripts/data/achilles/sources.ts` | Citations with kind and quality grade | 2 |
| `scripts/data/achilles/program.ts` | The recovery program and its 11 phases, from the handout | 2 |
| `scripts/data/achilles/equipment.ts` | Display names for `equipment_item` values | 2 |
| `scripts/data/achilles/__tests__/program.test.ts` | Phases match the handout; committed files carry no patient detail | 2 |
| `scripts/data/achilles/exercises.ts` | The approved exercises with authoring inputs, alternates, clips | 3 |
| `scripts/data/achilles/templates.ts` | The approved templates: exercises in order with dose, cue, overrides, phases | 3 |
| `scripts/data/achilles/__tests__/exercises.test.ts` | Integrity and the authoring rules over the approved set | 3 |
| `scripts/data/achilles/personal.example.json` | Shape of the personal file, placeholder values | 4 |
| `scripts/data/achilles/personal.local.json` | The real personal data, gitignored | 4 |
| `scripts/seed-achilles.ts` | The seed | 5 |
| `scripts/lib/env.ts` | A second env loader for the Achilles seed | 5 |
| `CLAUDE.md`, `README.md`, `.gitignore`, `package.json` | Wiring and docs | 4, 5, 6 |

---

### Task 1: The exercise review document (gate)

**Files:**
- Create: `docs/achilles-exercise-review.md`

This task is analysis, not code, and it runs the real rule engine rather than eyeballing. Its output is a document the user approves before Task 3 writes any exercise data.

- [ ] **Step 1: Build the candidate list**

Two sources of candidates, in this precedence:

1. The 14 exercises in `/Users/quitefrank/Claude/Personal/raw/achilles/08-416PHYSIO-WALKING-BOOT.md`. These anchor the templates and each carries a clip. Keep the article's names, doses and cues.
2. The prototype's 22 exercises, read from the four arrays in `achilles-recovery-program.html`. These fill what the article does not cover (the article has no calf work, no pulling beyond a banded row, no hanging). Keep the name, dose string, cue and alternates verbatim. The sound-leg calf raise stays in regardless: `04` makes cross-education the highest-value item and the article has nothing for it.

Also read: `01-CLAUDE-CODE-STARTER.md` (the hard-won rules, the gym inventory, the mistakes), `04-EVIDENCE-BASE.md` section "Training During Immobilisation", `06-CONDITIONING-AND-TRAINING.md` blocks A to C and the equipment section, and `05-SOURCE-DOCUMENTS.md` for what the handout permits in weeks 2 to 6 (protected weight-bearing in the boot at the cleared percentage; knee and hip work with no ankle involvement).

- [ ] **Step 2: Rate every candidate**

For each candidate, decide the six authoring inputs and the two caps, as a plain object matching `AuthoringExercise` in `src/lib/recovery/types.ts`: `supportRequired`, `loadDirection`, `loadsBootedFoot`, `ankleInvolvement`, `floorTransferRequired`, `equipmentNeeded` (from the `EquipmentItem` union), `minHoursBetweenSessions`, `maxSessionsPerWeek`. The pull-ups cap is 72 hours and 2 per week, from the brief. Everything else has null caps.

Map each candidate to an existing library slug where one fits, using this query against the linked project (service key from `.env.local` into a shell variable, never echoed):

```bash
SERVICE=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | cut -d= -f2)
curl -s "https://ziwnpuiudaaadaacazwc.supabase.co/rest/v1/exercises?select=slug,name,muscle_group_id,equipment_type&order=slug" \
  -H "apikey: $SERVICE" -H "Authorization: Bearer $SERVICE" > /tmp/library.json
```

A match means the same movement at the same station ("Seated cable row" is `cable-seated-row`; "Pull-ups" is `pull-ups`; "Seated dumbbell curl" is `db-curls`; the article's "Shoulder Press" seated with dumbbells is `db-shoulder-press`). Where an item is a variant the library lacks (sound-leg single-leg calf raise, seated suitcase hold, straight leg raise with a walking boot), it is a new exercise with a new slug computed by `exerciseSlug` from `scripts/lib/exercise-name.ts`. Article exercises get their own rows even when a near match exists if the movement differs in the boot (a supine triceps extension with the boot on a chair is not the library's standing pressdown).

- [ ] **Step 3: Run the rules**

Write a scratch script in the scratchpad that imports `checkExercise` and `checkSpacing` from `src/lib/recovery/authoring.ts` and runs every candidate under two states:

```ts
const NOW = { clearedLoadPct: 75, ankleRomCleared: false, bootStatus: "on", wedgesRemoved: 0, strengthGate: null, currentPhaseId: null, daysSinceLastClearance: 1, isStale: false };
const WEANING = { ...NOW, clearedLoadPct: 100, bootStatus: "weaning" };
```

with `equipmentAvailable` set to the building gym plus home kit: `["cable_tower","dumbbells","adjustable_bench","half_rack","plate_tree","mat","medicine_ball","stability_ball","treadmill","elliptical","stepper","spin_bike","upright_bike","pull_up_bar","resistance_band","hanging_ab_straps","bathroom_scale"]`. Position 1 for floor-transfer items, position 3 otherwise, so rule 8 shows what it would say mid-template.

Record every verdict.

- [ ] **Step 4: Write the document**

`docs/achilles-exercise-review.md` with this structure, no patient detail anywhere in it:

```markdown
# Achilles exercise review

Purpose, precedence (article first, prototype fills gaps), sources consulted by file number (no quotes from 02), the restriction state used, the equipment list used.

## How to read a verdict
One paragraph: blocked, warn, ok, the rule numbers (spec section 6), and what an override means: the exercise stays in, the row records which rule it overrides and why, and the reason is the handout's own allowance for protected weight-bearing in the boot.

## 416 Physio exercises (14)
One table. Columns:
name | clip | library slug or NEW | support | load | booted foot | ankle | floor | equipment | verdict now | verdict weaning | keep / override / drop | why (one line)
Expected: glute bridge and ball wall squat trip rule 1 (booted foot) and are kept with an override; the standing banded row trips rule 3 and is kept as the SEATED variant instead (the article offers both); the bike with the booted foot pedalling is dropped until phase 6 and kept as the one-leg variant; SkiErg is not in the gym; pool is a surgeon question, not a template item.

## Prototype exercises (22)
One table per workout (Pull, Sound Leg, Push, Pull light), same columns plus a candidate demo URL column. Mark which ones the article already covers (so they drop or become alternates) and which fill gaps (calf raises, pull-ups, cable rows, hanging knee raise).

## Proposed templates
The templates as they would be seeded, exercises in order, with dose, cue, clip where one exists, and any override. Floor work first. For each template: which program phases it is valid in (by phase position in 05; boot-on templates are valid in phases 1 to 7). A spacing note on any two templates that share pull-ups.
The recovery programme is its own Push / Pull / Legs, separate from any training programme the user runs after recovery. Recommended shape, to be confirmed by the numbers above: Recovery Push (the article's shoulder press, supine triceps extension, modified push-ups, plus the prototype's seated bench or floor press, seated fly, seated lateral raise, seated suitcase hold), Recovery Pull (the article's banded row, seated, plus pull-ups, seated cable row, seated face pull, curls, hanging knee raise), Recovery Legs (the article's leg and core section in the boot, straight leg raise, side-lying abduction, banded knee extension, bridge, ball wall squat, sit-to-stand, supine march, front plank, plus the sound-leg calf raises standing and seated). Article exercises first in each template, prototype exercises fill the gaps. Floor work first within each template. The pull-up cap (72 hours, twice a week) sets how often Recovery Pull can run; say so in the template notes. Adjust if the rules or the cross-education argument say otherwise, and say why.

## Alternative programme structures
Two or three options argued from 06 blocks A to C and 04 cross-education, each labelled by evidence strength: a seated upper-body cardio circuit (06 block A), a home template for pull-up bar, bands and the article's floor work, a three-day rotation for weeks where the gym is not reachable. Recommendation, one line.

## Open items for the user
Anything the reviewer could not decide: candidates that need a surgeon question (pool, isometrics), equipment assumptions to confirm, whether the clips should also be attached to the library's near matches.
```

- [ ] **Step 5: Check the document for leaks and dashes**

Run: `grep -nE "2026-|ultrasound|surgeon|clinic|Mount|\bleft\b|\bright\b" docs/achilles-exercise-review.md`
Expected: no output. If "right" appears in a phrase like "the right approach", reword it. "surgeon question" is allowed once in the open items if phrased as "a question for the treating clinician"; use that wording instead so the grep stays clean.

Run: `grep -c "—" docs/achilles-exercise-review.md`
Expected: 0.

- [ ] **Step 6: Commit and stop for approval**

```bash
git add docs/achilles-exercise-review.md
git commit -m "docs: Achilles exercise review for approval" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

Then present the document to the user. Tasks 3 to 6 wait for approval. Task 2 does not.

---

### Task 2: Migration 0006, seed types, sources, program and equipment

**Files:**
- Create: `supabase/migrations/0006_programs_weekly.sql`
- Create: `scripts/data/achilles/types.ts`
- Create: `scripts/data/achilles/sources.ts`
- Create: `scripts/data/achilles/program.ts`
- Create: `scripts/data/achilles/equipment.ts`
- Test: `scripts/data/achilles/__tests__/program.test.ts`
- Modify: `scripts/__tests__/migrations.test.ts` (the migration list)

- [ ] **Step 1: Migration**

```sql
-- Additions for demonstration clips, weekly programme phases, template
-- ordering inside a phase, and recorded rule overrides.
--
-- video_credit     who owns a demonstration clip and where it came from,
--                  shown next to the embed
-- block            groups one-week phases of a training programme
--                  ("Base Hypertrophy"); null for the recovery program
-- position         the order of templates inside a phase, so the app can
--                  say which day comes next without the user choosing
-- override_rule    the authoring rule (spec section 6) a template row
--                  knowingly breaks, with the reason; null when none

alter table exercises
  add column video_credit text;

alter table program_phases
  add column block text;

alter table template_phases
  add column position integer;

alter table template_exercises
  add column override_rule integer
    check (override_rule is null or override_rule between 1 and 11),
  add column override_reason text,
  add constraint template_exercises_override_pair
    check ((override_rule is null) = (override_reason is null));
```

Add `"0006_programs_weekly.sql"` to the expected list in `scripts/__tests__/migrations.test.ts` and add one test there:

```ts
it("override rule and reason travel together", async () => {
  // insert a template and an exercise as service, then:
  await expect(
    pg.query(`insert into template_exercises (template_id, exercise_id, position, override_rule) values ($1, $2, 1, 1)`, [templateId, exerciseId]),
  ).rejects.toThrow(/template_exercises_override_pair/);
});
```

(Reuse the fixture helpers already in that file for creating the template and exercise.)

Run: `bun run test scripts/__tests__/migrations.test.ts`. Expected: PASS, 8 tests.

Push: `supabase db push --yes`. Expected: 0006 applied. Then `bun run db:types` and commit the regenerated `src/lib/supabase/database.types.ts`.

- [ ] **Step 2: Types**

```ts
/**
 * Shapes for the committed Achilles seed data. Everything here is
 * generic protocol and library content. Per-user rows have their own
 * shape in personal.example.json.
 */

import type {
  EquipmentItem,
  LoadDirection,
  SupportType,
} from "../../../src/lib/recovery/types";

export type SourceKind =
  | "trial"
  | "review"
  | "cohort"
  | "handout"
  | "convention"
  | "anecdote";

export type SourceSeed = {
  /** Stable key other seed rows reference. */
  key: string;
  citation: string;
  url: string | null;
  kind: SourceKind;
  quality: string;
  notes: string | null;
};

export type GuidanceGroup = { heading: string; items: string[] };

export type PhaseSeed = {
  position: number;
  label: string;
  block: string | null;
  weekFrom: number;
  weekTo: number | null;
  loadPct: number | null;
  gate: string | null;
  guidance: GuidanceGroup[];
  flag: string | null;
  flagSourceKey: string | null;
};

export type ProgramSeed = {
  name: string;
  kind: "recovery" | "training";
  description: string;
  citation: string | null;
  authorityNotes: string | null;
  sourceKey: string | null;
  phases: PhaseSeed[];
};

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "cardio_machine"
  | "other";

export type AlternateSeed = {
  /** Slug of the alternate exercise. */
  slug: string;
  position: 1 | 2;
  notes: string;
};

export type ExerciseSeed = {
  name: string;
  /** Computed by exerciseSlug unless a library row is being matched by an explicit slug. */
  slug: string;
  muscleGroup: string | null;
  equipmentType: EquipmentType;
  notes: string | null;
  /** Embed URL. For the 416 Physio clips: https://player.vimeo.com/video/<id>?h=<hash> */
  videoUrl: string | null;
  /** ISO datetime the clip was checked (oEmbed title matched, player loaded). Null means unverified and the URL is not written. */
  videoVerifiedAt: string | null;
  /** Attribution shown next to the embed, e.g. "416 Physio, What exercises can you do with a walking boot" plus the article URL. */
  videoCredit: string | null;
  supportRequired: SupportType;
  loadDirection: LoadDirection;
  loadsBootedFoot: boolean;
  ankleInvolvement: boolean;
  floorTransferRequired: boolean;
  equipmentNeeded: EquipmentItem[];
  minHoursBetweenSessions: number | null;
  maxSessionsPerWeek: number | null;
  alternates: AlternateSeed[];
};

export type OverrideSeed = {
  /** Rule number from the design spec, section 6. */
  rule: number;
  reason: string;
};

export type TemplateExerciseSeed = {
  slug: string;
  /** A parseDose string: "3 x 10-12", "4 x RIR 1-2", "3 x 20-40 sec each side". */
  dose: string;
  cue: string | null;
  /** Present only when the row knowingly breaks a rule. */
  override: OverrideSeed | null;
};

export type TemplateSeed = {
  name: string;
  category: "push" | "pull" | "legs" | "arms" | "full_body" | "cardio" | "abs";
  variant: string | null;
  notes: string;
  /** How this template is spaced from others sharing a capped exercise. */
  spacingNote: string | null;
  /** Program phase positions this template is valid in, in the order it sits inside each phase. */
  phases: number[];
  exercises: TemplateExerciseSeed[];
};
```

- [ ] **Step 3: Sources**

`sources.ts` exports `SOURCES: SourceSeed[]`. One entry per citation in `04-EVIDENCE-BASE.md` "Full Citation List" and `06-CONDITIONING-AND-TRAINING.md` (Hullfish, Thomas, Waters, Orr, Hyer, Bentzen, Christensen, Mujika, Heidorn, Hoeffner, Seow, Pedersen, Zellers, Willits and the rest listed there), plus the handout (`kind: "handout"`, key `handout`), plus the 416 Physio article (key `physio416`, `kind: "convention"`, quality "clinician-authored blog, not peer-reviewed, generic walking-boot audience", url the article). `quality` is the grade as written in those files. No patient detail in `notes`.

- [ ] **Step 4: Program**

`program.ts` exports `RECOVERY_PROGRAM: ProgramSeed`. Name: "Achilles rupture, accelerated functional rehabilitation (non-operative, modified Willits)". Kind recovery. Description one paragraph from `05` page 2's closing note. Citation: the Willits reference verbatim. Authority notes: "The treating clinician governs over the handout; the handout governs over the appendix; the appendix over the wider literature. No dose is imported from another protocol." `sourceKey: "handout"`. `block: null` on every phase.

Eleven phases, positions 1 to 11, weeks exactly as printed in `05` (NOT the shifted weeks in the prototype):

| pos | label | weekFrom | weekTo | loadPct | gate |
|---|---|---|---|---|---|
| 1 | Non-weight-bearing | 0 | 2 | 0 | null |
| 2 | 25% weight-bearing | 2 | 3 | 25 | null |
| 3 | 50% weight-bearing | 3 | 4 | 50 | null |
| 4 | 75% weight-bearing | 4 | 5 | 75 | null |
| 5 | 100% weight-bearing | 5 | 6 | 100 | null |
| 6 | Wedges out in stages | 6 | 8 | 100 | null |
| 7 | Boot weaning, the vulnerable window | 8 | 12 | 100 | null |
| 8 | Strength, power, endurance | 12 | 16 | null | null |
| 9 | Dynamic loading and sport-specific | 16 | 26 | null | null |
| 10 | Month 6 to 9, non-contact sport | 26 | 52 | null | "80% strength" |
| 11 | Month 12, running and jumping | 52 | null | null | "100% strength" |

Guidance per phase: groups "Boot", "Do", "Do not" with the handout's wording (from `05`) and the prototype's `boot`/`dos`/`dont` arrays where they add operational detail, rewritten side-neutral ("the injured foot"). Flags: the generic sentence of each prototype `flag`, with `flagSourceKey` pointing at the supporting citation (DVT figures to Pedersen, re-rupture clustering to the handout, the calf deficit to Hoeffner). Personal sentences from the prototype flags (an unanswered question, an imaging finding) are NOT here; they become reminders in the personal file (Task 4).

- [ ] **Step 5: Equipment**

`equipment.ts` exports `EQUIPMENT_LABELS: Record<EquipmentItem, string>` with a display name for all 26 values.

- [ ] **Step 6: Tests**

`scripts/data/achilles/__tests__/program.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RECOVERY_PROGRAM } from "../program";
import { SOURCES } from "../sources";
import { EQUIPMENT_LABELS } from "../equipment";

const HANDOUT_LADDER: [number, number, number][] = [
  [0, 2, 0], [2, 3, 25], [3, 4, 50], [4, 5, 75], [5, 6, 100], [6, 8, 100], [8, 12, 100],
];

describe("recovery program phases", () => {
  it("has eleven phases in order with contiguous weeks", () => {
    const p = RECOVERY_PROGRAM.phases;
    expect(p).toHaveLength(11);
    p.forEach((ph, i) => {
      expect(ph.position).toBe(i + 1);
      if (i > 0) expect(ph.weekFrom).toBe(p[i - 1].weekTo);
    });
    expect(p[10].weekTo).toBeNull();
  });

  it("matches the handout's weight-bearing ladder as printed", () => {
    HANDOUT_LADDER.forEach(([from, to, pct], i) => {
      expect(RECOVERY_PROGRAM.phases[i].weekFrom).toBe(from);
      expect(RECOVERY_PROGRAM.phases[i].weekTo).toBe(to);
      expect(RECOVERY_PROGRAM.phases[i].loadPct).toBe(pct);
    });
  });

  it("carries the two strength gates", () => {
    expect(RECOVERY_PROGRAM.phases[9].gate).toBe("80% strength");
    expect(RECOVERY_PROGRAM.phases[10].gate).toBe("100% strength");
  });

  it("points every flag source at a real source key", () => {
    const keys = new Set(SOURCES.map((s) => s.key));
    for (const ph of RECOVERY_PROGRAM.phases) {
      if (ph.flagSourceKey !== null) expect(keys.has(ph.flagSourceKey)).toBe(true);
    }
    expect(keys.has(RECOVERY_PROGRAM.sourceKey ?? "")).toBe(true);
    expect(keys.has("physio416")).toBe(true);
  });

  it("has unique source keys and citations", () => {
    const keys = SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    const cites = SOURCES.map((s) => s.citation);
    expect(new Set(cites).size).toBe(cites.length);
  });

  it("labels every equipment item", () => {
    expect(Object.keys(EQUIPMENT_LABELS)).toHaveLength(26);
  });
});

describe("committed seed data carries no patient detail", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  const tsFiles = readdirSync(dir).filter((f) => f.endsWith(".ts"));

  it("has no 2026 dates, no imaging words, no side words in the TypeScript data", () => {
    for (const f of tsFiles) {
      const text = readFileSync(dir + f, "utf8");
      expect(text, f).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(text, f).not.toMatch(/ultrasound|tendinosis|thromboprophylaxis/i);
      expect(text, f).not.toMatch(/\b(left|right)\b/i);
    }
  });

  it("keeps the personal example on placeholder dates", () => {
    const text = readFileSync(dir + "personal.example.json", "utf8");
    expect(text).not.toMatch(/\b202\d-\d\d-\d\d\b/);
  });
});
```

The side-word test forbids "left" and "right" as whole words in the TypeScript data, so guidance text says "the injured foot" and never names a side. The `personal.example.json` test is written now and passes once Task 4 creates the file; until then it fails, which is acceptable only if Task 4 runs in the same session. If not, guard it with `existsSync` and skip.

Run: `bun run test scripts/data/achilles/__tests__/program.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0006_programs_weekly.sql scripts/__tests__/migrations.test.ts src/lib/supabase/database.types.ts scripts/data/achilles
git commit -m "feat(seed): migration 0006, recovery program, phases, sources and equipment data" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Exercises and templates from the approved review

**Blocked until the user approves `docs/achilles-exercise-review.md`.**

**Files:**
- Create: `scripts/data/achilles/exercises.ts`
- Create: `scripts/data/achilles/templates.ts`
- Test: `scripts/data/achilles/__tests__/exercises.test.ts`

- [ ] **Step 1: Extract and verify the fourteen clips**

Scratch script: fetch the article HTML with curl, extract every `player.vimeo.com/video/<id>?h=<hash>` in document order (they follow the article's exercise order), and for each call `https://vimeo.com/api/oembed.json?url=https://vimeo.com/<id>/<hash>` and record the title and the fetch time. The title must name the movement (for example "Bridge in a walking boot" for Glute Bridges; "shoulder press.mp4" is acceptable for Shoulder Press). Set `videoVerifiedAt` to the fetch time and `videoUrl` to `https://player.vimeo.com/video/<id>?h=<hash>`. `videoCredit`: "416 Physio, What Exercises Can You Do With a Walking Boot, https://www.416physio.ca/blog/what-exercises-can-you-do-with-a-walking-boot".

For prototype exercises without a clip: look for a demo URL (WebSearch), fetch it, and set `videoVerifiedAt` only when the page title names the movement; at most two attempts each, then leave it null.

- [ ] **Step 2: Write `exercises.ts`**

`export const EXERCISES: ExerciseSeed[]`, one entry per approved exercise, values copied from the approved review tables. Slugs: an existing library slug where the review matched one; otherwise `exerciseSlug(name, null)`. `muscleGroup` uses the seeded names exactly: Abs, Biceps, Chest, Glutes, Back, Shoulders, Hamstrings, Calves, Quadriceps, Triceps, Stretches, Cardio. Alternates reference slugs that exist either in this file or in the library.

Worked example (values are the review's, not to be copied without checking):

```ts
{
  name: "Glute bridge in a walking boot",
  slug: "glute-bridge-in-a-walking-boot",
  muscleGroup: "Glutes",
  equipmentType: "bodyweight",
  notes: "Push through both heels; the booted heel takes only what the cleared percentage allows.",
  videoUrl: "https://player.vimeo.com/video/1117498689?h=<hash>",
  videoVerifiedAt: "<fetch time>",
  videoCredit: "416 Physio, What Exercises Can You Do With a Walking Boot, https://www.416physio.ca/blog/what-exercises-can-you-do-with-a-walking-boot",
  supportRequired: "lying",
  loadDirection: "vertical",
  loadsBootedFoot: true,
  ankleInvolvement: false,
  floorTransferRequired: true,
  equipmentNeeded: ["mat"],
  minHoursBetweenSessions: null,
  maxSessionsPerWeek: null,
  alternates: [],
},
```

- [ ] **Step 3: Write `templates.ts`**

`export const TEMPLATES: TemplateSeed[]`: the approved templates, exercises in the approved order, `dose` as a string `parseDose` accepts, `cue` from the article or prototype (second person is fine), `override` on any row the review marked as kept despite a rule (for example `{ rule: 1, reason: "Protected weight-bearing in the boot at the cleared percentage is what the handout permits in weeks 2 to 6; the bridge loads the heel through the boot with the ankle locked." }`), `phases` from the review, `spacingNote` on any two templates sharing pull-ups. Category from the movement.

- [ ] **Step 4: Tests**

`scripts/data/achilles/__tests__/exercises.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { EXERCISES } from "../exercises";
import { TEMPLATES } from "../templates";
import { RECOVERY_PROGRAM } from "../program";
import { parseDose } from "../../../../src/lib/recovery/dose";
import { checkExercise, checkSpacing } from "../../../../src/lib/recovery/authoring";
import type { AuthoringExercise, RestrictionState } from "../../../../src/lib/recovery/types";

const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

function toAuthoring(slug: string): AuthoringExercise {
  const e = bySlug.get(slug);
  if (!e) throw new Error(`template references unknown slug ${slug}`);
  return {
    id: e.slug,
    name: e.name,
    supportRequired: e.supportRequired,
    loadDirection: e.loadDirection,
    loadsBootedFoot: e.loadsBootedFoot,
    ankleInvolvement: e.ankleInvolvement,
    floorTransferRequired: e.floorTransferRequired,
    equipmentNeeded: e.equipmentNeeded,
    minHoursBetweenSessions: e.minHoursBetweenSessions,
    maxSessionsPerWeek: e.maxSessionsPerWeek,
  };
}

const BOOT_ON: RestrictionState = {
  clearedLoadPct: 50,
  ankleRomCleared: false,
  bootStatus: "on",
  wedgesRemoved: 0,
  strengthGate: null,
  currentPhaseId: null,
  daysSinceLastClearance: 1,
  isStale: false,
};

describe("exercise seed integrity", () => {
  it("has unique slugs", () => {
    const slugs = EXERCISES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("sets every authoring input on every exercise", () => {
    for (const e of EXERCISES) {
      expect(e.supportRequired, e.slug).toBeTruthy();
      expect(e.loadDirection, e.slug).toBeTruthy();
      expect(typeof e.loadsBootedFoot, e.slug).toBe("boolean");
      expect(typeof e.ankleInvolvement, e.slug).toBe("boolean");
      expect(typeof e.floorTransferRequired, e.slug).toBe("boolean");
      expect(Array.isArray(e.equipmentNeeded), e.slug).toBe(true);
    }
  });

  it("writes a video URL only when it was verified, and credits every clip", () => {
    for (const e of EXERCISES) {
      if (e.videoVerifiedAt !== null) {
        expect(e.videoUrl, e.slug).toBeTruthy();
        expect(e.videoCredit, e.slug).toBeTruthy();
      }
    }
  });

  it("attaches all fourteen 416 Physio clips", () => {
    const clips = EXERCISES.filter((e) => e.videoUrl?.includes("player.vimeo.com") && e.videoVerifiedAt);
    expect(clips).toHaveLength(14);
    for (const e of clips) expect(e.videoUrl).toMatch(/^https:\/\/player\.vimeo\.com\/video\/\d+\?h=[0-9a-f]+$/);
  });

  it("caps pull-ups at 72 hours and twice a week", () => {
    const p = bySlug.get("pull-ups");
    expect(p?.minHoursBetweenSessions).toBe(72);
    expect(p?.maxSessionsPerWeek).toBe(2);
  });
});

describe("template seed integrity", () => {
  it("every template exercise resolves and every dose parses to exactly one prescription", () => {
    for (const t of TEMPLATES) {
      for (const te of t.exercises) {
        expect(bySlug.has(te.slug), `${t.name}: ${te.slug}`).toBe(true);
        const d = parseDose(te.dose);
        expect(d, `${t.name}: ${te.dose}`).not.toBeNull();
        const kinds = [d!.reps, d!.rir, d!.seconds].filter((x) => x !== null).length;
        expect(kinds, `${t.name}: ${te.dose}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("names only phases that exist", () => {
    const positions = new Set(RECOVERY_PROGRAM.phases.map((p) => p.position));
    for (const t of TEMPLATES) for (const ph of t.phases) expect(positions.has(ph), t.name).toBe(true);
  });

  it("blocks nothing with the boot on unless the row records an override for that rule, and keeps floor work first", () => {
    for (const t of TEMPLATES) {
      t.exercises.forEach((te, i) => {
        const verdicts = checkExercise(toAuthoring(te.slug), BOOT_ON, null, i + 1);
        for (const v of verdicts) {
          if (v.level === "blocked") {
            expect(te.override?.rule, `${t.name} #${i + 1} ${te.slug}: ${v.reason}`).toBe(v.rule);
            expect(te.override?.reason.length ?? 0, `${t.name} #${i + 1}`).toBeGreaterThan(20);
          }
          expect(v.rule, `${t.name} #${i + 1}: ${v.reason}`).not.toBe(8);
        }
        if (te.override) {
          const rules = verdicts.map((v) => v.rule);
          expect(rules, `${t.name} #${i + 1} overrides rule ${te.override.rule} but it never fired`).toContain(te.override.rule);
        }
      });
    }
  });

  it("spaces the templates that share a capped exercise", () => {
    const v = checkSpacing(
      TEMPLATES.map((t) => ({ name: t.name, spacingNote: t.spacingNote, exercises: t.exercises.map((te) => toAuthoring(te.slug)) })),
    );
    expect(v).toEqual([]);
  });
});
```

Run the file; expected PASS. An override that names a rule which never fired fails the test on purpose: overrides record real conflicts, not precautions.

- [ ] **Step 5: Commit**

```bash
git add scripts/data/achilles
git commit -m "feat(seed): approved Achilles exercises and templates with 416 Physio clips" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: The personal file

**Files:**
- Create: `scripts/data/achilles/personal.example.json` (committed)
- Create: `scripts/data/achilles/personal.local.json` (gitignored, real values)
- Modify: `.gitignore`

- [ ] **Step 1: Gitignore first**

Add to `.gitignore` under the seed section:

```
# per-user Achilles seed data; only the .example is committed
/scripts/data/achilles/personal.local.json
/scripts/seed-achilles-report.json
```

Commit this alone before writing the real file:

```bash
git add .gitignore
git commit -m "chore: ignore the personal Achilles seed file and its report" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: The example**

`personal.example.json`, dates in the year 2000, placeholder text:

```json
{
  "recovery": {
    "programName": "Achilles rupture, accelerated functional rehabilitation (non-operative, modified Willits)",
    "label": "Achilles recovery",
    "side": "left",
    "injuryDate": "2000-01-01",
    "notes": null
  },
  "clearances": [
    { "effectiveFrom": "2000-01-01", "kind": "weight_bearing", "valuePct": 0, "valueText": null, "phasePosition": 1, "source": "clinic", "note": "Boot fitted" },
    { "effectiveFrom": "2000-01-15", "kind": "weight_bearing", "valuePct": 25, "valueText": null, "phasePosition": 2, "source": "clinic", "note": null }
  ],
  "events": [
    { "date": "2000-02-01", "kind": "appointment", "label": "Clinic appointment", "note": null, "questions": ["Wedge removal timing", "Physio referral"] },
    { "date": "2000-12-31", "kind": "reminder", "label": "Reminder attached to a phase", "note": "A personal note that belongs with a phase but not in the shared program text", "questions": [] }
  ],
  "rules": [
    { "position": 1, "kind": "prohibition", "title": "Ankle range of motion is on hold", "detail": "Permitted by the handout from week 2; not yet cleared by the treating clinician, whose call governs.", "active": true },
    { "position": 2, "kind": "rule", "title": "Boot on at all times, including sleep", "detail": "Straps snug, air cells deflated.", "active": true }
  ],
  "equipmentAvailable": ["cable_tower", "dumbbells", "adjustable_bench", "half_rack", "mat", "pull_up_bar", "resistance_band"]
}
```

- [ ] **Step 3: The real file**

Write `personal.local.json` from the sources in the vault (`02-CASE-FILE.md`, the prototype's `CLEARED`, `EVENTS` and rules disclosure, and the personal sentences of the prototype's phase flags as `reminder` events dated at the phase's reference start computed from the injury date with `addDays` from `src/lib/recovery/dates.ts`). Every clearance carries the phase position it enters. The equipment list is the building gym plus the home kit from `02`.

Run: `git status --short` and confirm `personal.local.json` is NOT listed.

- [ ] **Step 4: Commit the example**

```bash
git add scripts/data/achilles/personal.example.json
git commit -m "feat(seed): personal Achilles seed file shape" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: `scripts/seed-achilles.ts`

**Files:**
- Create: `scripts/seed-achilles.ts`
- Modify: `scripts/lib/env.ts` (add `loadAchillesSeedEnv`)
- Modify: `package.json` (`"seed:achilles": "bun run scripts/seed-achilles.ts"`)

- [ ] **Step 1: Env loader**

Append to `scripts/lib/env.ts`:

```ts
type AchillesKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "SEED_USER_ID";

const ACHILLES_KEYS: AchillesKey[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SEED_USER_ID",
];

export type AchillesSeedEnv = Record<AchillesKey, string>;

/** The Achilles seed needs Supabase and the user id, never Notion. */
export function loadAchillesSeedEnv(): AchillesSeedEnv {
  const missing: string[] = [];
  const env: Partial<AchillesSeedEnv> = {};
  for (const key of ACHILLES_KEYS) {
    const value = process.env[key];
    if (!value) missing.push(key);
    else env[key] = value;
  }
  if (missing.length > 0) {
    console.error("Missing required env vars:");
    for (const k of missing) console.error(`  - ${k}`);
    process.exit(1);
  }
  return env as AchillesSeedEnv;
}
```

- [ ] **Step 2: The script**

```ts
/**
 * Seed the Achilles material into Supabase.
 *
 * Committed data (scripts/data/achilles/*.ts): sources, the recovery
 * program and phases, exercises with authoring inputs and clips,
 * templates. Personal data (scripts/data/achilles/personal.local.json,
 * gitignored): the recovery row, clearances, events, rules, equipment.
 *
 * Run after the Notion seed:
 *   bun run seed:achilles
 *
 * Idempotent. Exercises match the library by slug; templates,
 * template_exercises and template_phases are keyed by synthetic ids
 * prefixed "achilles:" and are cleared and rewritten each run.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadAchillesSeedEnv } from "./lib/env";
import { parseDose } from "../src/lib/recovery/dose";
import { SOURCES } from "./data/achilles/sources";
import { RECOVERY_PROGRAM } from "./data/achilles/program";
import { EXERCISES } from "./data/achilles/exercises";
import { TEMPLATES } from "./data/achilles/templates";
import type { EquipmentItem } from "../src/lib/recovery/types";

type Personal = {
  recovery: { programName: string; label: string; side: "left" | "right"; injuryDate: string; notes: string | null };
  clearances: { effectiveFrom: string; kind: string; valuePct: number | null; valueText: string | null; phasePosition: number | null; source: string; note: string | null }[];
  events: { date: string; kind: string; label: string; note: string | null; questions: string[] }[];
  rules: { position: number; kind: string; title: string; detail: string | null; active: boolean }[];
  equipmentAvailable: EquipmentItem[];
};

type Report = {
  rowCounts: Record<string, number>;
  exerciseMatches: { slug: string; action: "updated" | "inserted" }[];
  alternateMisses: { exercise: string; alternate: string }[];
  unverifiedVideos: string[];
  rejectedDoses: { template: string; slug: string; dose: string }[];
  overrides: { template: string; slug: string; rule: number }[];
  clearancesInserted: number;
  clearancesAlreadyPresent: number;
};

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const env = loadAchillesSeedEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const personalPath = fileURLToPath(new URL("./data/achilles/personal.local.json", import.meta.url));
  const personal = JSON.parse(readFileSync(personalPath, "utf8")) as Personal;

  const report: Report = {
    rowCounts: {},
    exerciseMatches: [],
    alternateMisses: [],
    unverifiedVideos: [],
    rejectedDoses: [],
    overrides: [],
    clearancesInserted: 0,
    clearancesAlreadyPresent: 0,
  };

  // 0. Refuse to run on an empty library.
  const { count: mgCount } = await sb.from("muscle_groups").select("*", { count: "exact", head: true });
  if (!mgCount) fail("muscle_groups is empty. Run the Notion seed first.");
  const { data: mgRows } = await sb.from("muscle_groups").select("id,name");
  const muscleGroupId = new Map((mgRows ?? []).map((r) => [r.name as string, r.id as string]));

  // 1. Sources.
  console.log("\n[1/7] sources");
  const sourceId = new Map<string, string>();
  for (const s of SOURCES) {
    const { data, error } = await sb
      .from("sources")
      .upsert({ citation: s.citation, url: s.url, kind: s.kind, quality: s.quality, notes: s.notes }, { onConflict: "citation" })
      .select("id")
      .single();
    if (error) fail(`source upsert failed (${s.key}): ${error.message}`);
    sourceId.set(s.key, data.id);
  }
  console.log(`  ${sourceId.size} sources`);

  // 2. Program and phases.
  console.log("\n[2/7] program and phases");
  const p = RECOVERY_PROGRAM;
  const { data: prog, error: progErr } = await sb
    .from("programs")
    .upsert(
      {
        name: p.name,
        kind: p.kind,
        description: p.description,
        citation: p.citation,
        authority_notes: p.authorityNotes,
        source_id: p.sourceKey ? (sourceId.get(p.sourceKey) ?? null) : null,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();
  if (progErr) fail(`program upsert failed: ${progErr.message}`);
  const programId = prog.id as string;
  const phaseIdByPosition = new Map<number, string>();
  for (const ph of p.phases) {
    const { data, error } = await sb
      .from("program_phases")
      .upsert(
        {
          program_id: programId,
          position: ph.position,
          label: ph.label,
          block: ph.block,
          week_from: ph.weekFrom,
          week_to: ph.weekTo,
          load_pct: ph.loadPct,
          gate: ph.gate,
          guidance: ph.guidance,
          flag: ph.flag,
          flag_source_id: ph.flagSourceKey ? (sourceId.get(ph.flagSourceKey) ?? null) : null,
        },
        { onConflict: "program_id,position" },
      )
      .select("id")
      .single();
    if (error) fail(`phase upsert failed (${ph.label}): ${error.message}`);
    phaseIdByPosition.set(ph.position, data.id);
  }
  console.log(`  ${phaseIdByPosition.size} phases`);

  // 3. Exercises: match by slug, update authoring inputs, insert the rest.
  console.log("\n[3/7] exercises");
  const exerciseId = new Map<string, string>();
  for (const e of EXERCISES) {
    const { data: existing } = await sb.from("exercises").select("id").eq("slug", e.slug).maybeSingle();
    const authoring = {
      support_required: e.supportRequired,
      load_direction: e.loadDirection,
      loads_booted_foot: e.loadsBootedFoot,
      ankle_involvement: e.ankleInvolvement,
      floor_transfer_required: e.floorTransferRequired,
      equipment_needed: e.equipmentNeeded,
      min_hours_between_sessions: e.minHoursBetweenSessions,
      max_sessions_per_week: e.maxSessionsPerWeek,
    };
    const video = e.videoVerifiedAt
      ? { video_url: e.videoUrl, video_verified_at: e.videoVerifiedAt, video_credit: e.videoCredit }
      : {};
    if (!e.videoVerifiedAt) report.unverifiedVideos.push(e.slug);
    if (existing) {
      const { error } = await sb.from("exercises").update({ ...authoring, ...video }).eq("id", existing.id);
      if (error) fail(`exercise update failed (${e.slug}): ${error.message}`);
      exerciseId.set(e.slug, existing.id);
      report.exerciseMatches.push({ slug: e.slug, action: "updated" });
    } else {
      const { data, error } = await sb
        .from("exercises")
        .insert({
          name: e.name,
          slug: e.slug,
          muscle_group_id: e.muscleGroup ? (muscleGroupId.get(e.muscleGroup) ?? null) : null,
          equipment_type: e.equipmentType,
          notes: e.notes,
          ...authoring,
          ...video,
        })
        .select("id")
        .single();
      if (error) fail(`exercise insert failed (${e.slug}): ${error.message}`);
      exerciseId.set(e.slug, data.id);
      report.exerciseMatches.push({ slug: e.slug, action: "inserted" });
    }
  }
  console.log(`  ${report.exerciseMatches.filter((m) => m.action === "updated").length} matched the library, ${report.exerciseMatches.filter((m) => m.action === "inserted").length} inserted`);

  // 4. Alternates.
  console.log("\n[4/7] alternates");
  let altCount = 0;
  for (const e of EXERCISES) {
    for (const a of e.alternates) {
      let altId = exerciseId.get(a.slug);
      if (!altId) {
        const { data } = await sb.from("exercises").select("id").eq("slug", a.slug).maybeSingle();
        altId = data?.id;
      }
      if (!altId) {
        report.alternateMisses.push({ exercise: e.slug, alternate: a.slug });
        continue;
      }
      const { error } = await sb
        .from("exercise_alternates")
        .upsert(
          { exercise_id: exerciseId.get(e.slug), alternate_exercise_id: altId, position: a.position, notes: a.notes },
          { onConflict: "exercise_id,position" },
        );
      if (error) fail(`alternate upsert failed (${e.slug} -> ${a.slug}): ${error.message}`);
      altCount++;
    }
  }
  console.log(`  ${altCount} alternates (${report.alternateMisses.length} missing)`);

  // 5. Templates: upsert, clear seed-owned rows, rewrite exercises and phases.
  console.log("\n[5/7] templates");
  let teCount = 0;
  for (const t of TEMPLATES) {
    const { data: tpl, error } = await sb
      .from("templates")
      .upsert(
        { name: t.name, category: t.category, variant: t.variant, notes: t.notes, program_id: programId, _notion_id: `achilles:${t.name}` },
        { onConflict: "_notion_id" },
      )
      .select("id")
      .single();
    if (error) fail(`template upsert failed (${t.name}): ${error.message}`);
    const templateId = tpl.id as string;

    const { error: clearErr } = await sb.from("template_exercises").delete().eq("template_id", templateId).like("_notion_id", "achilles:%");
    if (clearErr) fail(`template_exercises clear failed (${t.name}): ${clearErr.message}`);

    const rows = [];
    let pos = 1;
    for (const te of t.exercises) {
      const d = parseDose(te.dose);
      if (!d) {
        report.rejectedDoses.push({ template: t.name, slug: te.slug, dose: te.dose });
        continue;
      }
      const exId = exerciseId.get(te.slug);
      if (!exId) fail(`template ${t.name} references unknown exercise ${te.slug}`);
      if (te.override) report.overrides.push({ template: t.name, slug: te.slug, rule: te.override.rule });
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
        notes: [te.cue, d.modifier].filter(Boolean).join(" ") || null,
        override_rule: te.override?.rule ?? null,
        override_reason: te.override?.reason ?? null,
        _notion_id: `achilles:${t.name}:${pos}`,
      });
      pos++;
    }
    if (rows.length > 0) {
      const { error: insErr } = await sb.from("template_exercises").insert(rows);
      if (insErr) fail(`template_exercises insert failed (${t.name}): ${insErr.message}`);
      teCount += rows.length;
    }

    const { error: phClearErr } = await sb.from("template_phases").delete().eq("template_id", templateId);
    if (phClearErr) fail(`template_phases clear failed (${t.name}): ${phClearErr.message}`);
    const phaseRows = t.phases.map((pp, i) => ({ template_id: templateId, phase_id: phaseIdByPosition.get(pp), position: i + 1 }));
    if (phaseRows.length > 0) {
      const { error: phErr } = await sb.from("template_phases").insert(phaseRows);
      if (phErr) fail(`template_phases insert failed (${t.name}): ${phErr.message}`);
    }
  }
  console.log(`  ${TEMPLATES.length} templates, ${teCount} template_exercises, ${report.overrides.length} overrides recorded`);

  // 6. Personal rows.
  console.log("\n[6/7] personal rows");
  if (personal.recovery.programName !== p.name) fail("personal.local.json names a program that is not the seeded one");
  const { data: existingRec } = await sb
    .from("recoveries")
    .select("id")
    .eq("user_id", env.SEED_USER_ID)
    .eq("program_id", programId)
    .maybeSingle();
  let recoveryId: string;
  const recRow = {
    user_id: env.SEED_USER_ID,
    program_id: programId,
    label: personal.recovery.label,
    side: personal.recovery.side,
    injury_date: personal.recovery.injuryDate,
    notes: personal.recovery.notes,
  };
  if (existingRec) {
    const { error } = await sb.from("recoveries").update(recRow).eq("id", existingRec.id);
    if (error) fail(`recovery update failed: ${error.message}`);
    recoveryId = existingRec.id;
  } else {
    const { data, error } = await sb.from("recoveries").insert(recRow).select("id").single();
    if (error) fail(`recovery insert failed: ${error.message}`);
    recoveryId = data.id;
  }

  for (const c of personal.clearances) {
    const { data: dup } = await sb
      .from("clearances")
      .select("id")
      .eq("recovery_id", recoveryId)
      .eq("effective_from", c.effectiveFrom)
      .eq("kind", c.kind)
      .eq("source", c.source)
      .is("voided_at", null)
      .maybeSingle();
    if (dup) {
      report.clearancesAlreadyPresent++;
      continue;
    }
    const { error } = await sb.from("clearances").insert({
      recovery_id: recoveryId,
      effective_from: c.effectiveFrom,
      kind: c.kind,
      value_pct: c.valuePct,
      value_text: c.valueText,
      phase_id: c.phasePosition ? (phaseIdByPosition.get(c.phasePosition) ?? null) : null,
      source: c.source,
      note: c.note,
    });
    if (error) fail(`clearance insert failed (${c.effectiveFrom} ${c.kind}): ${error.message}`);
    report.clearancesInserted++;
  }

  for (const ev of personal.events) {
    const { data: dup } = await sb.from("events").select("id").eq("recovery_id", recoveryId).eq("date", ev.date).eq("label", ev.label).maybeSingle();
    const row = { recovery_id: recoveryId, date: ev.date, kind: ev.kind, label: ev.label, note: ev.note, questions: ev.questions };
    const { error } = dup ? await sb.from("events").update(row).eq("id", dup.id) : await sb.from("events").insert(row);
    if (error) fail(`event upsert failed (${ev.label}): ${error.message}`);
  }

  for (const r of personal.rules) {
    const { error } = await sb
      .from("rules")
      .upsert({ recovery_id: recoveryId, position: r.position, kind: r.kind, title: r.title, detail: r.detail, active: r.active }, { onConflict: "recovery_id,position" });
    if (error) fail(`rule upsert failed (${r.title}): ${error.message}`);
  }

  const { error: settingsErr } = await sb
    .from("user_settings")
    .upsert({ user_id: env.SEED_USER_ID, equipment_available: personal.equipmentAvailable }, { onConflict: "user_id" });
  if (settingsErr) fail(`user_settings upsert failed: ${settingsErr.message}`);
  console.log(`  recovery ${recoveryId.slice(0, 8)}, ${report.clearancesInserted} clearances inserted, ${report.clearancesAlreadyPresent} already present, ${personal.events.length} events, ${personal.rules.length} rules`);

  // 7. Report.
  console.log("\n[7/7] report");
  for (const t of ["sources", "programs", "program_phases", "exercises", "exercise_alternates", "templates", "template_exercises", "template_phases", "recoveries", "clearances", "events", "rules"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    report.rowCounts[t] = count ?? 0;
  }
  const reportPath = fileURLToPath(new URL("./seed-achilles-report.json", import.meta.url));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("  row counts:", report.rowCounts);
  console.log(`  unverified videos: ${report.unverifiedVideos.length}`);
  console.log(`  rejected doses: ${report.rejectedDoses.length}`);
  console.log(`  alternate misses: ${report.alternateMisses.length}`);
  console.log(`\nReport written to ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: package script**

Add `"seed:achilles": "bun run scripts/seed-achilles.ts"` to `package.json`.

- [ ] **Step 4: Verify without running**

`bunx tsc --noEmit`, `bun run lint`, `bun run test`: all clean.

- [ ] **Step 5: Commit**

```bash
git add scripts/seed-achilles.ts scripts/lib/env.ts package.json
git commit -m "feat(seed): Achilles seed script" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Run, verify, document

- [ ] **Step 1: Run twice**

`bun run seed:achilles` twice. Second run: identical row counts, `clearancesInserted` 0, `clearancesAlreadyPresent` equal to the number of clearances in the personal file.

- [ ] **Step 2: Verify through REST**

With the service key in a shell variable: the program row exists with 11 phases; each Achilles template has its expected exercise count in position order with `override_rule` set only where the review said; `recoveries` has one row for the seed user; `clearances` count matches the personal file; every exercise in `EXERCISES` has non-null authoring inputs in the database; the fourteen clip URLs are present with `video_credit`.

- [ ] **Step 3: Docs**

`CLAUDE.md`: under Commands add `bun run seed:achilles`; under a new "Achilles seed" section, four sentences: what it seeds, that the personal file is gitignored and where its shape lives, that exercises match the library by slug, that overrides record rule conflicts the user chose to keep. `README.md`: the same in the seed section. Spec: section 4.4 gains the override columns and `video_credit`; section 6 gains one paragraph on overrides; section 10 build map marks Plan 2 delivered.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/superpowers/specs/2026-09-14-achilles-recovery-design.md
git commit -m "docs: Achilles seed and overrides" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 5: Report to the user**

Row counts, the exercise match and insert lists, unverified videos, overrides recorded, and anything the review left open.

---

## Self-review notes

Spec coverage: section 7.1 (committed data) is Tasks 2 and 3; 7.2 (personal file) is Task 4; 7.3 (the script, its seven steps and its report) is Task 5; section 8 (review and video verification) is Task 1 and Task 3 step 1; section 9 seed-data integrity tests are Task 2 step 6 and Task 3 step 4. Two additions beyond the spec, both requested by the user on 2026-09-14: the 416 Physio article takes precedence and its clips are attached (Task 1 precedence, Task 3 step 1, `video_credit` in migration 0006); rule conflicts the user keeps are recorded as overrides (`override_rule` and `override_reason`, tested in Task 3 step 4 so an override must name a rule that actually fired).

Type consistency: `ExerciseSeed`, `TemplateSeed`, `PhaseSeed`, `SourceSeed`, `OverrideSeed` are defined in Task 2 and consumed by Tasks 3 and 5 with the same field names. `parseDose`, `checkExercise`, `checkSpacing`, `exerciseSlug` exist on `main` today.

The one gate: Task 3 onward waits for the user's approval of the review document from Task 1.
