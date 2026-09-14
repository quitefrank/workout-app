---
project: workout-app
type: planning
status: ready-for-handoff
created: 2026-05-13
updated: 2026-05-13
templates: []
---

# Planning: Workout App V1

## The Decision

Build a Next.js plus Supabase PWA that absorbs the Notion workout database, fixes its structural problems, and adds proper logging and analytics. Personal use, multi-device, deployed to Vercel, embeddable from the portfolio site. Supabase is the source of truth after migration. Notion becomes a read-only archive.

## What's in Notion Today

Four linked databases under one parent page (`Workout Database`, id `ec3107d2-4380-47e5-b436-9ea70e3f3299`).

**Workouts** (id `caf5ffe0-0a2f-440f-bef5-6939ed6893fb`) holds 18 day-level templates and the session instances created from them. Calendar view is the primary view. Templates and instances share one table.

**Sessions** (id `6280dbb2-b2ec-42d0-aac9-64cda92580f3`) stores one row per exercise inside a workout. Auto-populated from the template at workout start: Warm Up, Sets, Reps, Rest, Exercise relation. The user manually fills in Weight per set as the workout happens.

**Exercises** (id `eba25da8-6d8b-4367-b2f1-a9048cb0b1c7`) is the master library. Around 100 plus entries with Name, Muscle Group relation, Notes, YouTube example URL, and self-relations Sub Option 1 and Sub Option 2 for alternatives. The ↑ and ↓ arrows on some exercise names encode upstairs and downstairs machine variants for the same physical movement.

**Muscle Groups** (id `766b3dad-3ead-4c3c-89dc-87607260c8df`) is a small lookup. Triceps, Chest, and similar, with a reverse relation back to Exercises.

## The Weight Field

The Sessions table stores Weight as a comma-separated list of per-set values. Two real examples from DB Bench Press (Flat):

- `"50, 70, 90, 160"` decodes as three warm-up sets at 50, 70, 90 lbs (matching `Warm Up = 3-4`) and one working set at 160 lbs (matching `Sets = 1`).
- `"50, 60, 70, 100(5), 100(4)"` decodes as three warm-ups, then 100 lbs for 5 reps and 100 lbs for 4 reps. The `(reps)` notation overrides the prescribed range for that specific set.

Set-level data is already in the existing data. The migration extracts it.

## The Structural Problem

Sets, Reps, and Weight are stored as text. Warm-up counts use ranges like "3-4". Templates and session instances share one table. Free weights and machines share the Exercises library even though machines need location context (upstairs vs downstairs labeling). The current setup works as a personal tracker because the user knows the conventions, but it cannot drive an app's analytics without parsing every row.

## V1 Scope

Five jobs the app does in V1.

1. **Calendar home.** Calendar view of scheduled and completed workouts, with quick-start from a template.
2. **Run a workout.** Auto-populate exercises and prescription from a program template, log each set with weight and reps, switch upstairs and downstairs context for machine exercises, mark complete.
3. **Browse the exercise library.** Search by name, filter by muscle group, see video example, see your last 4-8 performances.
4. **See history.** Past workouts list, drill into any workout, see what was logged set by set.
5. **See progress.** Per-exercise weight over time, per-exercise estimated 1RM, recent PRs, sessions per week.

## Out of Scope V1

Creating or editing programs in-app. Creating or editing exercises in-app. Alternates suggester UI. PR notifications. Apple Watch. HealthKit sync. Body weight log. Food logging. Social features. Native shell. All deferred to V2 or later.

## Stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 with React 19 | Matches Plately |
| Hosting | Vercel | One-command deploy, embed on the portfolio via iframe or subdomain |
| Database | Supabase Postgres | Free tier covers personal use, real relational schema |
| Auth | Supabase Auth (magic link) | Single user now, room for multi-user later |
| Client state | TanStack Query | Already in your stack |
| Styling | Tailwind 4 | Already in your stack |
| Components | shadcn/ui | Copy-in, customizable, no runtime dependency |
| PWA | `@ducanh2912/next-pwa` | Installs to iPhone home screen |
| Charts | Recharts | Lightweight React API |
| Toasts | Sonner | Already in your stack |
| Tests | Vitest | Already in your stack |
| Package manager | bun | Matches Plately |

No ORM. Use the Supabase JS client directly and keep schema in `supabase/migrations/` SQL files. Matches Plately and keeps the surface area small.

## Vocabulary

Database tables use neutral names. UI screens use the Notion vocabulary you already know.

| Database table | UI label | Notion source |
|---|---|---|
| `workouts` | Workout | Workouts (formerly Schedule) |
| `workout_exercises` | Exercises in a workout | Sessions (formerly Workouts) |
| `sets` | Set | Parsed from Weight CSV |
| `exercises` | Exercise | Exercises |
| `muscle_groups` | Muscle group | Muscle Groups |
| `templates` | Template | The 18 day templates |
| `template_exercises` | Prescribed exercise | Sessions rows attached to a template |

> Updated [2026-09-14]: `programs` was renamed to `templates`. "Program" now means a multi-week programme with phases (the recovery protocol first). See the recovery design spec.

## Data Model

Ten tables.

`muscle_groups`
- id (uuid, pk)
- name (text, unique)
- display_order (int)
- created_at, updated_at

`exercises`
- id (uuid, pk)
- name (text)
- muscle_group_id (fk muscle_groups)
- equipment_type (enum: barbell, dumbbell, machine, cable, bodyweight, cardio_machine, other)
- machine_location (enum: upstairs, downstairs, null). Set only for machine variants.
- notes (text)
- video_url (text)
- created_at, updated_at

`exercise_alternates`
- id (uuid, pk)
- exercise_id (fk exercises)
- alternate_exercise_id (fk exercises)
- position (int, 1 or 2)
- unique(exercise_id, position)

`programs`
- id (uuid, pk)
- name (text, e.g. "Push P1")
- category (enum: push, pull, legs, arms, full_body, cardio, abs)
- variant (text, e.g. "P1")
- tutorial_url (text)
- estimated_minutes (int)
- notes (text)
- created_at, updated_at

`program_exercises`
- id (uuid, pk)
- program_id (fk programs)
- exercise_id (fk exercises)
- position (int)
- prescribed_sets_min, prescribed_sets_max (int)
- prescribed_reps_min, prescribed_reps_max (int)
- prescribed_rest_seconds (int)
- prescribed_rpe (text)
- warm_up_sets_min, warm_up_sets_max (int)
- notes (text)

`workouts`
- id (uuid, pk)
- user_id (fk auth.users)
- program_id (fk programs, nullable for freestyle)
- machine_location (enum: upstairs, downstairs, null). Chosen at workout start, drives variant auto-selection.
- scheduled_for (date)
- started_at (timestamp, nullable)
- completed_at (timestamp, nullable)
- perceived_effort (int 1-10, nullable)
- notes (text)
- created_at, updated_at

`workout_exercises`
- id (uuid, pk)
- workout_id (fk workouts)
- exercise_id (fk exercises)
- position (int)
- prescribed_sets_min, prescribed_sets_max (int)
- prescribed_reps_min, prescribed_reps_max (int)
- prescribed_rest_seconds (int)
- prescribed_rpe (text)
- warm_up_sets_min, warm_up_sets_max (int)
- notes (text)
- created_at, updated_at

`sets`
- id (uuid, pk)
- workout_exercise_id (fk workout_exercises)
- set_number (int)
- is_warm_up (bool, default false)
- weight (numeric). Raw value with no unit conversion.
- reps (int)
- rpe (numeric, nullable)
- notes (text)
- completed_at (timestamp)

`user_settings`
- user_id (fk auth.users, pk)
- weight_unit (enum: lbs, kg, default: lbs)
- default_rest_seconds (int, default 180)
- default_machine_location (enum: upstairs, downstairs, null)
- created_at, updated_at

Display logic for weight values: if the exercise's `equipment_type` is `machine` or `cardio_machine`, render the number with no unit (it's the raw machine reading). Otherwise render with the user's preferred unit from `user_settings.weight_unit`.

Row-level security on every table, filtering by `auth.uid()`. Single-user for now, with the boundary already in place.

## Analytics

Five aggregations the analytics screens need. All are SQL views, not application code. None of them try to sum weight across exercises with different equipment types, which keeps machine stack numbers and free-weight pounds from being mathed together into a meaningless total.

- **Per-exercise tonnage per workout.** Sum of `weight × reps` across non-warm-up sets, grouped by workout and exercise. Meaningful within an exercise's history.
- **Per-exercise top set per workout.** Highest `weight × reps` set per workout per exercise. Drives the "last 4-8 sessions" view.
- **Per-exercise estimated 1RM per workout.** Epley formula on the top working set: `weight × (1 + reps / 30)`. Plotted over time.
- **Sets per muscle group per week.** Count of non-warm-up sets grouped by ISO week and muscle group, no weight component. Cross-exercise but unit-safe.
- **Workouts per week.** Count where `completed_at is not null`, grouped by ISO week.

## Migration Plan

One-time pull from Notion. Library, programs, and populated historical sessions all import. Notion becomes a read-only archive afterward.

| Notion source | Destination |
|---|---|
| Muscle Groups table | `muscle_groups` rows |
| Exercises table | `exercises` rows (parse ↑ and ↓ for `machine_location`, infer `equipment_type` from name where possible, default to `other` for hand-fix) |
| Exercises Sub Option 1, Sub Option 2 | `exercise_alternates` rows |
| Workouts rows without a `Date Done` value (the 18 templates) | `programs` rows |
| Sessions rows whose Workout relation points to a template page | `program_exercises` rows |
| Workouts rows with a `Date Done` value (session instances) | `workouts` rows |
| Sessions rows whose Workout relation points to a session instance | `workout_exercises` rows |
| Sessions Weight CSV per row | Multiple `sets` rows per workout_exercise |
| Sessions rows with empty Weight | Skipped (no data to migrate) |

Script location: `scripts/seed-from-notion.ts`. Uses the Notion API key from `.env.local`, walks the four databases, writes to Supabase via the JS client with the service role key. Idempotent via a temporary `_notion_id` column on each table; the column gets dropped after the first successful import.

Parsing rules for Notion's text fields:

- `"3-5"` reps becomes `prescribed_reps_min=3, prescribed_reps_max=5`
- `"3"` reps becomes both min and max = 3
- `"3-4"` warm-up becomes `warm_up_sets_min=3, warm_up_sets_max=4`
- `"3-4 mins"` rest becomes 210 seconds (range midpoint converted)
- `"3 mins"` rest becomes 180 seconds
- Empty fields become null

Parsing rules for the Weight CSV:

- Split on `,` and trim whitespace.
- The first N values are warm-up sets, where N is `warm_up_sets_max` (use the upper bound of the range).
- The remaining values are working sets.
- `100(5)` means `weight=100, reps=5` for that specific set.
- `100` (no parentheses) means `weight=100, reps=` the midpoint of the prescribed reps range.
- Each value becomes one `sets` row with the appropriate `set_number`, `is_warm_up`, `weight`, and `reps`.

The script logs every row that fails to parse with the Notion URL. Those get hand-fixed before the next run.

## Screen Specs (V1)

Mobile-first. Desktop is a wider variant of the mobile layout.

**`/`** Calendar home
- Month calendar with completed workouts marked
- Today highlighted, with the scheduled workout if one exists
- "Start a workout" CTA opens a program picker
- Below the calendar: last completed workout summary card

**`/programs`** Program list
- Grid of 18 program cards grouped by category
- Tap a card to view detail

**`/programs/[id]`** Program detail
- Program name, category, estimated time, tutorial video URL
- List of prescribed exercises with sets, reps, rest, warm-up
- "Start workout" CTA

**`/workouts/new?program=[id]`** Start workout
- Confirms which program is selected
- Asks for machine location (upstairs, downstairs, skip) before starting
- Creates the workout and workout_exercises rows from the template
- Redirects to active workout

**`/workouts/[id]`** Active workout (the main screen)
- Header: program name, elapsed time, machine location toggle
- Exercise list as collapsible cards in prescribed order
- Active exercise card expanded with set rows: weight input, reps input, "Log set" button, rest timer auto-starts after log
- Warm-up sets and working sets visually separated
- Quick log mode: paste a CSV like `50, 70, 90, 160` to log a whole exercise at once
- Sticky footer: "Complete workout" button

**`/workouts`** History
- Reverse chronological list of completed workouts
- Tap to see detail
- Filter by program name

**`/workouts/[id]/summary`** Workout detail (read-only)
- All sets logged, by exercise, with weight and reps
- Per-exercise tonnage
- Any PRs hit

**`/exercises`** Library
- Search input
- Filter chips by muscle group
- List of exercises with last-performance badge ("Last: 160 × 4")
- Tap to detail

**`/exercises/[id]`** Exercise detail
- Name, muscle group, equipment type, video embed
- Last 8 performances (date, top working set)
- Lifetime PR (weight and estimated 1RM)
- Alternates list (if any)

**`/analytics`** Charts
- Per-exercise weight over time (pick an exercise, see top working set per workout)
- Per-exercise estimated 1RM over time
- Sets per muscle group per week (stacked bar, last 12 weeks)
- Workouts per week (line, last 12 weeks)
- Recent PRs (list, last 30 days)

**`/settings`** Settings
- Unit toggle (lbs / kg) for free-weight display
- Default rest seconds
- Default machine location
- Sign out

## Counter-View

The strongest argument against this plan is that native iOS would unlock Apple Watch and HealthKit, which materially improve the in-gym experience. Watch logging from the wrist beats pulling out a phone between sets. The trade-off is real, and a V2 native shell wrapping the same Supabase backend is the right exit ramp if the PWA proves the model.

The second concern is the Weight CSV parser. Old entries may have inconsistent formatting (extra spaces, semicolons instead of commas, weight ranges like "100-110", or notes appended like "100 to failure"). Plan for parse failures, log them with their Notion URLs, and accept a manual cleanup pass in Notion before re-running the seed.

The third concern is the equipment_type field. Inferring it from exercise name during the migration will miss edge cases. Default to `other` when uncertain, and hand-fix the library after the first import. Worth the small chore because equipment type drives unit display logic.

## Open Questions for V2

- Body weight tracking with a daily log and chart
- Apple Health write-back
- Custom programs (build your own in-app)
- Alternates suggester UI ("you're upstairs, want the upstairs version?")
- Rest day vs workout day differentiation on the calendar
- Export to CSV
- Native shell via Capacitor for App Store distribution
- Plate calculator for barbell loading
