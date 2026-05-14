---
project: workout-app
type: handoff-prompt
created: 2026-05-13
updated: 2026-05-13
---

# Workout App: Claude Code Handoff Prompt

Create `Personal/projects/workout-app/`, initialize a GitHub repo there, open the folder in Claude Code, and paste everything below the line as the opening message.

---

## Project Context

I'm building a personal workout tracker as a PWA. Full planning lives at `~/Claude/Personal/outputs/workout-app/planning.md`. Read that first end to end.

The stack matches Plately at `~/Claude/Personal/projects/nutrition-app/v1/`. Same conventions, same package versions where possible: Next.js 16, React 19, Supabase JS client, TanStack Query, Sonner, `@ducanh2912/next-pwa`, framer-motion, tailwind-merge, clsx, Tailwind 4, Vitest, TypeScript, bun.

Supabase is the source of truth after migration. Notion is a one-time data source and becomes a read-only archive afterward.

## Milestone 1: Scaffold, Database, Seed

Six deliverables. No UI screens yet.

1. **Project scaffold.** Run `bun create next-app@latest .` with TypeScript, App Router, Tailwind, ESLint. Install the dependencies above. Configure PWA with `@ducanh2912/next-pwa` so the manifest and service worker work on iOS.

2. **Supabase setup.** Create a `supabase/` folder with `config.toml` and `migrations/`. Use Supabase CLI for local dev. Document the env vars in `.env.local.example`: Supabase URL, anon key, service role key, Notion API key.

3. **Schema migration.** Write `supabase/migrations/0001_initial_schema.sql` with all ten tables from `planning.md`: `muscle_groups`, `exercises`, `exercise_alternates`, `programs`, `program_exercises`, `workouts`, `workout_exercises`, `sets`, `user_settings`. Add a temporary `_notion_id text` column on every table for idempotent migration upserts. Include row-level security policies on every table filtering by `auth.uid()`. Write the five analytics SQL views in a second migration file `0002_analytics_views.sql`.

4. **Notion seed script.** Write `scripts/seed-from-notion.ts`. Reads four Notion databases by ID and writes to Supabase using the service role key. Database IDs:
   - Muscle Groups: `766b3dad-3ead-4c3c-89dc-87607260c8df`
   - Exercises: `eba25da8-6d8b-4367-b2f1-a9048cb0b1c7`
   - Workouts (formerly Schedule; templates plus session instances): `caf5ffe0-0a2f-440f-bef5-6939ed6893fb`
   - Sessions (formerly Workouts; per-exercise rows): `6280dbb2-b2ec-42d0-aac9-64cda92580f3`

   Migration mapping is in the planning doc's "Migration Plan" section. Key rules:
   - Workouts rows without a `Date Done` value become `programs` rows. The 18 templates are these.
   - Workouts rows with a `Date Done` value become `workouts` rows.
   - Sessions rows whose Workout relation points to a template become `program_exercises` rows.
   - Sessions rows whose Workout relation points to a session instance become `workout_exercises` rows, with the Weight CSV parsed into multiple `sets` rows per the rules below.
   - Sessions rows with empty Weight are skipped entirely.

   Parse the Exercises table for the `↑` and `↓` arrow notation in names. Strip the arrow, set `machine_location = upstairs` for `↑` or `downstairs` for `↓`, and leave it null otherwise. Infer `equipment_type` from name heuristics where possible (DB = dumbbell, BB = barbell, "machine" or "cable" in name = those types, "row" or "elliptical" = cardio_machine); default to `other` when uncertain.

5. **Weight CSV parser.** This is the trickiest piece. Implement in `scripts/seed-from-notion.ts` with unit tests in `scripts/__tests__/parse-weight-csv.test.ts` using Vitest. Rules:
   - Split the Weight string on `,` and trim whitespace per value.
   - The first N values are warm-up sets, where N is `warm_up_sets_max` parsed from the Warm Up field's range upper bound.
   - The remaining values are working sets.
   - A value like `100(5)` parses as `weight=100, reps=5`. A bare `100` parses as `weight=100, reps=` midpoint of the prescribed reps range from the linked program_exercise (or the Sessions row's own Reps field if present).
   - Log any value that doesn't parse cleanly. Continue with the rest of the row.

6. **Verify.** After seeding, run a Supabase query that reports:
   - Row counts: muscle_groups, exercises, programs, program_exercises, workouts, workout_exercises, sets
   - Number of exercises with `equipment_type = other` (these need hand-fix)
   - Number of exercises with non-null `machine_location` (these are the ↑↓ variants)
   - Number of Notion Sessions rows that failed to parse Weight CSV, with their Notion URLs

## What Not to Build in Milestone 1

No screens. No auth UI. No API routes for the app. No analytics page. Scaffold, DB, seed only. Milestone 2 designs screens once the data shape is real.

## Reporting at the End of Milestone 1

Tell me:
- Actual row counts after seeding (all eight data tables)
- The exercises flagged as `equipment_type = other` for hand-fix
- The Notion Sessions URLs that failed Weight CSV parsing
- The exact local dev command (`bun dev` or similar)
- The Vercel deploy command for when I'm ready to push

Then stop and wait for Milestone 2 direction.

## House Rules

- No em dashes in code, comments, or docs.
- Match Plately's file structure and naming where it makes sense.
- Use the Supabase JS client directly. No ORM.
- Every Postgres table has RLS on.
- Keep commits small and atomic. Conventional Commit prefixes (`feat:`, `chore:`, `fix:`).
- The Weight CSV parser gets unit tests before the seed script runs against real data.
- If a Notion field is ambiguous, log it instead of guessing.

## Reference Files to Open First

- `~/Claude/Personal/outputs/workout-app/planning.md` (full plan)
- `~/Claude/Personal/projects/nutrition-app/v1/package.json` (stack reference)
- `~/Claude/Personal/projects/nutrition-app/v1/supabase/` (migration pattern reference)
