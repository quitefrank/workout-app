# Schema and Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the recovery layer's schema (rename, dose columns, authoring attributes, programs, recovery tables), the pure domain modules with tests, and a live Supabase project seeded from Notion, so the content plan can seed the Achilles material on top.

**Architecture:** SQL migrations are the source of truth; `0001` is edited in place because nothing has ever been pushed. Domain rules live in `src/lib/recovery/` as pure TypeScript with no Supabase import, tested with value assertions. Infra (project creation, link, push, Notion seed, generated types) is the last task so every local change lands in one push.

**Tech Stack:** Supabase Postgres + CLI 2.98, bun 1.3, Vitest 4, TypeScript 5, ESLint 9 flat config.

**Spec:** `docs/superpowers/specs/2026-09-14-achilles-recovery-design.md`

**Ground rules for every task**

- No em dashes anywhere. Hyphens in ranges ("10-12") are fine.
- Every commit message ends with the trailer `Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>`. Pass it as a second `-m`.
- Run `bun run test` before every commit. The starting count is 63 passing tests across 3 files; the count only goes up.
- There is no local Postgres (no Docker). SQL is validated by `supabase db push` in Task 14. Read each migration twice before moving on.
- Sources for the recovery domain are at `/Users/quitefrank/Claude/Personal/raw/achilles/`. Nothing from `02-CASE-FILE.md` is written into this repository.

---

## File map

| Path | Responsibility | Task |
|---|---|---|
| `supabase/migrations/0001_initial_schema.sql` | Rename `programs` to `templates`; dose columns; `exercise_alternates.notes` | 1 |
| `scripts/lib/exercise-name.ts` | Add `exerciseSlug` | 2 |
| `scripts/lib/__tests__/exercise-name.test.ts` | Tests for `exerciseSlug` | 2 |
| `scripts/seed-from-notion.ts` | Rename targets; write `slug` | 3 |
| `CLAUDE.md`, `README.md`, `docs/planning.md` | Vocabulary | 4 |
| `supabase/migrations/0003_exercise_authoring.sql` | Authoring enums and columns | 5 |
| `supabase/migrations/0004_programs.sql` | `sources`, `programs`, `program_phases`, `template_phases` | 6 |
| `supabase/migrations/0005_recovery.sql` | `recoveries`, `clearances`, `events`, `rules`, `daily_checks` | 7 |
| `src/lib/recovery/types.ts` | Domain types shared by the modules below | 8 |
| `src/lib/recovery/dates.ts` + test | Day and week math from the injury date | 9 |
| `src/lib/recovery/state.ts` + test | Restriction state from clearances | 10 |
| `src/lib/recovery/dose.ts` + test | Parse and format doses | 11 |
| `src/lib/recovery/authoring.ts` + test | The eleven authoring rules | 12 |
| `src/lib/recovery/frequency.ts` + test | Hours-between and per-week caps | 13 |
| `eslint.config.mjs` | `no-redeclare` | 14 |
| `scripts/create-seed-user.ts`, `.env.local.example`, `package.json` | Auth user helper and scripts | 15 |
| `src/lib/supabase/database.types.ts` | Generated types | 15 |

---

### Task 1: Rename `programs` to `templates` in `0001`

**Files:**
- Modify: `supabase/migrations/0001_initial_schema.sql`

- [ ] **Step 1: Rename the category enum**

Replace lines 25 to 33:

```sql
create type template_category as enum (
  'push',
  'pull',
  'legs',
  'arms',
  'full_body',
  'cardio',
  'abs'
);
```

- [ ] **Step 2: Add `notes` to `exercise_alternates`**

In the `create table exercise_alternates` block, add one column after `position`:

```sql
  position integer not null check (position in (1, 2)),
  notes text,
```

- [ ] **Step 3: Replace the `programs` block**

Replace the whole section from `-- programs` through `for each row execute function set_updated_at();` (lines 112 to 131) with:

```sql
-- ============================================================
-- templates (one day's prescription; the 18 Notion day templates
-- and any recovery templates added later)
-- ============================================================

create table templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category template_category,
  variant text,
  tutorial_url text,
  estimated_minutes integer,
  notes text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger templates_set_updated_at
  before update on templates
  for each row execute function set_updated_at();
```

- [ ] **Step 4: Replace the `program_exercises` block**

Replace the section from `-- program_exercises` through its trigger (lines 133 to 161) with:

```sql
-- ============================================================
-- template_exercises (prescription rows for a template)
-- A prescription is one of reps, RIR, or seconds.
-- ============================================================

create table template_exercises (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references templates(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete restrict,
  position integer not null,
  prescribed_sets_min integer,
  prescribed_sets_max integer,
  prescribed_reps_min integer,
  prescribed_reps_max integer,
  prescribed_rir_min integer,
  prescribed_rir_max integer,
  prescribed_seconds_min integer,
  prescribed_seconds_max integer,
  prescribed_rest_seconds integer,
  prescribed_rpe text,
  warm_up_sets_min integer,
  warm_up_sets_max integer,
  notes text,
  _notion_id text unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index template_exercises_template_id_idx on template_exercises(template_id);
create index template_exercises_exercise_id_idx on template_exercises(exercise_id);

create trigger template_exercises_set_updated_at
  before update on template_exercises
  for each row execute function set_updated_at();
```

- [ ] **Step 5: Point `workouts` at `templates`**

In `create table workouts`, replace:

```sql
  program_id uuid references programs(id) on delete set null,
```

with:

```sql
  template_id uuid references templates(id) on delete set null,
```

- [ ] **Step 6: Add dose columns to `workout_exercises`**

In `create table workout_exercises`, after `prescribed_reps_max integer,` add:

```sql
  prescribed_rir_min integer,
  prescribed_rir_max integer,
  prescribed_seconds_min integer,
  prescribed_seconds_max integer,
```

- [ ] **Step 7: Add `seconds` to `sets`**

In `create table sets`, after `reps integer,` add:

```sql
  seconds integer,
```

- [ ] **Step 8: Rename in the RLS section**

Replace the comment block header lines that read `-- Library tables (muscle_groups, exercises, exercise_alternates,` and `-- programs, program_exercises) are global reference data shared` with:

```sql
-- Library tables (muscle_groups, exercises, exercise_alternates,
-- templates, template_exercises) are global reference data shared
```

Replace:

```sql
alter table programs enable row level security;
alter table program_exercises enable row level security;
```

with:

```sql
alter table templates enable row level security;
alter table template_exercises enable row level security;
```

Replace:

```sql
create policy "library_read_programs" on programs
  for select to authenticated using (true);

create policy "library_read_program_exercises" on program_exercises
  for select to authenticated using (true);
```

with:

```sql
create policy "library_read_templates" on templates
  for select to authenticated using (true);

create policy "library_read_template_exercises" on template_exercises
  for select to authenticated using (true);
```

- [ ] **Step 9: Verify no stray references**

Run: `grep -n "program" supabase/migrations/0001_initial_schema.sql`
Expected: no output.

Run: `grep -n "program" supabase/migrations/0002_analytics_views.sql`
Expected: no output. The views never referenced `programs`; nothing to change there.

- [ ] **Step 10: Commit**

```bash
git add supabase/migrations/0001_initial_schema.sql
git commit -m "refactor(db): rename programs to templates, add dose columns" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `exerciseSlug` helper

**Files:**
- Modify: `scripts/lib/exercise-name.ts`
- Test: `scripts/lib/__tests__/exercise-name.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `scripts/lib/__tests__/exercise-name.test.ts`:

```ts
import { exerciseSlug } from "../exercise-name";

describe("exerciseSlug", () => {
  it("lower-cases and hyphenates", () => {
    expect(exerciseSlug("Seated Cable Row", null)).toBe("seated-cable-row");
  });

  it("strips arrows and punctuation", () => {
    expect(exerciseSlug("Leg Press ↑", null)).toBe("leg-press");
    expect(exerciseSlug("Pull-ups (weighted)", null)).toBe("pull-ups-weighted");
  });

  it("collapses runs of separators", () => {
    expect(exerciseSlug("Single-leg  calf raise, sound leg", null)).toBe(
      "single-leg-calf-raise-sound-leg",
    );
  });

  it("suffixes machine location so variants stay distinct", () => {
    expect(exerciseSlug("Chest Press", "upstairs")).toBe("chest-press-upstairs");
    expect(exerciseSlug("Chest Press", "downstairs")).toBe("chest-press-downstairs");
  });
});
```

If the file already has `import { describe, expect, it } from "vitest";` at the top, keep the new `exerciseSlug` import next to the existing `parseExerciseName` import instead of adding a second import line.

- [ ] **Step 2: Run to verify failure**

Run: `bun run test scripts/lib/__tests__/exercise-name.test.ts`
Expected: FAIL, `exerciseSlug` is not exported.

- [ ] **Step 3: Implement**

Append to `scripts/lib/exercise-name.ts`:

```ts
/**
 * Stable identifier for matching the same exercise across sources
 * (Notion, the Achilles seed, hand entry). Arrows and punctuation go,
 * whitespace and hyphens collapse to one hyphen, and a machine
 * location is suffixed so upstairs and downstairs variants stay
 * distinct rows.
 */
export function exerciseSlug(
  rawName: string,
  machineLocation: MachineLocationValue,
): string {
  const base = rawName
    .replace(/[↑↓]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return machineLocation ? `${base}-${machineLocation}` : base;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test scripts/lib/__tests__/exercise-name.test.ts`
Expected: PASS, 4 new tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/lib/exercise-name.ts scripts/lib/__tests__/exercise-name.test.ts
git commit -m "feat(seed): exerciseSlug for cross-source matching" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Rename targets in the Notion seed and write `slug`

**Files:**
- Modify: `scripts/seed-from-notion.ts`

Edit these exact locations. Line numbers are from the file before any edits in this task; apply top to bottom.

- [ ] **Step 1: Import the slug helper**

Line 27, replace:

```ts
import { parseExerciseName } from "./lib/exercise-name";
```

with:

```ts
import { exerciseSlug, parseExerciseName } from "./lib/exercise-name";
```

- [ ] **Step 2: Rename the report field**

Line 215, replace `programsCategoryMissing: { id: string; name: string }[];` with:

```ts
  templatesCategoryMissing: { id: string; name: string }[];
```

Line 240, replace `programsCategoryMissing: [],` with:

```ts
    templatesCategoryMissing: [],
```

- [ ] **Step 3: Write `slug` on exercises, with collision suffixing**

After line 269 (`const exercisePages = new Map<string, AnyPage>();`), add:

```ts
  const usedSlugs = new Set<string>();
```

Replace the `upsertExercise` call (lines 284 to 292) with:

```ts
    let slug = exerciseSlug(rawName, info.machineLocation);
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
      report.notionFieldsWarnings.push(
        `duplicate exercise name "${info.name}" (${page.url ?? page.id}); slug set to ${slug}`,
      );
    }
    usedSlugs.add(slug);
    const supabaseId = await upsertExercise(supabase, {
      notionId: page.id,
      name: info.name,
      slug,
      muscleGroupId,
      equipmentType: info.equipmentType,
      machineLocation: info.machineLocation,
      notes: getRichTextOrNull(page, FIELDS.exercises.notes),
      videoUrl: getUrl(page, FIELDS.exercises.video),
    });
```

- [ ] **Step 4: Rename section 5**

Replace lines 366 to 393 (the whole `5. Programs (from templates)` section) with:

```ts
  // ----------------------------------------------------------
  // 5. Templates (from Notion template pages)
  // ----------------------------------------------------------
  console.log("\n[5/8] Seeding templates");
  const templateMap = new Map<string, string>();
  for (const page of templates) {
    const name = getTitle(page, FIELDS.workouts.name);
    if (!name) continue;
    const category = inferProgramCategory(name);
    const variant = extractVariant(name);
    const supabaseId = await upsertTemplate(supabase, {
      notionId: page.id,
      name,
      category,
      variant,
      tutorialUrl: getUrl(page, FIELDS.workouts.tutorial),
      estimatedMinutes: getNumber(page, FIELDS.workouts.estimatedMinutes),
      notes: getRichTextOrNull(page, FIELDS.workouts.notes),
    });
    if (!supabaseId) continue;
    templateMap.set(page.id, supabaseId);
    if (!category) {
      report.templatesCategoryMissing.push({ id: supabaseId, name });
    }
  }
  console.log(
    `  done: ${templateMap.size} templates (${report.templatesCategoryMissing.length} without category)`,
  );
```

`inferProgramCategory` keeps its name; it reads the Notion "Program" label, which is a Notion field name and not ours to rename.

- [ ] **Step 5: Rename in section 6**

Replace lines 406 to 417 with:

```ts
    const templateRel = getRelation(page, FIELDS.workouts.program);
    const templateId = templateRel[0]
      ? (templateMap.get(templateRel[0]) ?? null)
      : null;
    const supabaseId = await upsertWorkout(supabase, {
      notionId: page.id,
      userId: env.SEED_USER_ID,
      templateId,
      scheduledFor: dateDone,
      completedAt: dateDone ? `${dateDone}T00:00:00Z` : null,
      notes: getRichTextOrNull(page, FIELDS.workouts.notes),
    });
```

- [ ] **Step 6: Rename in section 7**

Line 424 comment: `// 7. Sessions: split into template_exercises and workout_exercises`

Line 433: `const templateSessionsByParent = new Map<string, AnyPage[]>();`

Lines 451 to 453:

```ts
      const arr = templateSessionsByParent.get(parentId) ?? [];
      arr.push(page);
      templateSessionsByParent.set(parentId, arr);
```

Line 464: `[...templateSessionsByParent.values()].reduce(`

Line 468: `} -> template_exercises, ${`

Lines 476 to 497, replace the whole "Program exercises" block with:

```ts
  // Template exercises
  console.log("  inserting template_exercises");
  let teCount = 0;
  for (const [parentNotionId, rows] of templateSessionsByParent) {
    const templateId = templateMap.get(parentNotionId);
    if (!templateId) continue;
    let pos = 1;
    for (const page of rows) {
      const exerciseRel = getRelation(page, FIELDS.sessions.exercise);
      const exerciseId = exerciseMap.get(exerciseRel[0]);
      if (!exerciseId) continue;
      const ok = await upsertTemplateExercise(supabase, {
        notionId: page.id,
        templateId,
        exerciseId,
        position: pos++,
        ...prescriptionFromSession(page),
      });
      if (ok) teCount++;
    }
  }
  console.log(`    done: ${teCount} template_exercises`);
```

- [ ] **Step 7: Rename in the verification list and summary**

Lines 592 to 593:

```ts
    "templates",
    "template_exercises",
```

Line 618:

```ts
  console.log(`  templates without inferred category:   ${report.templatesCategoryMissing.length}`);
```

- [ ] **Step 8: Update the upserters**

`upsertExercise` (starts line 667): add `slug: string;` to the args type after `name: string;`, and add `slug: args.slug,` to the upsert object after `name: args.name,`.

Replace `upsertProgram` (lines 702 to 735) with:

```ts
async function upsertTemplate(
  sb: SupabaseClient,
  args: {
    notionId: string;
    name: string;
    category: string | null;
    variant: string | null;
    tutorialUrl: string | null;
    estimatedMinutes: number | null;
    notes: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sb
    .from("templates")
    .upsert(
      {
        name: args.name,
        category: args.category,
        variant: args.variant,
        tutorial_url: args.tutorialUrl,
        estimated_minutes: args.estimatedMinutes,
        notes: args.notes,
        _notion_id: args.notionId,
      },
      { onConflict: "_notion_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error(`  template upsert failed (${args.name}):`, error.message);
    return null;
  }
  return data?.id ?? null;
}
```

In `upsertWorkout`: `programId: string | null;` becomes `templateId: string | null;` and `program_id: args.programId,` becomes `template_id: args.templateId,`.

Replace `upsertProgramExercise` (lines 770 to 811) with:

```ts
async function upsertTemplateExercise(
  sb: SupabaseClient,
  args: {
    notionId: string;
    templateId: string;
    exerciseId: string;
    position: number;
    prescribedSetsMin: number | null;
    prescribedSetsMax: number | null;
    prescribedRepsMin: number | null;
    prescribedRepsMax: number | null;
    prescribedRestSeconds: number | null;
    prescribedRpe: string | null;
    warmUpSetsMin: number | null;
    warmUpSetsMax: number | null;
    notes: string | null;
  },
): Promise<boolean> {
  const { error } = await sb.from("template_exercises").upsert(
    {
      template_id: args.templateId,
      exercise_id: args.exerciseId,
      position: args.position,
      prescribed_sets_min: args.prescribedSetsMin,
      prescribed_sets_max: args.prescribedSetsMax,
      prescribed_reps_min: args.prescribedRepsMin,
      prescribed_reps_max: args.prescribedRepsMax,
      prescribed_rest_seconds: args.prescribedRestSeconds,
      prescribed_rpe: args.prescribedRpe,
      warm_up_sets_min: args.warmUpSetsMin,
      warm_up_sets_max: args.warmUpSetsMax,
      notes: args.notes,
      _notion_id: args.notionId,
    },
    { onConflict: "_notion_id" },
  );
  if (error) {
    console.error(`  template_exercise upsert failed:`, error.message);
    return false;
  }
  return true;
}
```

- [ ] **Step 9: Verify**

Run: `grep -n "rogram" scripts/seed-from-notion.ts`
Expected: only lines that mention the Notion field label (`program: "Program"`, the comment near line 154, and `inferProgramCategory`). No `programs`, `program_exercises`, `program_id`, `programMap`, `upsertProgram`.

Run: `bunx tsc --noEmit`
Expected: no errors.

Run: `bun run lint`
Expected: no errors.

Run: `bun run test`
Expected: 67 passing (63 plus the 4 from Task 2).

- [ ] **Step 10: Commit**

```bash
git add scripts/seed-from-notion.ts
git commit -m "refactor(seed): write to templates, set exercise slug" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Vocabulary in the docs

**Files:**
- Modify: `CLAUDE.md`
- Modify: `README.md`
- Modify: `docs/planning.md`

- [ ] **Step 1: `CLAUDE.md`**

Line 45: `templates, template_exercises) read for any authenticated user.`

Line 67: `` - `templates`, `template_exercises` (day templates, global) ``

Line 71: `` Four enums: `equipment_type`, `machine_location`, `template_category`, ``

Line 119: `- Screens per `docs/planning.md`: calendar home, template detail,`

Also under `## Database`, after the "Nine tables:" list, add:

```markdown
Vocabulary, top to bottom: Program (multi-week, has phases) > Template
(one day's prescription) > Workout (a template performed on a date) >
Set. Programs and the recovery tables arrive in migrations 0003 to
0005; see `docs/superpowers/specs/2026-09-14-achilles-recovery-design.md`.
```

- [ ] **Step 2: `README.md`**

Line 35: replace `program` with `template` in the Milestone 2 sentence.
Line 90: `` `templates`, `template_exercises`) allow reads by any authenticated user. ``
Line 110: `- Templates whose category could not be inferred from the name`

- [ ] **Step 3: `docs/planning.md` vocabulary table**

Replace the two rows:

```markdown
| `programs` | Program | The 18 day templates |
| `program_exercises` | Prescribed exercise | Sessions rows attached to a template |
```

with:

```markdown
| `templates` | Template | The 18 day templates |
| `template_exercises` | Prescribed exercise | Sessions rows attached to a template |
```

Add directly below the table:

```markdown
> Updated [2026-09-14]: `programs` was renamed to `templates`. "Program" now means a multi-week programme with phases (the recovery protocol first). See the recovery design spec.
```

Leave the rest of planning.md as written; it is the historical plan.

- [ ] **Step 4: Commit**

```bash
git add CLAUDE.md README.md docs/planning.md
git commit -m "docs: templates vocabulary after the programs rename" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Migration `0003_exercise_authoring.sql`

**Files:**
- Create: `supabase/migrations/0003_exercise_authoring.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Exercise authoring attributes.
--
-- Stored so the template-building rules in src/lib/recovery/authoring.ts
-- can run against them: in seed tests now, in a template builder later.
-- Only support_required is ever shown in the UI. The rest are inputs to
-- how a template gets built, not facts a screen displays.
--
-- Nullable because the Notion library arrives unrated. Every exercise
-- seeded from the Achilles material must have all of them set; the seed
-- tests enforce that.

create type support_type as enum (
  'hanging',
  'lying',
  'seated_supported',
  'standing_supported',
  'standing_free'
);

-- "horizontal" is split into sagittal and lateral. A seated cable row
-- (sagittal, one foot braces it) passes; a seated Pallof press (lateral)
-- tipped the user off the bench.
create type load_direction as enum (
  'vertical',
  'sagittal',
  'lateral',
  'none'
);

-- The building gym plus home equipment, and the machines the gym does
-- not have, so a Notion exercise that needs one can be flagged.
create type equipment_item as enum (
  'cable_tower',
  'dumbbells',
  'adjustable_bench',
  'half_rack',
  'pull_up_bar',
  'plate_tree',
  'mat',
  'medicine_ball',
  'stability_ball',
  'treadmill',
  'elliptical',
  'stepper',
  'spin_bike',
  'upright_bike',
  'resistance_band',
  'hanging_ab_straps',
  'barbell',
  'rower',
  'leg_press',
  'calf_machine',
  'assisted_pull_up',
  'captains_chair',
  'chest_press_machine',
  'shoulder_press_machine',
  'step_platform',
  'bathroom_scale'
);

alter table exercises
  add column slug text,
  add column support_required support_type,
  add column load_direction load_direction,
  add column loads_booted_foot boolean,
  add column ankle_involvement boolean,
  add column floor_transfer_required boolean,
  add column equipment_needed equipment_item[],
  add column min_hours_between_sessions integer
    check (min_hours_between_sessions is null or min_hours_between_sessions > 0),
  add column max_sessions_per_week integer
    check (max_sessions_per_week is null or max_sessions_per_week > 0),
  add column video_verified_at timestamptz;

-- Unique on non-null slugs. Rows without a slug (hand-entered before the
-- seed sets one) do not collide with each other.
create unique index exercises_slug_idx on exercises(slug);

alter table user_settings
  add column equipment_available equipment_item[];
```

- [ ] **Step 2: Read it back against the spec's section 4.1 and 4.2**

Check every enum value in the spec appears once, and every `exercises` column in the spec's 4.2 table appears once.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_exercise_authoring.sql
git commit -m "feat(db): exercise authoring attributes and equipment enum" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Migration `0004_programs.sql`

**Files:**
- Create: `supabase/migrations/0004_programs.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Programs: a multi-week programme with phases and sources.
--
-- The recovery protocol is one program. A normal training programme
-- with phases is another. Templates optionally belong to a program and
-- are valid in some of its phases.
--
-- Weeks count from day 0 of the enrolment (recoveries.injury_date for
-- a recovery program). Phases are stored as the source document prints
-- them. Nothing is shifted and no offset column exists anywhere; the
-- live position comes only from the clearance log.

create type program_kind as enum ('recovery', 'training');

create type source_kind as enum (
  'trial',
  'review',
  'cohort',
  'handout',
  'convention',
  'anecdote'
);

-- ============================================================
-- sources
-- ============================================================

create table sources (
  id uuid primary key default gen_random_uuid(),
  citation text not null unique,
  url text,
  kind source_kind not null,
  quality text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger sources_set_updated_at
  before update on sources
  for each row execute function set_updated_at();

-- ============================================================
-- programs
-- ============================================================

create table programs (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  kind program_kind not null,
  description text,
  citation text,
  authority_notes text,
  source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programs_set_updated_at
  before update on programs
  for each row execute function set_updated_at();

-- ============================================================
-- program_phases
-- guidance is an ordered array of { "heading": text, "items": text[] }.
-- Display content, not queried data.
-- ============================================================

create table program_phases (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  position integer not null,
  label text not null,
  week_from integer not null check (week_from >= 0),
  week_to integer check (week_to is null or week_to > week_from),
  load_pct integer check (load_pct is null or load_pct between 0 and 100),
  gate text,
  guidance jsonb not null default '[]'::jsonb
    check (jsonb_typeof(guidance) = 'array'),
  flag text,
  flag_source_id uuid references sources(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (program_id, position)
);

create index program_phases_program_id_idx on program_phases(program_id);

create trigger program_phases_set_updated_at
  before update on program_phases
  for each row execute function set_updated_at();

-- ============================================================
-- templates.program_id and template_phases
-- ============================================================

alter table templates
  add column program_id uuid references programs(id) on delete set null;

create index templates_program_id_idx on templates(program_id);

create table template_phases (
  template_id uuid not null references templates(id) on delete cascade,
  phase_id uuid not null references program_phases(id) on delete cascade,
  primary key (template_id, phase_id)
);

-- ============================================================
-- Row-Level Security: library tables, authenticated reads only.
-- ============================================================

alter table sources enable row level security;
alter table programs enable row level security;
alter table program_phases enable row level security;
alter table template_phases enable row level security;

create policy "library_read_sources" on sources
  for select to authenticated using (true);

create policy "library_read_programs" on programs
  for select to authenticated using (true);

create policy "library_read_program_phases" on program_phases
  for select to authenticated using (true);

create policy "library_read_template_phases" on template_phases
  for select to authenticated using (true);
```

- [ ] **Step 2: Read it back against the spec's sections 4.3 and 4.6**

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0004_programs.sql
git commit -m "feat(db): programs, phases, sources, template_phases" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Migration `0005_recovery.sql`

**Files:**
- Create: `supabase/migrations/0005_recovery.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Per-user recovery tables.
--
-- recoveries   an enrolment in a recovery program: day 0 lives here
-- clearances   the dated, sourced log of what is permitted. Insert-only;
--              a wrong row is voided and re-entered, never edited
-- events       appointments, milestones, reminders, with questions to raise
-- rules        the standing rules and any prohibition
-- daily_checks one row per day of checks
--
-- All scoped to auth.uid() through recoveries.user_id.

create type clearance_kind as enum (
  'weight_bearing',
  'ankle_rom',
  'wedge_removal',
  'boot_weaning',
  'out_of_boot',
  'strength_gate'
);

create type clearance_source as enum ('clinic', 'self', 'planned');

create type event_kind as enum ('appointment', 'milestone', 'reminder');

create type rule_kind as enum ('rule', 'prohibition');

-- ============================================================
-- recoveries
-- ============================================================

create table recoveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  program_id uuid not null references programs(id) on delete restrict,
  label text not null,
  side text not null check (side in ('left', 'right')),
  injury_date date not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index recoveries_user_id_idx on recoveries(user_id);

create trigger recoveries_set_updated_at
  before update on recoveries
  for each row execute function set_updated_at();

-- ============================================================
-- clearances
-- ============================================================

create table clearances (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  effective_from date not null,
  kind clearance_kind not null,
  value_pct integer check (value_pct is null or value_pct between 0 and 100),
  value_text text,
  phase_id uuid references program_phases(id) on delete set null,
  source clearance_source not null,
  note text,
  voided_at timestamptz,
  created_at timestamptz not null default now()
);

create index clearances_recovery_id_effective_from_idx
  on clearances(recovery_id, effective_from);

-- ============================================================
-- events
-- ============================================================

create table events (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  date date not null,
  kind event_kind not null,
  label text not null,
  note text,
  questions text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index events_recovery_id_date_idx on events(recovery_id, date);

create trigger events_set_updated_at
  before update on events
  for each row execute function set_updated_at();

-- ============================================================
-- rules
-- ============================================================

create table rules (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  position integer not null,
  kind rule_kind not null,
  title text not null,
  detail text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recovery_id, position)
);

create trigger rules_set_updated_at
  before update on rules
  for each row execute function set_updated_at();

-- ============================================================
-- daily_checks
-- ============================================================

create table daily_checks (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references recoveries(id) on delete cascade,
  date date not null,
  upright_minutes integer check (upright_minutes is null or upright_minutes >= 0),
  skin_check boolean,
  scale_recalibrated boolean,
  pain_0_10 integer check (pain_0_10 is null or pain_0_10 between 0 and 10),
  numbness boolean,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (recovery_id, date)
);

create trigger daily_checks_set_updated_at
  before update on daily_checks
  for each row execute function set_updated_at();

-- ============================================================
-- Row-Level Security
-- ============================================================

alter table recoveries enable row level security;
alter table clearances enable row level security;
alter table events enable row level security;
alter table rules enable row level security;
alter table daily_checks enable row level security;

create policy "recoveries_owner_all" on recoveries
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "events_owner_all" on events
  for all to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = events.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = events.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "rules_owner_all" on rules
  for all to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = rules.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = rules.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "daily_checks_owner_all" on daily_checks
  for all to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = daily_checks.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = daily_checks.recovery_id and r.user_id = auth.uid()
    )
  );

-- Clearances are insert-only. Select and insert for the owner; update
-- for the owner but, through a column-level grant below, only on
-- voided_at; no delete policy, so deletes are refused.

create policy "clearances_owner_select" on clearances
  for select to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "clearances_owner_insert" on clearances
  for insert to authenticated
  with check (
    exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  );

create policy "clearances_owner_void" on clearances
  for update to authenticated
  using (
    exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from recoveries r
      where r.id = clearances.recovery_id and r.user_id = auth.uid()
    )
  );

-- Supabase grants all privileges to authenticated by default. Narrow
-- update on clearances to the one column that may change.
revoke update on clearances from authenticated;
grant update (voided_at) on clearances to authenticated;
revoke delete on clearances from authenticated;
```

- [ ] **Step 2: Read it back against the spec's sections 4.7 and 4.9**

Check: every per-user table has RLS enabled and a policy; `clearances` has no delete policy and the two grant lines are present.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_recovery.sql
git commit -m "feat(db): recoveries, clearances, events, rules, daily_checks" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Domain types

**Files:**
- Create: `src/lib/recovery/types.ts`

- [ ] **Step 1: Write the types**

```ts
/**
 * Domain types for the recovery layer. Hand-written and independent of
 * the generated Supabase types so the pure modules can be tested with
 * plain objects. Dates are ISO calendar strings (YYYY-MM-DD); datetimes
 * are ISO strings with a time zone.
 */

export type SupportType =
  | "hanging"
  | "lying"
  | "seated_supported"
  | "standing_supported"
  | "standing_free";

export type LoadDirection = "vertical" | "sagittal" | "lateral" | "none";

export type EquipmentItem =
  | "cable_tower"
  | "dumbbells"
  | "adjustable_bench"
  | "half_rack"
  | "pull_up_bar"
  | "plate_tree"
  | "mat"
  | "medicine_ball"
  | "stability_ball"
  | "treadmill"
  | "elliptical"
  | "stepper"
  | "spin_bike"
  | "upright_bike"
  | "resistance_band"
  | "hanging_ab_straps"
  | "barbell"
  | "rower"
  | "leg_press"
  | "calf_machine"
  | "assisted_pull_up"
  | "captains_chair"
  | "chest_press_machine"
  | "shoulder_press_machine"
  | "step_platform"
  | "bathroom_scale";

export type ClearanceKind =
  | "weight_bearing"
  | "ankle_rom"
  | "wedge_removal"
  | "boot_weaning"
  | "out_of_boot"
  | "strength_gate";

export type ClearanceSource = "clinic" | "self" | "planned";

export type Clearance = {
  effectiveFrom: string;
  kind: ClearanceKind;
  valuePct: number | null;
  valueText: string | null;
  phaseId: string | null;
  source: ClearanceSource;
  voidedAt: string | null;
};

export type BootStatus = "on" | "weaning" | "off";

export type RestrictionState = {
  clearedLoadPct: number;
  ankleRomCleared: boolean;
  bootStatus: BootStatus;
  wedgesRemoved: number;
  strengthGate: string | null;
  currentPhaseId: string | null;
  daysSinceLastClearance: number | null;
  isStale: boolean;
};

/** The subset of an exercise row the authoring rules read. */
export type AuthoringExercise = {
  id: string;
  name: string;
  supportRequired: SupportType | null;
  loadDirection: LoadDirection | null;
  loadsBootedFoot: boolean | null;
  ankleInvolvement: boolean | null;
  floorTransferRequired: boolean | null;
  equipmentNeeded: EquipmentItem[] | null;
  minHoursBetweenSessions: number | null;
  maxSessionsPerWeek: number | null;
};

export type VerdictLevel = "ok" | "warn" | "blocked";

export type Verdict = {
  level: VerdictLevel;
  /** Rule number from the design spec, section 6. 0 when no rule applies. */
  rule: number;
  reason: string;
};
```

- [ ] **Step 2: Typecheck**

Run: `bunx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/recovery/types.ts
git commit -m "feat(recovery): domain types" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: `dates.ts`

**Files:**
- Create: `src/lib/recovery/dates.ts`
- Test: `src/lib/recovery/__tests__/dates.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  addDays,
  dayIndex,
  phaseWindow,
  weekIndex,
} from "../dates";

// Placeholder injury date. Real dates live in the per-user seed only.
const INJURY = "2000-03-01";

describe("dayIndex", () => {
  it("is 0 on the injury date and nothing else defines day 0", () => {
    expect(dayIndex(INJURY, "2000-03-01")).toBe(0);
  });

  it("counts calendar days forward", () => {
    expect(dayIndex(INJURY, "2000-03-02")).toBe(1);
    expect(dayIndex(INJURY, "2000-03-31")).toBe(30);
  });

  it("is negative before the injury", () => {
    expect(dayIndex(INJURY, "2000-02-28")).toBe(-2);
  });

  it("is unaffected by a daylight-saving change in between", () => {
    // 2000-04-02 was a DST change in North America.
    expect(dayIndex("2000-03-30", "2000-04-05")).toBe(6);
  });

  it("rejects a non-ISO date", () => {
    expect(() => dayIndex(INJURY, "March 1")).toThrow(/Not an ISO date/);
  });
});

describe("weekIndex", () => {
  it("floors days by 7", () => {
    expect(weekIndex(INJURY, "2000-03-01")).toBe(0);
    expect(weekIndex(INJURY, "2000-03-07")).toBe(0);
    expect(weekIndex(INJURY, "2000-03-08")).toBe(1);
    expect(weekIndex(INJURY, "2000-03-29")).toBe(4);
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2000-02-28", 2)).toBe("2000-03-01");
  });

  it("goes backward", () => {
    expect(addDays("2000-03-01", -1)).toBe("2000-02-29");
  });
});

describe("phaseWindow", () => {
  it("runs from the first day of week_from to the last day before week_to", () => {
    expect(phaseWindow(INJURY, 2, 6)).toEqual({
      start: "2000-03-15",
      end: "2000-04-11",
    });
  });

  it("is open-ended when week_to is null", () => {
    expect(phaseWindow(INJURY, 53, null)).toEqual({
      start: "2001-03-07",
      end: null,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/recovery/__tests__/dates.test.ts`
Expected: FAIL, cannot find module `../dates`.

- [ ] **Step 3: Implement**

```ts
/**
 * Calendar math for a recovery. Day 0 is the injury date; every week
 * number counts from it. There is no offset anywhere in this module or
 * elsewhere. A fall, a slow week, an early clearance: all of that lives
 * in the clearance log, never here.
 *
 * Dates are ISO strings (YYYY-MM-DD) handled as UTC calendar days so a
 * time zone or daylight-saving change can never move a boundary.
 */

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMidnight(iso: string): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMidnight(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return fromUtcMidnight(toUtcMidnight(iso) + days * MS_PER_DAY);
}

export function dayIndex(injuryDate: string, today: string): number {
  return Math.round(
    (toUtcMidnight(today) - toUtcMidnight(injuryDate)) / MS_PER_DAY,
  );
}

export function weekIndex(injuryDate: string, today: string): number {
  return Math.floor(dayIndex(injuryDate, today) / 7);
}

export type PhaseWindow = { start: string; end: string | null };

/** Reference window of a phase: first day of week_from through the last day before week_to. */
export function phaseWindow(
  injuryDate: string,
  weekFrom: number,
  weekTo: number | null,
): PhaseWindow {
  return {
    start: addDays(injuryDate, weekFrom * 7),
    end: weekTo === null ? null : addDays(injuryDate, weekTo * 7 - 1),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/recovery/__tests__/dates.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recovery/dates.ts src/lib/recovery/__tests__/dates.test.ts
git commit -m "feat(recovery): day and week math from the injury date" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: `state.ts`

**Files:**
- Create: `src/lib/recovery/state.ts`
- Test: `src/lib/recovery/__tests__/state.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { restrictionState, STALE_AFTER_DAYS } from "../state";
import type { Clearance } from "../types";

function c(partial: Partial<Clearance> & Pick<Clearance, "effectiveFrom" | "kind">): Clearance {
  return {
    valuePct: null,
    valueText: null,
    phaseId: null,
    source: "clinic",
    voidedAt: null,
    ...partial,
  };
}

describe("restrictionState", () => {
  it("starts at zero load, boot on, nothing cleared, when there are no clearances", () => {
    const s = restrictionState([], "2000-03-01");
    expect(s).toEqual({
      clearedLoadPct: 0,
      ankleRomCleared: false,
      bootStatus: "on",
      wedgesRemoved: 0,
      strengthGate: null,
      currentPhaseId: null,
      daysSinceLastClearance: null,
      isStale: false,
    });
  });

  it("takes the latest effective weight-bearing clearance", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 0, phaseId: "p0" }),
        c({ effectiveFrom: "2000-03-22", kind: "weight_bearing", valuePct: 25, phaseId: "p1" }),
        c({ effectiveFrom: "2000-03-29", kind: "weight_bearing", valuePct: 50, phaseId: "p2", source: "self" }),
      ],
      "2000-03-30",
    );
    expect(s.clearedLoadPct).toBe(50);
    expect(s.currentPhaseId).toBe("p2");
  });

  it("ignores a clearance whose effective date is still ahead", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25, phaseId: "p1" }),
        c({ effectiveFrom: "2000-04-01", kind: "weight_bearing", valuePct: 75, phaseId: "p3", source: "planned" }),
      ],
      "2000-03-15",
    );
    expect(s.clearedLoadPct).toBe(25);
    expect(s.currentPhaseId).toBe("p1");
  });

  it("ignores a voided clearance", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
        c({ effectiveFrom: "2000-03-08", kind: "weight_bearing", valuePct: 75, voidedAt: "2000-03-09T10:00:00Z" }),
      ],
      "2000-03-10",
    );
    expect(s.clearedLoadPct).toBe(25);
  });

  it("clears ankle range of motion only when an ankle_rom clearance exists", () => {
    expect(restrictionState([c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 100 })], "2000-03-02").ankleRomCleared).toBe(false);
    expect(restrictionState([c({ effectiveFrom: "2000-03-01", kind: "ankle_rom" })], "2000-03-02").ankleRomCleared).toBe(true);
  });

  it("walks boot status from on to weaning to off", () => {
    const weaning = [c({ effectiveFrom: "2000-05-01", kind: "boot_weaning" })];
    const off = [...weaning, c({ effectiveFrom: "2000-05-05", kind: "out_of_boot" })];
    expect(restrictionState([], "2000-05-10").bootStatus).toBe("on");
    expect(restrictionState(weaning, "2000-05-10").bootStatus).toBe("weaning");
    expect(restrictionState(off, "2000-05-10").bootStatus).toBe("off");
  });

  it("counts wedge removals", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-04-12", kind: "wedge_removal" }),
        c({ effectiveFrom: "2000-04-19", kind: "wedge_removal" }),
        c({ effectiveFrom: "2000-04-26", kind: "wedge_removal", voidedAt: "2000-04-26T12:00:00Z" }),
      ],
      "2000-04-30",
    );
    expect(s.wedgesRemoved).toBe(2);
  });

  it("reports the latest strength gate text", () => {
    const s = restrictionState(
      [c({ effectiveFrom: "2000-09-01", kind: "strength_gate", valueText: "80% strength" })],
      "2000-09-02",
    );
    expect(s.strengthGate).toBe("80% strength");
  });

  it("flags a stale log after STALE_AFTER_DAYS with no new entry", () => {
    const list = [c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 })];
    expect(STALE_AFTER_DAYS).toBe(21);
    expect(restrictionState(list, "2000-03-22").isStale).toBe(false);
    expect(restrictionState(list, "2000-03-23").isStale).toBe(true);
    expect(restrictionState(list, "2000-03-23").daysSinceLastClearance).toBe(22);
  });

  it("does not flag stale when a planned entry is still ahead", () => {
    const list = [
      c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
      c({ effectiveFrom: "2000-04-15", kind: "weight_bearing", valuePct: 50, source: "planned" }),
    ];
    const s = restrictionState(list, "2000-04-01");
    expect(s.isStale).toBe(false);
    expect(s.daysSinceLastClearance).toBe(-14);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/recovery/__tests__/state.test.ts`
Expected: FAIL, cannot find module `../state`.

- [ ] **Step 3: Implement**

```ts
/**
 * The live position, derived only from the clearance log. Nothing here
 * reads the calendar against the reference phases; that is what makes a
 * fall or a slow week show up honestly instead of being papered over.
 */

import { dayIndex } from "./dates";
import type {
  BootStatus,
  Clearance,
  ClearanceKind,
  RestrictionState,
} from "./types";

/** Days without a new clearance entry before the log is called out of date. */
export const STALE_AFTER_DAYS = 21;

function inEffect(clearances: Clearance[], today: string): Clearance[] {
  return clearances
    .filter((c) => c.voidedAt === null && c.effectiveFrom <= today)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function latestOfKind(list: Clearance[], kind: ClearanceKind): Clearance | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].kind === kind) return list[i];
  }
  return null;
}

export function restrictionState(
  clearances: Clearance[],
  today: string,
): RestrictionState {
  const list = inEffect(clearances, today);

  const weightBearing = latestOfKind(list, "weight_bearing");
  const clearedLoadPct = weightBearing?.valuePct ?? 0;

  const ankleRomCleared = latestOfKind(list, "ankle_rom") !== null;

  let bootStatus: BootStatus = "on";
  if (latestOfKind(list, "out_of_boot")) bootStatus = "off";
  else if (latestOfKind(list, "boot_weaning")) bootStatus = "weaning";

  const wedgesRemoved = list.filter((c) => c.kind === "wedge_removal").length;

  const strengthGate = latestOfKind(list, "strength_gate")?.valueText ?? null;

  let currentPhaseId: string | null = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].phaseId !== null) {
      currentPhaseId = list[i].phaseId;
      break;
    }
  }

  // Staleness looks at every non-voided entry, including planned future
  // ones: a planned entry means the log was maintained.
  const dates = clearances
    .filter((c) => c.voidedAt === null)
    .map((c) => c.effectiveFrom)
    .sort();
  const last = dates.length > 0 ? dates[dates.length - 1] : null;
  const daysSinceLastClearance = last === null ? null : dayIndex(last, today);
  const isStale =
    daysSinceLastClearance !== null && daysSinceLastClearance > STALE_AFTER_DAYS;

  return {
    clearedLoadPct,
    ankleRomCleared,
    bootStatus,
    wedgesRemoved,
    strengthGate,
    currentPhaseId,
    daysSinceLastClearance,
    isStale,
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/recovery/__tests__/state.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recovery/state.ts src/lib/recovery/__tests__/state.test.ts
git commit -m "feat(recovery): restriction state from the clearance log" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: `dose.ts`

**Files:**
- Create: `src/lib/recovery/dose.ts`
- Test: `src/lib/recovery/__tests__/dose.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { formatDose, parseDose } from "../dose";

describe("parseDose", () => {
  it("parses sets x reps", () => {
    expect(parseDose("3 x 10-12")).toEqual({
      sets: { min: 3, max: 3 },
      reps: { min: 10, max: 12 },
      rir: null,
      seconds: null,
      modifier: null,
    });
  });

  it("parses a single rep count", () => {
    expect(parseDose("3 x 15")?.reps).toEqual({ min: 15, max: 15 });
  });

  it("parses reps in reserve written out", () => {
    expect(parseDose("4 x leave 1-2 in reserve")).toEqual({
      sets: { min: 4, max: 4 },
      reps: null,
      rir: { min: 1, max: 2 },
      seconds: null,
      modifier: null,
    });
  });

  it("parses reps in reserve abbreviated", () => {
    expect(parseDose("3 x RIR 2-3")?.rir).toEqual({ min: 2, max: 3 });
  });

  it("parses timed holds", () => {
    expect(parseDose("3 x 20-40 sec")).toEqual({
      sets: { min: 3, max: 3 },
      reps: null,
      rir: null,
      seconds: { min: 20, max: 40 },
      modifier: null,
    });
  });

  it("keeps a trailing modifier", () => {
    expect(parseDose("4 x 10-15 slow")?.modifier).toBe("slow");
    expect(parseDose("3 x 12 each side")?.modifier).toBe("each side");
    expect(parseDose("3 x 20-30 sec each side")).toMatchObject({
      seconds: { min: 20, max: 30 },
      modifier: "each side",
    });
  });

  it("accepts a sets range and a multiplication sign", () => {
    expect(parseDose("3-4 × 8")?.sets).toEqual({ min: 3, max: 4 });
  });

  it("rejects what it cannot classify", () => {
    expect(parseDose("3 x banana")).toBeNull();
    expect(parseDose("x 10")).toBeNull();
    expect(parseDose("")).toBeNull();
    expect(parseDose("3 sets of 10")).toBeNull();
  });
});

describe("formatDose", () => {
  it("round-trips the four shapes", () => {
    for (const s of ["3 x 10-12", "4 x RIR 1-2", "3 x 20-40 sec", "3 x 12 each side"]) {
      const d = parseDose(s);
      expect(d).not.toBeNull();
      expect(formatDose(d!)).toBe(s);
    }
  });

  it("normalises the written-out reserve form", () => {
    expect(formatDose(parseDose("4 x leave 1-2 in reserve")!)).toBe("4 x RIR 1-2");
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/recovery/__tests__/dose.test.ts`
Expected: FAIL, cannot find module `../dose`.

- [ ] **Step 3: Implement**

```ts
/**
 * A dose is sets times one of: reps, reps in reserve, or seconds, with
 * an optional trailing modifier ("slow", "each side"). parseDose reads
 * the strings the prototype used so the seed can carry them over;
 * formatDose renders a dose for display. Anything parseDose cannot
 * classify returns null rather than a guess.
 */

import {
  parseRange,
  type Range,
} from "../../../scripts/lib/parse-prescription";

export type Dose = {
  sets: Range;
  reps: Range | null;
  rir: Range | null;
  seconds: Range | null;
  modifier: string | null;
};

const RANGE = "\\d+(?:\\s*[-–]\\s*\\d+)?";
const SETS_RE = new RegExp(`^\\s*(${RANGE})\\s*[x×]\\s*(.+?)\\s*$`, "i");
const RIR_LONG_RE = new RegExp(`^leave\\s+(${RANGE})\\s+in\\s+reserve(?:\\s+(.*))?$`, "i");
const RIR_SHORT_RE = new RegExp(`^rir\\s+(${RANGE})(?:\\s+(.*))?$`, "i");
const SECONDS_RE = new RegExp(`^(${RANGE})\\s*(?:sec|secs|s)\\b(?:\\s+(.*))?$`, "i");
const REPS_RE = new RegExp(`^(${RANGE})(?:\\s+(.*))?$`);

function modifierOf(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : null;
}

export function parseDose(input: string): Dose | null {
  const m = SETS_RE.exec(input);
  if (!m) return null;
  const sets = parseRange(m[1]);
  if (!sets) return null;
  const rest = m[2];

  const rir = RIR_LONG_RE.exec(rest) ?? RIR_SHORT_RE.exec(rest);
  if (rir) {
    const r = parseRange(rir[1]);
    if (!r) return null;
    return { sets, reps: null, rir: r, seconds: null, modifier: modifierOf(rir[2]) };
  }

  const sec = SECONDS_RE.exec(rest);
  if (sec) {
    const r = parseRange(sec[1]);
    if (!r) return null;
    return { sets, reps: null, rir: null, seconds: r, modifier: modifierOf(sec[2]) };
  }

  const reps = REPS_RE.exec(rest);
  if (reps) {
    const r = parseRange(reps[1]);
    if (!r) return null;
    return { sets, reps: r, rir: null, seconds: null, modifier: modifierOf(reps[2]) };
  }

  return null;
}

function range(r: Range): string {
  return r.min === r.max ? `${r.min}` : `${r.min}-${r.max}`;
}

export function formatDose(d: Dose): string {
  let body: string;
  if (d.rir) body = `RIR ${range(d.rir)}`;
  else if (d.seconds) body = `${range(d.seconds)} sec`;
  else if (d.reps) body = range(d.reps);
  else body = "";
  const head = body ? `${range(d.sets)} x ${body}` : `${range(d.sets)} sets`;
  return d.modifier ? `${head} ${d.modifier}` : head;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/recovery/__tests__/dose.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Confirm the cross-directory import builds**

Run: `bunx tsc --noEmit`
Expected: no errors. The relative path from `src/lib/recovery/` up three levels reaches the repo root, then `scripts/lib/`.

- [ ] **Step 6: Commit**

```bash
git add src/lib/recovery/dose.ts src/lib/recovery/__tests__/dose.test.ts
git commit -m "feat(recovery): parse and format doses with RIR and seconds" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: `authoring.ts`

**Files:**
- Create: `src/lib/recovery/authoring.ts`
- Test: `src/lib/recovery/__tests__/authoring.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  checkExercise,
  checkSpacing,
  checkTemplate,
} from "../authoring";
import type {
  AuthoringExercise,
  EquipmentItem,
  RestrictionState,
} from "../types";

function ex(partial: Partial<AuthoringExercise> & { id: string }): AuthoringExercise {
  return {
    name: partial.id,
    supportRequired: "seated_supported",
    loadDirection: "vertical",
    loadsBootedFoot: false,
    ankleInvolvement: false,
    floorTransferRequired: false,
    equipmentNeeded: [],
    minHoursBetweenSessions: null,
    maxSessionsPerWeek: null,
    ...partial,
  };
}

const PARTIAL: RestrictionState = {
  clearedLoadPct: 50,
  ankleRomCleared: false,
  bootStatus: "on",
  wedgesRemoved: 0,
  strengthGate: null,
  currentPhaseId: null,
  daysSinceLastClearance: 1,
  isStale: false,
};

const OUT_OF_BOOT: RestrictionState = {
  ...PARTIAL,
  clearedLoadPct: 100,
  ankleRomCleared: true,
  bootStatus: "off",
};

const GYM: EquipmentItem[] = ["cable_tower", "dumbbells", "adjustable_bench", "half_rack", "mat"];

function levels(v: ReturnType<typeof checkExercise>) {
  return v.map((x) => `${x.level}:${x.rule}`);
}

describe("checkExercise, the hard-won rules", () => {
  it("rule 1: loading the booted foot is blocked while the boot is on", () => {
    const v = checkExercise(ex({ id: "leg press", loadsBootedFoot: true }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("blocked:1");
  });

  it("rule 1: still blocked at 100% load while the boot is on", () => {
    const v = checkExercise(ex({ id: "step up", loadsBootedFoot: true }), { ...PARTIAL, clearedLoadPct: 100 }, GYM, 1);
    expect(levels(v)).toContain("blocked:1");
  });

  it("rule 2: ankle involvement is blocked until range of motion is cleared", () => {
    const v = checkExercise(ex({ id: "ankle pumps", ankleInvolvement: true }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("blocked:2");
    const ok = checkExercise(ex({ id: "ankle pumps", ankleInvolvement: true }), OUT_OF_BOOT, GYM, 1);
    expect(ok.every((x) => x.level === "ok")).toBe(true);
  });

  it("rule 3: a standing band row is blocked on one leg", () => {
    const v = checkExercise(
      ex({ id: "standing band row", supportRequired: "standing_supported", loadDirection: "sagittal", equipmentNeeded: ["resistance_band"] }),
      PARTIAL,
      [...GYM, "resistance_band"],
      1,
    );
    expect(levels(v)).toContain("blocked:3");
  });

  it("rule 4: standing free during partial weight-bearing warns even with a vertical load", () => {
    const v = checkExercise(ex({ id: "standing curl", supportRequired: "standing_free", loadDirection: "vertical" }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:4");
  });

  it("rule 5: the seated Pallof press is blocked", () => {
    const v = checkExercise(ex({ id: "seated pallof press", supportRequired: "seated_supported", loadDirection: "lateral" }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("blocked:5");
  });

  it("rule 6: the seated cable row passes", () => {
    const v = checkExercise(ex({ id: "seated cable row", supportRequired: "seated_supported", loadDirection: "sagittal" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["ok:6"]);
  });

  it("rule 7: a vertical load into the seat passes", () => {
    const v = checkExercise(ex({ id: "seated db curl", supportRequired: "seated_supported", loadDirection: "vertical" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["ok:7"]);
  });

  it("rule 7: a vertical load with a hand on the rack passes", () => {
    const v = checkExercise(ex({ id: "sound-leg calf raise", supportRequired: "standing_supported", loadDirection: "vertical" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["ok:7"]);
  });

  it("rule 8: floor work warns unless it is first", () => {
    const deadBug = ex({ id: "dead bug", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true });
    expect(levels(checkExercise(deadBug, PARTIAL, GYM, 1))).toEqual(["ok:0"]);
    expect(levels(checkExercise(deadBug, PARTIAL, GYM, 4))).toContain("warn:8");
  });

  it("rule 9: missing equipment warns and names it", () => {
    const v = checkExercise(ex({ id: "calf machine", equipmentNeeded: ["calf_machine"] }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:9");
    expect(v.find((x) => x.rule === 9)?.reason).toMatch(/calf_machine/);
  });

  it("rule 9: skips the equipment check when no inventory is known", () => {
    const v = checkExercise(ex({ id: "calf machine", equipmentNeeded: ["calf_machine"] }), PARTIAL, null, 1);
    expect(levels(v)).not.toContain("warn:9");
  });

  it("rule 10: an unrated exercise warns", () => {
    const v = checkExercise(ex({ id: "mystery", supportRequired: null }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:10");
  });

  it("returns every triggered rule, not just the first", () => {
    const v = checkExercise(
      ex({ id: "standing calf raise, injured side", supportRequired: "standing_free", loadDirection: "vertical", loadsBootedFoot: true, ankleInvolvement: true }),
      PARTIAL,
      GYM,
      1,
    );
    expect(levels(v)).toEqual(["blocked:1", "blocked:2", "warn:4"]);
  });
});

describe("checkTemplate", () => {
  it("reports per-exercise verdicts and the worst level", () => {
    const t = {
      name: "Pull",
      spacingNote: null,
      exercises: [
        ex({ id: "pull-ups", supportRequired: "hanging" }),
        ex({ id: "dead bug", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true }),
      ],
    };
    const r = checkTemplate(t, PARTIAL, GYM);
    expect(r.perExercise).toHaveLength(2);
    expect(r.perExercise[1].map((v) => v.rule)).toContain(8);
    expect(r.worst).toBe("warn");
  });

  it("is ok when nothing triggers", () => {
    const t = { name: "Push", spacingNote: null, exercises: [ex({ id: "seated press" })] };
    expect(checkTemplate(t, PARTIAL, GYM).worst).toBe("ok");
  });
});

describe("checkSpacing (rule 11)", () => {
  const pullUps = ex({ id: "pull-ups", supportRequired: "hanging", minHoursBetweenSessions: 72, maxSessionsPerWeek: 2 });

  it("warns when two templates share a spaced exercise and neither carries a note", () => {
    const v = checkSpacing([
      { name: "Workout 1", spacingNote: null, exercises: [pullUps] },
      { name: "Workout 4", spacingNote: null, exercises: [pullUps] },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ level: "warn", rule: 11 });
    expect(v[0].reason).toMatch(/pull-ups/);
  });

  it("passes when both templates carry a spacing note", () => {
    const v = checkSpacing([
      { name: "Workout 1", spacingNote: "72 hours before Workout 4", exercises: [pullUps] },
      { name: "Workout 4", spacingNote: "72 hours after Workout 1", exercises: [pullUps] },
    ]);
    expect(v).toEqual([]);
  });

  it("ignores exercises with no spacing requirement", () => {
    const row = ex({ id: "row" });
    expect(checkSpacing([
      { name: "A", spacingNote: null, exercises: [row] },
      { name: "B", spacingNote: null, exercises: [row] },
    ])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/recovery/__tests__/authoring.test.ts`
Expected: FAIL, cannot find module `../authoring`.

- [ ] **Step 3: Implement**

```ts
/**
 * The template-authoring rules. These are the brief's hard-won rules
 * made executable. They run when a template is built (seed tests now,
 * a template builder later). They never run at workout time and never
 * produce a badge on a screen.
 *
 * Rule numbers match section 6 of the design spec.
 */

import type {
  AuthoringExercise,
  EquipmentItem,
  RestrictionState,
  Verdict,
  VerdictLevel,
} from "./types";

export type TemplateForAuthoring = {
  name: string;
  exercises: AuthoringExercise[];
  /** A note explaining how this template is spaced from others sharing a capped exercise. */
  spacingNote: string | null;
};

const LEVEL_RANK: Record<VerdictLevel, number> = { ok: 0, warn: 1, blocked: 2 };

export function worstLevel(verdicts: Verdict[]): VerdictLevel {
  let worst: VerdictLevel = "ok";
  for (const v of verdicts) {
    if (LEVEL_RANK[v.level] > LEVEL_RANK[worst]) worst = v.level;
  }
  return worst;
}

/**
 * @param position 1-based position of the exercise inside its template.
 * @param equipmentAvailable null when no inventory is known; the check is skipped.
 */
export function checkExercise(
  ex: AuthoringExercise,
  state: RestrictionState,
  equipmentAvailable: EquipmentItem[] | null,
  position: number,
): Verdict[] {
  const out: Verdict[] = [];
  const partialLoad = state.clearedLoadPct < 100;
  const bootOn = state.bootStatus !== "off";
  const standing =
    ex.supportRequired === "standing_free" ||
    ex.supportRequired === "standing_supported";
  const horizontal =
    ex.loadDirection === "sagittal" || ex.loadDirection === "lateral";

  if (ex.loadsBootedFoot === true && (bootOn || partialLoad)) {
    out.push({
      level: "blocked",
      rule: 1,
      reason: "Loads the booted foot while the boot is on or cleared load is under 100%",
    });
  }

  if (ex.ankleInvolvement === true && !state.ankleRomCleared) {
    out.push({
      level: "blocked",
      rule: 2,
      reason: "Ankle involvement while ankle range of motion is not cleared",
    });
  }

  if (standing && horizontal && partialLoad) {
    out.push({
      level: "blocked",
      rule: 3,
      reason: "Standing against a horizontal load with one leg to brace it",
    });
  }

  if (ex.supportRequired === "standing_free" && partialLoad) {
    out.push({
      level: "warn",
      rule: 4,
      reason: "Standing free during partial weight-bearing; a hand on the rack is the minimum",
    });
  }

  if (ex.supportRequired === "seated_supported" && ex.loadDirection === "lateral") {
    out.push({
      level: "blocked",
      rule: 5,
      reason: "Seated against a lateral load tips you off the bench",
    });
  }

  if (ex.floorTransferRequired === true && position !== 1) {
    out.push({
      level: "warn",
      rule: 8,
      reason: "Floor transfer is not first in the template; transfers are where falls happen",
    });
  }

  if (ex.equipmentNeeded && equipmentAvailable) {
    const missing = ex.equipmentNeeded.filter((e) => !equipmentAvailable.includes(e));
    if (missing.length > 0) {
      out.push({
        level: "warn",
        rule: 9,
        reason: `Equipment not available: ${missing.join(", ")}`,
      });
    }
  }

  const inputs = [
    ex.supportRequired,
    ex.loadDirection,
    ex.loadsBootedFoot,
    ex.ankleInvolvement,
    ex.floorTransferRequired,
    ex.equipmentNeeded,
  ];
  if (inputs.some((v) => v === null)) {
    out.push({
      level: "warn",
      rule: 10,
      reason: "Unrated: one or more authoring inputs is missing",
    });
  }

  if (out.length === 0) {
    if (ex.supportRequired === "seated_supported" && ex.loadDirection === "sagittal") {
      out.push({ level: "ok", rule: 6, reason: "Seated with a sagittal load; one foot braces it" });
    } else if (ex.loadDirection === "vertical") {
      out.push({ level: "ok", rule: 7, reason: "Vertical load pulls into the support" });
    } else {
      out.push({ level: "ok", rule: 0, reason: "No rule triggered" });
    }
  }

  return out;
}

export type TemplateVerdict = {
  perExercise: Verdict[][];
  worst: VerdictLevel;
};

export function checkTemplate(
  template: TemplateForAuthoring,
  state: RestrictionState,
  equipmentAvailable: EquipmentItem[] | null,
): TemplateVerdict {
  const perExercise = template.exercises.map((ex, i) =>
    checkExercise(ex, state, equipmentAvailable, i + 1),
  );
  return { perExercise, worst: worstLevel(perExercise.flat()) };
}

/**
 * Rule 11. Two templates in the same program that both contain an
 * exercise with a minimum gap between sessions need a spacing note on
 * each, or the gap is left to chance.
 */
export function checkSpacing(templates: TemplateForAuthoring[]): Verdict[] {
  const out: Verdict[] = [];
  const byExercise = new Map<string, { name: string; templates: TemplateForAuthoring[] }>();
  for (const t of templates) {
    for (const ex of t.exercises) {
      if (ex.minHoursBetweenSessions === null) continue;
      const entry = byExercise.get(ex.id) ?? { name: ex.name, templates: [] };
      if (!entry.templates.includes(t)) entry.templates.push(t);
      byExercise.set(ex.id, entry);
    }
  }
  for (const [, entry] of byExercise) {
    if (entry.templates.length < 2) continue;
    const unnoted = entry.templates.filter((t) => t.spacingNote === null);
    if (unnoted.length === 0) continue;
    out.push({
      level: "warn",
      rule: 11,
      reason: `${entry.name} appears in ${entry.templates.map((t) => t.name).join(" and ")} with no spacing note on ${unnoted.map((t) => t.name).join(", ")}`,
    });
  }
  return out;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/recovery/__tests__/authoring.test.ts`
Expected: PASS, 19 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/recovery/authoring.ts src/lib/recovery/__tests__/authoring.test.ts
git commit -m "feat(recovery): the eleven template-authoring rules" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: `frequency.ts`

**Files:**
- Create: `src/lib/recovery/frequency.ts`
- Test: `src/lib/recovery/__tests__/frequency.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import { frequencyViolation, isoWeekStart } from "../frequency";
import type { AuthoringExercise } from "../types";

const pullUps: AuthoringExercise = {
  id: "pull-ups",
  name: "Pull-ups",
  supportRequired: "hanging",
  loadDirection: "vertical",
  loadsBootedFoot: false,
  ankleInvolvement: false,
  floorTransferRequired: false,
  equipmentNeeded: ["pull_up_bar"],
  minHoursBetweenSessions: 72,
  maxSessionsPerWeek: 2,
};

const row: AuthoringExercise = { ...pullUps, id: "row", name: "Row", minHoursBetweenSessions: null, maxSessionsPerWeek: null };

describe("isoWeekStart", () => {
  it("returns the Monday of the week, as an ISO date", () => {
    expect(isoWeekStart("2000-03-01T10:00:00Z")).toBe("2000-02-28"); // Wednesday
    expect(isoWeekStart("2000-02-28T00:00:00Z")).toBe("2000-02-28"); // Monday
    expect(isoWeekStart("2000-03-05T23:00:00Z")).toBe("2000-02-28"); // Sunday
  });
});

describe("frequencyViolation", () => {
  const history = [
    { completedAt: "2000-03-06T18:00:00Z", exerciseIds: ["pull-ups", "row"] },
  ];

  it("returns null for an exercise with no caps", () => {
    expect(frequencyViolation(row, history, "2000-03-07T18:00:00Z")).toBeNull();
  });

  it("warns inside the minimum gap", () => {
    const v = frequencyViolation(pullUps, history, "2000-03-08T18:00:00Z");
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/48 of 72 hours/);
  });

  it("passes at exactly the minimum gap", () => {
    expect(frequencyViolation(pullUps, history, "2000-03-09T18:00:00Z")).toBeNull();
  });

  it("ignores sessions after the proposed time", () => {
    const later = [{ completedAt: "2000-03-10T18:00:00Z", exerciseIds: ["pull-ups"] }];
    expect(frequencyViolation(pullUps, later, "2000-03-09T18:00:00Z")).toBeNull();
  });

  it("warns when the weekly cap would be exceeded", () => {
    const twoThisWeek = [
      { completedAt: "2000-03-06T18:00:00Z", exerciseIds: ["pull-ups"] }, // Monday
      { completedAt: "2000-03-09T18:00:00Z", exerciseIds: ["pull-ups"] }, // Thursday
    ];
    const v = frequencyViolation(pullUps, twoThisWeek, "2000-03-12T18:00:00Z"); // Sunday, 72h later
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/2 per week/);
  });

  it("resets the weekly count on Monday", () => {
    const twoLastWeek = [
      { completedAt: "2000-03-06T18:00:00Z", exerciseIds: ["pull-ups"] },
      { completedAt: "2000-03-09T18:00:00Z", exerciseIds: ["pull-ups"] },
    ];
    expect(frequencyViolation(pullUps, twoLastWeek, "2000-03-13T18:00:00Z")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `bun run test src/lib/recovery/__tests__/frequency.test.ts`
Expected: FAIL, cannot find module `../frequency`.

- [ ] **Step 3: Implement**

```ts
/**
 * Per-exercise frequency caps: a minimum gap in hours between sessions
 * that contain the exercise, and a maximum count per ISO week. The
 * pull-up rule (72 hours, twice a week) comes from the user's injury
 * history, not from any protocol. Where this runs is decided by the
 * screens spec; the function itself is pure.
 */

import type { AuthoringExercise, Verdict } from "./types";

export type SessionRecord = {
  /** ISO datetime with zone. */
  completedAt: string;
  exerciseIds: string[];
};

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Monday 00:00 UTC of the ISO week containing the datetime, as YYYY-MM-DD. */
export function isoWeekStart(datetime: string): string {
  const ms = Date.parse(datetime);
  const d = new Date(ms);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Monday = 0
  const mondayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dayOfWeek * MS_PER_DAY;
  const m = new Date(mondayMs);
  return `${m.getUTCFullYear()}-${String(m.getUTCMonth() + 1).padStart(2, "0")}-${String(m.getUTCDate()).padStart(2, "0")}`;
}

export function frequencyViolation(
  ex: AuthoringExercise,
  history: SessionRecord[],
  proposedAt: string,
): Verdict | null {
  if (ex.minHoursBetweenSessions === null && ex.maxSessionsPerWeek === null) {
    return null;
  }
  const proposedMs = Date.parse(proposedAt);
  const prior = history
    .filter((h) => h.exerciseIds.includes(ex.id))
    .map((h) => Date.parse(h.completedAt))
    .filter((t) => t <= proposedMs);

  if (ex.minHoursBetweenSessions !== null && prior.length > 0) {
    const last = Math.max(...prior);
    const hours = (proposedMs - last) / MS_PER_HOUR;
    if (hours < ex.minHoursBetweenSessions) {
      return {
        level: "warn",
        rule: 0,
        reason: `${ex.name}: ${Math.floor(hours)} of ${ex.minHoursBetweenSessions} hours since the last session`,
      };
    }
  }

  if (ex.maxSessionsPerWeek !== null) {
    const weekStart = isoWeekStart(proposedAt);
    const inWeek = prior.filter((t) => isoWeekStart(new Date(t).toISOString()) === weekStart).length;
    if (inWeek + 1 > ex.maxSessionsPerWeek) {
      return {
        level: "warn",
        rule: 0,
        reason: `${ex.name}: would be session ${inWeek + 1} this week, cap is ${ex.maxSessionsPerWeek} per week`,
      };
    }
  }

  return null;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun run test src/lib/recovery/__tests__/frequency.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Run the whole suite**

Run: `bun run test`
Expected: 123 passing across 8 files (63 + 4 + 10 + 10 + 10 + 19 + 7).

- [ ] **Step 6: Commit**

```bash
git add src/lib/recovery/frequency.ts src/lib/recovery/__tests__/frequency.test.ts
git commit -m "feat(recovery): hours-between and per-week frequency caps" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 14: Lint for duplicate declarations

**Files:**
- Modify: `eslint.config.mjs`

- [ ] **Step 1: Add the rule**

Replace the file with:

```js
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Two declarations of the same function passed every syntax check
    // in the prototype and broke at runtime. The TS-aware variant knows
    // about type and value merging, so it does not false-positive.
    rules: {
      "no-redeclare": "off",
      "@typescript-eslint/no-redeclare": "error",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
```

- [ ] **Step 2: Prove it catches the bug**

Create `src/lib/recovery/redeclare-probe.ts`:

```ts
export function logKey() {
  return "a";
}
export function logKey() {
  return "b";
}
```

Run: `bun run lint`
Expected: an error on `redeclare-probe.ts` naming `@typescript-eslint/no-redeclare` (TypeScript will also complain; either is fine, the lint line must appear).

If ESLint instead reports "Definition for rule '@typescript-eslint/no-redeclare' was not found", the Next config did not register the plugin under that name. Fall back to the core rule: set `"no-redeclare": "error"` and remove the `@typescript-eslint/no-redeclare` line, then re-run the probe.

Delete the probe: `rm src/lib/recovery/redeclare-probe.ts`

Run: `bun run lint`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add eslint.config.mjs
git commit -m "chore(lint): error on duplicate declarations" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 15: Infra, push, Notion seed, generated types

This task needs two things from the user before it starts: a go-ahead to create a Supabase project on the org `hzljxwsqimkojdzclaiz` (free tier), and the Notion integration key. Ask for both in one message. Do not proceed on either until answered.

**Files:**
- Create: `scripts/create-seed-user.ts`
- Modify: `.env.local.example`
- Modify: `package.json`
- Create: `.env.local` (gitignored, never committed)
- Create: `src/lib/supabase/database.types.ts`

- [ ] **Step 1: Auth user helper**

Create `scripts/create-seed-user.ts`:

```ts
/**
 * Create (or find) the single auth user the seeds write for, and print
 * its id for SEED_USER_ID. Idempotent.
 *
 * Run with:
 *   bun run user:create
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * SEED_USER_EMAIL in .env.local.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;

if (!url || !key || !email) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_EMAIL in .env.local",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await sb.auth.admin.listUsers({
  perPage: 1000,
});
if (listError) {
  console.error("listUsers failed:", listError.message);
  process.exit(1);
}

const existing = listed.users.find((u) => u.email === email);
if (existing) {
  console.log(`exists: ${existing.id}`);
  process.exit(0);
}

const { data: created, error: createError } = await sb.auth.admin.createUser({
  email,
  email_confirm: true,
});
if (createError || !created.user) {
  console.error("createUser failed:", createError?.message);
  process.exit(1);
}
console.log(`created: ${created.user.id}`);
```

- [ ] **Step 2: Env example and scripts**

In `.env.local.example`, under the `Seed config` block, before `SEED_USER_ID=`, add:

```
# Email for the auth user the seeds write for. `bun run user:create`
# creates it (or finds it) and prints the id to paste below.
SEED_USER_EMAIL=

# Database password chosen at project creation. Used by `supabase link`.
SUPABASE_DB_PASSWORD=
```

In `package.json` scripts, add:

```json
    "user:create": "bun run scripts/create-seed-user.ts",
    "db:types": "supabase gen types typescript --linked > src/lib/supabase/database.types.ts"
```

Run: `bunx tsc --noEmit` and `bun run lint`
Expected: clean.

Commit:

```bash
git add scripts/create-seed-user.ts .env.local.example package.json
git commit -m "chore: seed user helper and db:types script" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 3: Create the project**

Generate a password and create the project. Keep the password in `.env.local` only.

```bash
DB_PASS=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
supabase projects create workout-app \
  --org-id hzljxwsqimkojdzclaiz \
  --region ca-central-1 \
  --db-password "$DB_PASS"
echo "SUPABASE_DB_PASSWORD=$DB_PASS"
```

Expected: a line with the new project's reference id. Record it as `REF`.

- [ ] **Step 4: Link and fetch keys**

```bash
supabase link --project-ref REF --password "$DB_PASS"
supabase projects api-keys --project-ref REF
```

Expected: `anon` and `service_role` keys printed.

- [ ] **Step 5: Write `.env.local`**

Copy `.env.local.example` to `.env.local` and fill: `NEXT_PUBLIC_SUPABASE_URL=https://REF.supabase.co`, the anon and service-role keys, `SUPABASE_DB_PASSWORD`, `NOTION_API_KEY` from the user, `SEED_USER_EMAIL=suarez.milan@gmail.com`. The four `NOTION_*_DB` ids are already in the example. Leave `SEED_USER_ID` empty for now.

Run: `git status --short`
Expected: `.env.local` does not appear (it is gitignored).

- [ ] **Step 6: Push migrations**

Run: `supabase db push`
Expected: `0001` through `0005` applied in order, no errors. If one fails, fix the SQL, commit the fix, and run `supabase db push` again; a failed migration is not recorded as applied.

Verify in the dashboard or with:

```bash
supabase migration list
```

Expected: five local and five remote versions, all matched.

- [ ] **Step 7: Create the auth user**

Run: `bun run user:create`
Expected: `created: <uuid>`. Paste the uuid into `SEED_USER_ID` in `.env.local`.

- [ ] **Step 8: Run the Notion seed**

Run: `bun run seed:notion`
Expected: eight numbered stages, a row-count table, and `scripts/seed-report.json` written. The templates stage should report 18.

Open `scripts/seed-report.json` and note, for the user:
- `exercisesEquipmentOther`: names to hand-fix `equipment_type` on
- `templatesCategoryMissing`: templates the category inference missed
- `weightParseFailures`: Sessions rows with Notion URLs to clean
- `notionFieldsWarnings`: any duplicate-name slug suffixing

Run the seed a second time: `bun run seed:notion`
Expected: identical row counts. That is the idempotency check.

- [ ] **Step 9: Generate types**

```bash
mkdir -p src/lib/supabase
bun run db:types
```

Open `src/lib/supabase/database.types.ts` and confirm it contains `templates`, `template_exercises`, `programs`, `program_phases`, `recoveries`, `clearances` and the enums `support_type`, `load_direction`, `equipment_item`, `clearance_kind`.

Run: `bunx tsc --noEmit`
Expected: clean.

Commit:

```bash
git add src/lib/supabase/database.types.ts
git commit -m "chore(db): generated Supabase types" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 10: RLS smoke check**

With the anon key and no session, a select on a library table must return nothing, and on a per-user table must return nothing:

```bash
curl -s "https://REF.supabase.co/rest/v1/templates?select=id&limit=1" \
  -H "apikey: $NEXT_PUBLIC_SUPABASE_ANON_KEY"
```

Expected: `[]` (RLS allows `authenticated` only, and anon is not authenticated).

With the service-role key, the same select returns rows:

```bash
curl -s "https://REF.supabase.co/rest/v1/templates?select=id&limit=1" \
  -H "apikey: $SUPABASE_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
```

Expected: one row. A signed-in-user check waits for the auth UI in the screens plan.

- [ ] **Step 11: Report**

Tell the user: the project ref, the five migrations applied, the Notion row counts, and the four report lists from Step 8 with counts. Nothing else. The content plan starts from here.

---

## Self-review notes

Spec coverage, section by section:

| Spec section | Task |
|---|---|
| 3 Vocabulary and rename | 1, 3, 4 |
| 4.1 Enums | 5, 6, 7 |
| 4.2 exercises additions | 5; slug written by 2 and 3 |
| 4.3 templates.program_id, template_phases | 6 |
| 4.4 Dose columns, sets.seconds | 1 |
| 4.5 exercise_alternates.notes | 1 |
| 4.6 sources, programs, program_phases | 6 |
| 4.7 recoveries, clearances, events, rules, daily_checks | 7 |
| 4.8 user_settings.equipment_available | 5 |
| 4.9 RLS | 1, 6, 7; smoke check in 15 |
| 4.10 Migration files | 1, 5, 6, 7 |
| 5 Domain modules | 8 to 13 |
| 6 Authoring rules | 12 |
| 9 Testing: lint no-redeclare | 14 |
| 9 Testing: migrations push, RLS smoke | 15 |
| 10 Plan 0 infra | 15 |
| 10 Plan 1 | this document |

Not in this plan, by design: everything in spec section 7 (seed pipeline for Achilles data), section 8 (review and video verification), and the seed-data integrity tests in section 9. Those are the content plan, written after the review document exists. The spec's note that `0002` is edited for the rename turned out to be unnecessary; the views never referenced `programs`.

Type consistency checked: `AuthoringExercise`, `RestrictionState`, `Verdict`, `Clearance`, `EquipmentItem` are defined once in Task 8 and imported by name in Tasks 10 to 13. `TemplateForAuthoring` is defined in Task 12 and used only there. `Range` comes from `scripts/lib/parse-prescription.ts`, which already exists.
