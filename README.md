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
exercise the parsers (63 parser tests across the three parsing modules
(the suite is now 153 with the recovery domain and migration tests)).

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

The migration test applies every file in `supabase/migrations/` to an
in-process Postgres (PGlite) with Supabase's roles stubbed, so schema
mistakes fail here before `supabase db push`.

The schema has eighteen tables, thirteen enums, RLS on every table, and
five analytics views. See `CLAUDE.md` for the full list of tables and
enums.

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

Templates are rebuilt from each canonical name's most recent Workouts
row because Notion page templates keep their prescription in a button
automation the API cannot read. The canonical names live in
`scripts/lib/template-name.ts`.

The seed writes a verification report to `scripts/seed-report.json` with:
- Row counts per table
- Exercises flagged `equipment_type=other` (need a hand-fix)
- Exercises with `machine_location` set
- Notion Sessions rows whose `Weight` field failed to parse, with their Notion URLs
- Templates whose category could not be inferred from the name
- The instance each template was rebuilt from (date, URL, exercise count), and any canonical template with no instance at all
- Workouts whose title matched no canonical template, Sessions rows that linked through the older `Workouts` relation, and Sessions rows with no parent workout
- Notion field warnings, including exercise-name slug collisions, which are written with a numeric suffix and reported with both page URLs so the duplicate can be fixed in Notion

The Weight CSV parser lives at `scripts/parse-weight-csv.ts` with full
test coverage in `scripts/__tests__/parse-weight-csv.test.ts`.

## Achilles seed

```bash
bun run seed:achilles
```

Runs after the Notion seed. Writes the recovery program and its phases,
the sources, the reviewed exercises with every authoring input and the
demonstration clips, the three recovery templates with their phases,
and the user's recovery row, clearances, events, rules and available
equipment. The per-user rows come from
`scripts/data/achilles/personal.local.json`, which is gitignored; its
shape lives in `scripts/data/achilles/personal.example.json`.

Exercises match the library by slug. A matched row gets its authoring
inputs updated and keeps its name, group and Notion demo link unless
the seed carries a verified clip for it, and its existing alternates
are never overwritten: the seed fills empty slots, corrects the rows it
wrote itself, and reports the ones it left alone. A template row that knowingly
breaks an authoring rule carries `override_rule` and `override_reason`,
so a conflict the user chose to keep is recorded on the row rather than
left silent.

Idempotent. The seed writes `scripts/seed-achilles-report.json` with
row counts, which exercises matched versus inserted, alternate slots
kept as they were, unverified videos, rejected doses, and the overrides
recorded.

## Project structure

```
.
├── .env.local.example          # template for local env vars
├── docs/                       # planning, handoff prompt, README snapshot
├── public/                     # static assets + PWA manifest + generated icons
├── scripts/
│   ├── parse-weight-csv.ts     # pure parser, used by seed
│   ├── seed-from-notion.ts     # one-time Notion -> Supabase migration
│   ├── seed-achilles.ts        # Achilles program, exercises, templates, personal rows
│   ├── data/achilles/          # committed seed data + gitignored personal.local.json
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
