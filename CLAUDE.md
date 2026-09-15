# Workout App

Personal workout tracker. Next.js 16 + React 19 + Supabase Postgres,
deployed as a PWA on Vercel. Mirrors `Personal/projects/nutrition-app/v1/`
(Plately) conventions.

## Commands

```bash
bun run dev              # Dev server (webpack, not Turbopack)
bun run build            # Production build
bun run test             # Vitest run, once
bun run test scripts/__tests__/migrations.test.ts   # migrations on PGlite only
bun run test:watch       # Vitest watch mode
bun run lint             # ESLint
bun run seed:notion      # One-time Notion -> Supabase seed
bun run seed:achilles    # Achilles program, exercises, templates, personal rows
bun run convert:ppl      # Vault workbook -> programme JSON (gitignored)
bun run seed:programs    # Every programme JSON -> programs, phases, templates
bun run icons:generate   # Re-render placeholder PWA icons
supabase db push         # Apply migrations to linked cloud project
```

The dev and build commands explicitly pass `--webpack` because
`@ducanh2912/next-pwa` ships a webpack config that conflicts with
Next 16's default Turbopack.

## Stack

- Next.js 16 + React 19 (App Router)
- Tailwind 4
- Supabase Postgres + Supabase Auth (no UI yet)
- TanStack Query
- @ducanh2912/next-pwa
- Sonner for toasts
- Vitest
- bun

No ORM. SQL migrations are the source of truth. Use the Supabase JS
client directly.

## House rules

- No em dashes in code, comments, or docs. Period or restructure.
- Conventional Commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`,
  `refactor:`, `test:`.
- Every Postgres table has RLS on.
- Library tables (muscle_groups, exercises, exercise_alternates,
  templates, template_exercises) read for any authenticated user.
- Per-user tables (workouts, workout_exercises, sets, user_settings)
  filter by `auth.uid()`.
- Parsers get tests before they hit real data.
- If a Notion field is ambiguous, log it. Do not guess.

## Key directories

- `src/app/` Next.js App Router pages.
- `scripts/` One-shot scripts (Notion seed, icon generator) plus the
  pure parser modules with their tests. Run via `bun run`.
- `scripts/lib/` Parsing helpers and the env loader.
- `supabase/migrations/` SQL migration files. Edit, then `supabase db push`.
- `public/` Static assets, PWA manifest, generated icons, service worker.
- `docs/` Planning notes and the original handoff prompt.

## Database

Source of truth lives in `supabase/migrations/`. Eighteen tables:

Library (any authenticated user reads; service role writes):
- `muscle_groups`, `exercises`, `exercise_alternates`
- `templates`, `template_exercises`, `template_phases`
- `programs`, `program_phases`, `sources`

Per user (RLS on `auth.uid()`):
- `workouts`, `workout_exercises`, `sets`, `user_settings`
- `recoveries`, `clearances` (insert-only; void is one-way), `events`,
  `rules`, `daily_checks`

Thirteen enums: `equipment_type`, `machine_location`, `template_category`,
`weight_unit`, `support_type`, `load_direction`, `equipment_item`,
`program_kind`, `source_kind`, `clearance_kind`, `clearance_source`,
`event_kind`, `rule_kind`.

Five analytics views in `0002_analytics_views.sql`, all with
`security_invoker = true` so RLS on underlying tables applies.

Vocabulary, top to bottom: Program (multi-week, has phases) > Template
(one day's prescription) > Workout (a template performed on a date) >
Set. The recovery layer (exercise authoring attributes in 0003, programs
and phases in 0004, recovery tables in 0005) is specified in
`docs/superpowers/specs/2026-09-14-achilles-recovery-design.md`.

Every seeded table has a `_notion_id` text column. It began as the
Notion upsert key and is now the ownership key for three seeds
(`template:` for Notion-derived templates, `achilles:` for the recovery
seed, `program:` for the programme seed), so each seed clears and
rewrites only its own rows. The column stays.

## Parsers

Six pure modules with full unit-test coverage:

- `scripts/parse-weight-csv.ts` Parse the Notion Sessions Weight CSV
  (`"50, 70, 90, 100(5), 100(4)"`) into structured set rows.
- `scripts/lib/parse-prescription.ts` Parse range strings like "3-5"
  and rest periods like "3 mins" or "3-4 mins"; treat a bare "-" as
  empty text.
- `scripts/lib/exercise-name.ts` Strip ↑↓ arrows for `machine_location`,
  infer `equipment_type` from name heuristics, default to `other`.
- `scripts/lib/template-name.ts` The 18 canonical template names plus
  category and variant inference from a template name.
- `scripts/lib/session-order.ts` Order a workout's Sessions rows by the
  workout page's relation, reversed, with unlisted rows appended.
- `scripts/lib/ppl-sheet.ts` Parse a programme workbook's rows (as
  arrays) into the programme JSON contract; returns the rows it could
  not place or dose alongside the programme, never drops them.

Run `bun run test` to exercise them. 234 tests across 15 files.

- `src/lib/recovery/` The recovery domain: dates, restriction state,
  dose parsing, the eleven authoring rules, frequency caps. Pure, no
  Supabase import.
- `scripts/__tests__/migrations.test.ts` Applies every migration on
  PGlite with Supabase roles stubbed.

## Notion seed

`scripts/seed-from-notion.ts` reads four Notion databases via the
@notionhq/client v5 API (using `dataSources.query`, not the legacy
`databases.query`). Writes to Supabase via the service-role key. The
Notion field names live in the `FIELDS` constant at the top; edit
those if your Notion DB uses different labels.

Templates are rebuilt from each canonical name's most recent Workouts
row because Notion page templates keep their prescription in a button
automation the API cannot read. The 18 canonical names and the
category and variant helpers live in `scripts/lib/template-name.ts`.

After running, check `scripts/seed-report.json` for row counts,
exercises that need a hand-fix on `equipment_type`, any Weight CSV
parse failures (with Notion URLs), and which instance each template
was rebuilt from.

## Achilles seed

`scripts/seed-achilles.ts` runs after the Notion seed and writes the
recovery program with its phases, the sources, the reviewed exercises
with every authoring input and the demonstration clips, the three
recovery templates with their phases, and the user's recovery row,
clearances, events, rules and available equipment. The per-user rows
come from `scripts/data/achilles/personal.local.json`, which is
gitignored; its shape lives in `personal.example.json` next to it.
Exercises match the library by slug: a matched row gets its authoring
inputs updated and keeps its name, group and Notion demo link unless
the seed carries a verified clip for it, and its existing alternates
are never overwritten (the seed only fills empty slots, corrects the
rows it wrote itself, and reports the ones it left alone). A template row that
knowingly breaks an authoring rule carries `override_rule` and
`override_reason`, so a conflict the user chose to keep is recorded on
the row rather than left silent.

Idempotent. After running, check `scripts/seed-achilles-report.json`
for row counts, which exercises matched versus inserted, alternate
slots kept as they were, unverified videos, rejected doses, and the
overrides recorded.

## Programmes

A training programme is blocks of weeks; each week has ordered days;
each day has ordered exercises with a prescription. That shape is the
JSON contract in `scripts/data/programs/schema.ts` (types plus
`validateProgramJson`) and `scripts/data/programs/example.json` is a
tiny made-up programme in it. Every seeded programme and, later, every
programme imported through the app arrives in this contract. Programme,
block and day names become seed keys, so they cannot contain a colon.

Programme content is copyrighted, so `scripts/data/programs/*.json` is
gitignored except the example and the seed loads whatever JSON files
are present. `bun run convert:ppl` reads the push-pull-legs workbook
from the vault (`Personal/raw/training/`) and writes its JSON; the
converter exits 1 and writes nothing when any exercise row could not
be placed or turned into a dose and prints every such row.

`bun run seed:programs` loads every programme JSON. It validates every
file and parses every dose before the first write, so a bad file fails
the run with nothing changed (the report is still written, so the
rejected doses are on disk), and it refuses a programme whose name
belongs to a row of another kind. One `programs` row per file; one
`program_phases` row per week with the block name in `block`; one
template per day per week, keyed `program:<programme>:<block>:<week>:<day>`
in `_notion_id`, with `variant` set to the week (`W1`, `W2`, ...) and
ordered inside its phase by `template_phases.position`.

Exercises match the library by slug, then by near-duplicate slugs
(singular or plural, `db`/`dumbbell`, `bb`/`barbell`); a row this seed
inserted never shadows a curated row. Unknown ones are inserted with
the equipment type the name implies, no muscle group and no authoring
inputs, stamped `program:exercise:<slug>`; a substitution is inserted
only when the seed will write its slot. The report's `handFix` field
lists every seed-owned exercise still at `other` or without a muscle
group, recomputed on every run. A seed-owned exercise that nothing
references any more is removed at the end of the run.

A programme's substitutions become alternates on the exercise row,
keyed `program:<programme>:<slug>:<position>`; a slot already holding a
Notion sub-option or another programme's alternate is left alone and
reported. For each loaded programme, its templates, phases and
alternates that the JSON no longer has are removed. The Notion-derived
templates (`template:` keys), the Achilles rows (`achilles:` keys) and
any programme not among the loaded files are never touched; orphaned
programmes and alternates are reported.

Idempotent. After running, check `scripts/seed-programs-report.json`
for row counts, exercises inserted versus matched (with the fuzzy
matches listed), exercises removed, `handFix`, alternates in place,
already matching, kept and removed, orphans and stale rows removed.

The other four Nippard PDFs in `Personal/raw/training/` are next. Each
gets its own converter or a hand-written JSON in the same contract, and
the same seed loads it without changes.

## What's done (Milestone 1)

- Scaffold + deps
- Schema migration with RLS
- Analytics views migration
- Notion seed script with verification report
- PWA manifest, icons, service worker config
- 63 parser tests passing (suite now 153)
- Production build clean

## What's next (Milestone 2)

- Auth UI (Supabase magic link)
- Screens per `docs/planning.md`: calendar home, template detail,
  active workout, history, exercise library, analytics, settings
- `_notion_id` stays: it is the ownership key for the three seeds
  (`template:`, `achilles:`, `program:`), not a temporary import column
