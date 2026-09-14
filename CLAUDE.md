# Workout App

Personal workout tracker. Next.js 16 + React 19 + Supabase Postgres,
deployed as a PWA on Vercel. Mirrors `Personal/projects/nutrition-app/v1/`
(Plately) conventions.

## Commands

```bash
bun run dev              # Dev server (webpack, not Turbopack)
bun run build            # Production build
bun run test             # Vitest run, once
bun run test:watch       # Vitest watch mode
bun run lint             # ESLint
bun run seed:notion      # One-time Notion -> Supabase seed
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

Source of truth lives in `supabase/migrations/0001_initial_schema.sql`.

Nine tables:
- `muscle_groups`, `exercises`, `exercise_alternates` (library, global)
- `templates`, `template_exercises` (day templates, global)
- `workouts`, `workout_exercises`, `sets` (per-user logs)
- `user_settings` (per-user preferences)

Vocabulary, top to bottom: Program (multi-week, has phases) > Template
(one day's prescription) > Workout (a template performed on a date) >
Set. Programs and the recovery tables arrive in migrations 0003 to
0005; see `docs/superpowers/specs/2026-09-14-achilles-recovery-design.md`.

Four enums: `equipment_type`, `machine_location`, `template_category`,
`weight_unit`.

Five analytics views in `0002_analytics_views.sql`, all with
`security_invoker = true` so RLS on underlying tables applies.

Every seeded table has a temporary `_notion_id` text column for
idempotent upserts. Drop these in Milestone 2 once the migration is
known good.

## Parsers

Three pure modules with full unit-test coverage:

- `scripts/parse-weight-csv.ts` Parse the Notion Sessions Weight CSV
  (`"50, 70, 90, 100(5), 100(4)"`) into structured set rows.
- `scripts/lib/parse-prescription.ts` Parse range strings like "3-5"
  and rest periods like "3 mins" or "3-4 mins".
- `scripts/lib/exercise-name.ts` Strip ↑↓ arrows for `machine_location`,
  infer `equipment_type` from name heuristics, default to `other`.

Run `bun run test` to exercise them. 63 tests across 3 files.

## Notion seed

`scripts/seed-from-notion.ts` reads four Notion databases via the
@notionhq/client v5 API (using `dataSources.query`, not the legacy
`databases.query`). Writes to Supabase via the service-role key. The
Notion field names live in the `FIELDS` constant at the top; edit
those if your Notion DB uses different labels.

After running, check `scripts/seed-report.json` for row counts,
exercises that need a hand-fix on `equipment_type`, and any Weight
CSV parse failures (with Notion URLs).

## What's done (Milestone 1)

- Scaffold + deps
- Schema migration with RLS
- Analytics views migration
- Notion seed script with verification report
- PWA manifest, icons, service worker config
- 63 unit tests passing
- Production build clean

## What's next (Milestone 2)

- Auth UI (Supabase magic link)
- Screens per `docs/planning.md`: calendar home, template detail,
  active workout, history, exercise library, analytics, settings
- Drop the `_notion_id` columns once migration is verified
