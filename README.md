# Workout

Personal workout tracker. Replaces a four-table Notion database with a
typed Postgres schema, a PWA that installs to the iPhone home screen,
and per-set logging that drives real progress charts.

Single user, single deployment, single source of truth (Supabase).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 + React 19 (App Router) |
| Hosting | Vercel |
| Database | Supabase Postgres |
| Auth | Supabase Auth (magic link, not yet wired) |
| Client state | TanStack Query |
| Styling | Tailwind 4 |
| Components | shadcn/ui (added per-screen) |
| PWA | `@ducanh2912/next-pwa` |
| Toasts | Sonner |
| Tests | Vitest |
| Package manager | bun |

Mirrors the conventions in `Personal/projects/nutrition-app/v1/` (Plately).

## Status

**Milestone 1 (current).** Scaffold, database schema, Notion seed script,
PWA shell. No screens. No auth UI. No analytics page.

Run `bun run build` to confirm the project compiles. Run `bun test` to
exercise the parsers (63 tests across the three parsing modules).

**Milestone 2 (next).** Screens: calendar home, active workout, template
detail, exercise library, history, analytics.

## Local development

```bash
# Install dependencies
bun install

# Generate placeholder PWA icons (already committed, only needed if you change the design)
bun run icons:generate

# Run the dev server
bun run dev

# Run tests
bun run test
bun run test:watch

# Production build
bun run build
```

The dev server uses webpack (not Turbopack) because `@ducanh2912/next-pwa`
injects a webpack config. PWA features only activate in the production
build; `bun run dev` runs without a service worker.

The migration test applies every file in `supabase/migrations/` to an
in-process Postgres (PGlite) with Supabase's roles stubbed, so schema
mistakes fail here before `supabase db push`.

## Environment

Copy `.env.local.example` to `.env.local` and fill in the keys. The seed
script reads from Notion and writes to Supabase using the service-role key.

You will need:
- A Supabase project (URL, anon key, service-role key)
- A Notion internal integration with read access to the Workout Database
- Your Supabase `auth.users` id, captured after signing in once

## Database

Source of truth lives in `supabase/migrations/`.

```bash
# Push migrations to the linked Supabase project
supabase link --project-ref <your-ref>
supabase db push

# Reset local schema (DANGER: drops data)
supabase db reset
```

The schema has nine tables, four enums, RLS on every table, and five
analytics views. See `supabase/migrations/0001_initial_schema.sql` and
`supabase/migrations/0002_analytics_views.sql`.

Library tables (`muscle_groups`, `exercises`, `exercise_alternates`,
`templates`, `template_exercises`) allow reads by any authenticated user.
Per-user tables (`workouts`, `workout_exercises`, `sets`,
`user_settings`) filter by `auth.uid()`.

## Notion seed

```bash
bun run seed:notion
```

Reads the four Notion databases and writes to Supabase via the service
role. Idempotent: each table has a temporary `_notion_id` column the
script upserts on. After the first successful import, the column can be
dropped (Milestone 2 will do this).

The seed writes a verification report to `scripts/seed-report.json` with:
- Row counts per table
- Exercises flagged `equipment_type=other` (need a hand-fix)
- Exercises with `machine_location` set
- Notion Sessions rows whose `Weight` field failed to parse, with their Notion URLs
- Templates whose category could not be inferred from the name
- Notion field warnings, including exercise-name slug collisions, which are written with a numeric suffix and reported with both page URLs so the duplicate can be fixed in Notion

The Weight CSV parser lives at `scripts/parse-weight-csv.ts` with full
test coverage in `scripts/__tests__/parse-weight-csv.test.ts`.

## Project structure

```
.
├── .env.local.example          # template for local env vars
├── docs/                       # planning, handoff prompt, README snapshot
├── public/                     # static assets + PWA manifest + generated icons
├── scripts/
│   ├── parse-weight-csv.ts     # pure parser, used by seed
│   ├── seed-from-notion.ts     # one-time Notion -> Supabase migration
│   ├── generate-icons.ts       # placeholder PWA icon generator
│   ├── lib/
│   │   ├── env.ts              # env var loader and validator
│   │   ├── parse-prescription.ts # parse "3-5", "3 mins" etc
│   │   └── exercise-name.ts    # parse ↑↓ arrows, infer equipment_type
│   └── __tests__/              # Vitest unit tests for the parsers
├── src/
│   └── app/                    # Next.js App Router
│       ├── layout.tsx          # root layout + PWA metadata + viewport
│       └── page.tsx            # M1 placeholder
├── supabase/
│   ├── config.toml             # supabase CLI local config
│   └── migrations/
│       ├── 0001_initial_schema.sql
│       └── 0002_analytics_views.sql
├── next.config.ts              # PWA wrapper
├── package.json
└── vitest.config.ts
```

## House rules

- No em dashes in code, comments, or docs. Use a period or restructure.
- Conventional Commit prefixes: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`.
- Every Postgres table has RLS on.
- No ORM. Use the Supabase JS client directly.
- The Weight CSV parser gets unit tests before any seed runs against real data.
- If a Notion field is ambiguous, log it instead of guessing.

## License

Private. Personal project.
