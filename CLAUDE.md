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
bun run convert:ppl      # Vault workbook -> program JSON (gitignored)
bun run extract:pdfs     # Vault PDFs -> page dumps under scripts/data/programs/raw/ (gitignored; needs python3 with pdfplumber)
bun run convert:ppl1     # PPL 1.0 dump -> program JSON (gitignored)
bun run convert:powerbuilding   # Powerbuilding 4x dump -> program JSON (gitignored)
bun run convert:arm      # Arm Hypertrophy dump -> program JSON (gitignored)
bun run seed:programs    # Every program JSON -> programs, phases, templates
bun run icons:generate   # Re-render placeholder PWA icons
bun run art:muscles      # Notion muscle diagrams -> src/components/muscle-art/paths.ts
supabase db push         # Apply migrations to linked cloud project
```

The dev and build commands explicitly pass `--webpack` because
`@ducanh2912/next-pwa` ships a webpack config that conflicts with
Next 16's default Turbopack.

`extract:pdfs` shells out to `scripts/extract-pdf-tables.py`, which
needs pdfplumber on the system Python: `python3 -m pip install pdfplumber`.

## Stack

- Next.js 16 + React 19 (App Router)
- Tailwind 4
- Supabase Postgres, no sign-in (one user, server-only access)
- TanStack Query
- @ducanh2912/next-pwa
- Sonner for toasts
- DialKit (dialkit.dev, with motion) for live tuning controls; the Glass
  Lab loads its vanilla build from jsdelivr
- three 0.186.0 (`three/webgpu`, `three/tsl`) for the Glass Lab's
  renderer over the app
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

Fourteen enums: `equipment_type`, `machine_location`, `template_category`,
`weight_unit`, `support_type`, `load_direction`, `equipment_item`,
`program_kind`, `source_kind`, `clearance_kind`, `clearance_source`,
`event_kind`, `rule_kind`, `exercise_measure`.

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
seed, `program:` for the program seed), so each seed clears and
rewrites only its own rows. The column stays. The program seed also
stamps the muscle groups it adds (`program:muscle-group:<slug>`, so far
Forearms and Neck) when `LIBRARY_ATTRIBUTES` names one Notion never had.

### Grants (required on new tables from 2026-10-30)

Supabase stops auto-granting Data API access to new tables in `public` on
2026-10-30. Existing tables keep the grants they already have, so none of
the eighteen above needs changing. Every table created from here on needs
its grants in the same migration, or PostgREST answers permission denied
and the table is invisible to `supabase-js`.

Library table (any authenticated user reads, service role writes):

    grant select on public.<table> to authenticated;
    grant select, insert, update, delete on public.<table> to service_role;

Per-user table (RLS on `auth.uid()`):

    grant select, insert, update, delete on public.<table> to authenticated;
    grant select, insert, update, delete on public.<table> to service_role;

Do not grant to `anon`. Supabase's own example in the announcement includes
it, but no policy in this schema targets `anon`, so adding it would widen
access past what RLS expects.

A grant is not a policy. The grant says whether a role may touch the table
at all, the policy says which rows. Both are needed, and `service_role`
needs its grant even though it bypasses RLS.

The same deadline applies to `supabase db reset`, preview branches, and any
new project, since each one replays these migrations from scratch. Reset is
never run against `health` regardless, because that project also holds
meal-prep's `app_state` table.

## Parsers

Eleven pure modules with full unit-test coverage:

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
- `scripts/lib/ppl-sheet.ts` Parse a program workbook's rows (as
  arrays) into the program JSON contract; returns the rows it could
  not place or dose alongside the program, never drops them.
- `scripts/lib/exercise-variant.ts` Split a program spelling into the
  base exercise and its set type ("Bench Press (Top Set)"), drop a rep
  or seconds hint the dose already carries, and split an "A + B"
  superset cell into two rows.
- `scripts/lib/pdf-program.ts` Shared helpers for the PDF converters:
  read a page dump, collapse cells, title-case names and sentence-case
  notes, normalise rest, split RPE from %1RM, and turn sets and reps
  cells into a dose plus a note for what the dose cannot carry.
- `scripts/lib/ppl1-pdf.ts` Parse the PPL 1.0 dump: block from the
  cover pages, week from the "WEEK N: DAYS a-b" line, one table per day.
- `scripts/lib/powerbuilding-pdf.ts` Parse the Powerbuilding 4x dump:
  week from the page banner, one table per workout, option A for week
  10, the optional arm day appended to the odd weeks, "X OR Y" names
  split by `NAME_CHOICES`.
- `scripts/lib/arm-pdf.ts` Parse the Arm Hypertrophy dump: one page per
  week, three tables per page, tempo into the notes, decimal rest, and
  the four 0/0 rows dosed as an open-ended set.

Run `bun run test` to exercise them. 546 tests across 50 files.

- `src/lib/recovery/` The recovery domain: dates, restriction state,
  dose parsing, the eleven authoring rules, frequency caps. Pure, no
  Supabase import. Templates are ordered by training logic (biggest
  compound first, isolation after, core last); rule 8 keeps core in one
  block at the end. Floor transfers and bench transitions never order a
  template.
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

## Programs

A training program is blocks of weeks; each week has ordered days;
each day has ordered exercises with a prescription. That shape is the
JSON contract in `scripts/data/programs/schema.ts` (types plus
`validateProgramJson`) and `scripts/data/programs/example.json` is a
tiny made-up program in it. Every seeded program and, later, every
program imported through the app arrives in this contract. Program,
block and day names become seed keys, so they cannot contain a colon.

Program content is copyrighted, so `scripts/data/programs/*.json` is
gitignored except the example and the seed loads whatever JSON files
are present. The purchased sources (the Nippard workbook and PDFs)
live in `scripts/data/programs/sources/`, also gitignored, so they stay
with the project without ever entering the public repo; the vault's
`Personal/raw/training/` holds a second copy. `bun run convert:ppl`
reads the push-pull-legs workbook from `sources/` and writes its JSON;
the converter exits 1 and writes nothing when any exercise row could
not be placed or turned into a dose and prints every such row.

`bun run seed:programs` loads every program JSON. It validates every
file and parses every dose before the first write, so a bad file fails
the run with nothing changed (the report is still written, so the
rejected doses are on disk), and it refuses a program whose name
belongs to a row of another kind. One `programs` row per file; one
`program_phases` row per week with the block name in `block`; one
template per day per week, keyed `program:<program>:<block>:<week>:<day>`
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

A set type spelled into a name ("Bench Press (Top Set)", "DB Curl 21's",
"Cable Crossover Ladder") is split off by the converter: the row's
exercise is the base movement and `template_exercises.variant` carries
the set type, so history and alternates attach to one library row. A
workbook cell naming two movements with "+" becomes two rows sharing
the prescription.

`scripts/data/programs/library.ts` is the committed map from program
spellings to the library: `LIBRARY_ALIASES` sends a program slug to
the curated Notion row it really is (`bench-press` to
`bench-press-flat`), tried before near-duplicate matching; and
`LIBRARY_ATTRIBUTES` gives muscle group and equipment to the exercises
the seed inserts, applied to seed-owned rows on every run so a fresh
database ends up the same. A muscle group the table names that
`muscle_groups` lacks is inserted once as a seed-owned row (Forearms
and Neck, which Notion never had); a group already present is never
modified and none is ever deleted. The report lists `aliasMatches`,
`aliasesMissing`, `attributesApplied`, `attributesUnused` and
`muscleGroupsInserted`; `handFix` is now the seed-owned rows the table
does not cover.

A program's substitutions become alternates on the exercise row,
keyed `program:<program>:<slug>:<position>`; a slot already holding a
Notion sub-option or another program's alternate is left alone and
reported. For each loaded program, its templates, phases and
alternates that the JSON no longer has are removed. The Notion-derived
templates (`template:` keys), the Achilles rows (`achilles:` keys) and
any program not among the loaded files are never touched; orphaned
programs and alternates are reported.

Idempotent. After running, check `scripts/seed-programs-report.json`
for row counts, exercises inserted versus matched (with the fuzzy
matches listed), exercises removed, `handFix`, alternates in place,
already matching, kept and removed, orphans and stale rows removed.

Three Nippard PDFs in `scripts/data/programs/sources/` go through a
second pipeline into the same contract. `bun run extract:pdfs` runs
`scripts/extract-pdf-tables.py` (pdfplumber) over each PDF and writes
one page dump per file, text lines plus tables with cells as written,
to `scripts/data/programs/raw/` (gitignored). One tested parser per
program walks its dump (`scripts/lib/ppl1-pdf.ts`,
`powerbuilding-pdf.ts`, `arm-pdf.ts`, on the shared helpers in
`pdf-program.ts`) and one thin CLI per program (`convert:ppl1`,
`convert:powerbuilding`, `convert:arm`) writes the gitignored JSON,
exiting 1 on any row it could not dose. Names are title-cased from the
PDF's capitals, notes sentence-cased, a superset prefix ("A1:") becomes
a "Superset A" note, a percentage of 1RM becomes a "Load: 70% 1RM" note
and tempo becomes a "Tempo 2:0:1:0" note, so nothing the PDF wrote is
lost. What each became:

- PPL 1.0: 2 blocks, 16 weeks (8 per block, counted globally), 96 days
  (Legs, Push, Pull, twice a week), 704 rows.
- Powerbuilding 4x: 3 blocks (Powerbuilding weeks 1 to 9, Max Testing
  week 10, Deload week 11), 48 days, 320 rows. Odd weeks are four full
  body days plus the optional arm and pump day as a fifth; even weeks
  and the deload are Lower and Upper twice; week 10 is the three test
  days of option A (option B, for competitive powerlifters, is reported
  as omitted and not loaded).
- Arm Hypertrophy: 2 blocks of 4 weeks, 24 days (Arm Day, Supplemental
  A, Supplemental B), 144 rows. The four rows written as 0 sets and 0
  reps are an open-ended set to failure and are dosed `1 x AMRAP` with
  a note saying so.

`nippard-get-ready-manual.pdf` holds no program (gear checklist, 1RM
testing, nutrition) and stays a reference. `nippard-ultimate-ppl-4x.xlsx`
still goes through `convert:ppl`. The same seed loads all four JSONs
without changes.

## One exercise per movement, floor per row

An exercise is one library row, whatever floor it is done on (migration 0009, Frank's
call, 2026-11-04). `exercises.has_floors` says it can be done on either floor, and
the floor is a value on each logged row, `workout_exercises.machine_location`. Floors
are never separate exercises. Weights differ by floor, so PRs, charts and "last
time" are worked out per floor and never mix: `floorKey` in
`src/lib/workout/machine-location.ts` is the bucket. Each two-floor exercise has its
own floor in the workout, starting on the floor it was last done on; changing one
moves the workout's other two-floor exercises with nothing logged. The exercise
sheet and Progress show one floor at a time. The control is always the pop-up button
`src/components/floor-picker.tsx`: a segmented control switches the view (Frank's
rule, 2026-11-04), a pop-up button sets a value. In the sheet it sits under the tabs
and not on How to, which is the same on either floor. `scripts/data/merged-exercises.ts` stops
the Notion seed bringing the duplicates back.

## What a set measures

Each exercise says what a set records, `exercises.measure` (migration 0027, Frank's calls, 2026-11-09), and the active
workout shows only those controls: two steppers side by side, a lone one at the same half width and centred, three
across for a treadmill, or none, which hides the zone. "Last time", the Journal's Log It columns, the header's target
and a finished workout's set list (`summarizeLogged`; volume only for `weight_reps`) follow it.
`src/lib/workout/measure.ts` holds the fields, labels, steps and summaries (tested).

Two measures run a timer during the set (`src/lib/workout/set-timer.ts`, tested; the hook is
`src/app/workouts/[id]/set-timer.tsx`, stored in localStorage like rest, so it survives a reload). The pill's circle
shows Play, then Stop. A `hold` counts down its seconds in the controls zone (the rest arc, labelled Hold, ±15) and logs
itself at zero with a chime; Stop logs the seconds held so far. An `outdoor` run counts up in a Time card beside the
distance stepper (a `Readout`: a stepper card without the stepper) and Stop logs the time with the distance, which can
still be empty. Looking at another exercise meanwhile shows a Hold or Run capsule that goes back.

A stretch between sets stands in for rest (Frank's call, 2026-11-09). Nippard writes the pair as a lift and the static
stretch right after it, both notes opening "Superset A." (`stretchPairs` in `src/lib/workout/pairs.ts`, tested; a
template variant before a "·" is allowed). Logging a working set of the lift moves the screen to the stretch and starts
its hold with no rest; the logged stretch (at zero or on Stop) comes back for the lift's next set, and the lift's rest
applies only once the stretch has no sets left. Warm-ups skip the stretch. Supersets of two lifts are still not built.

| Measure | Controls | Examples |
|---|---|---|
| `weight_reps` | weight, reps | every loaded lift (the default) |
| `reps` | reps | push-ups, leg raises, chin-ups, dips, band work, active stretches |
| `weight_steps` | weight, steps (stored in reps) | Farmers Walks |
| `weight_time` | weight, time | Squat Walk-Out |
| `time` | time | Plank, Long-Lever Plank, elliptical, bike, rower |
| `hold` | none; the header reads "30s Pec Stretch" | static stretches; 30 s when no dose is written |
| `treadmill` | incline, speed, time | Warm up Walk, Treadmill Run, Max-Incline Walk |
| `outdoor` | distance, with time kept by the app | Outdoor Run, Warm up Run |

Steps per tap: weight 5 lb or 2.5 kg, reps 1, time 30 s, incline 0.5 %, speed 0.5 km/h, distance 0.5 km. Time is typed
as m:ss (a bare number is seconds). Incline, speed and distance are `sets` columns in %, km/h and km. A hold, a treadmill
or an outdoor run rests only when the prescription gives a rest. A loaded version of a bodyweight move is its own
Weighted row, so `reps` never hides a weight anyone uses. The seeds never touch `measure`; a change is a migration, and
a new exercise needs its measure set by hand.

Running is one family with two versions: Treadmill Run (`library:treadmill-run`, used by Run (indoor)) and Outdoor Run
(the Notion row, used by Run (outdoor)). A rerun of the Notion seed would point Run (indoor) back at the Notion row, so
redo that repoint if the seed is ever run again. Last time comes from the latest completed session with a working set,
not `v_workout_exercise_top_set`, which needs weight and reps.

## Drop sets

A drop set is a value on a logged set, `sets.is_drop_set`, for any exercise (Frank's call,
2026-11-05), never a separate exercise. It counts toward volume and is left out of the top
set, PRs and working-set progress. The active workout no longer marks drop sets or takes a Notion
Weight string (Frank's call, 2026-11-08, with the Ladder redesign); a logged drop set still shows as D
in the Journal, and `quickLog` stays in `actions.ts` unused. Migration 0010 merged Lat Pull-Downs (main) and (dropset), the
program seed's Lat Pulldown and Notion's Machine Pulldown into Lat Pulldown.
`KEEP_UNREFERENCED` in `scripts/data/programs/library.ts` names seed-owned exercises the
program seed must keep although nothing references them.

## Exercise families

An exercise is a family of versions (migration 0022, Frank's calls of 2026-11-05 to 2026-11-07, reviewed in the
Exercise Family Map prototype, https://claude.ai/artifact/WFJQXbSNNrbRp2iW93tkd9). `exercises.movement` is the family;
each row is one version, set apart by three choices: `option_equipment` (what carries the load, or a machine with its
own name, such as Smith Machine, Pec Deck, Hack Squat), `option_position` (the bench angle or how the body is set:
Incline, Preacher, Seated, Half-Kneeling) and `option_technique`, shown as **Variation** (grip, range, tempo, one side,
a named style). Equipment is the parent: it decides the positions, and equipment with position decides the variations.
`option_rank` orders the menus. Every row keeps its image, history and PRs, and a choice switches rows (`optionFor`
and `unavailableReason` in `src/lib/workout/movements.ts`, tested). `MovementPicker` shows the three as line items,
each the iOS 27 pop-up button with the measured menu morph (`src/components/pop-up-menu.tsx`, `.pop-menu` in
`globals.css`), and lists every version under "All versions". A choice the current equipment cannot do stays in its
menu, dimmed, with what it needs ("Needs Cable").

`title` is the version's display name, built as equipment, position, variation, exercise with defaults left out
(Flat, Standing, Standard, Bodyweight, and equipment when there is one): "Smith Machine Incline Bench Press". A named
machine stands in for the exercise ("Pec Deck"), and a few keep the name people say (Machine Chest Press, Arnold Press,
Chin-Up). `name` keeps the source spelling for search. The seeds never touch the family columns or `title`, so a
regrouping is a migration. A new version gets its title by hand.

Rules Frank set: a family can span muscle groups, but each row files under one main group (Conventional deadlifts
under Glutes, Romanian under Hamstrings). A set instruction is one exercise with its standard row (Cheat, Negative,
21s): `ALIAS_VARIANTS` in `scripts/data/programs/library.ts` keeps it on the program row. A variant the library keeps
as its own row goes there (`VARIANT_TARGETS`: Squeeze-Only pressdown, Stretch-Only overhead extension). Versions
in no program exist only where Frank named them (every bench position on each equipment, Floor only as Nippard
wrote it); fill no other gaps unless he asks. Rows stamped `library:` in `_notion_id` belong to no seed.

## Records

An exercise's chart and PRs are Heaviest Weight and One Rep Max. Best-set volume was removed (Frank's call, 2026-11-05):
volume is not a goal, and it ranks a set of 21 above a heavy set of 5. A workout's summary still shows its total. A rep
scheme such as 21s is reps on the set and a `variant` on the template row, never its own exercise.

## Naming: 1-Arm

An exercise name says "1-Arm", never "Single-Arm" (Frank's call, 2026-11-05). Names change and slugs stay, because
the program files keep Nippard's spelling and the seed matches on the slug; `name` in `LIBRARY_ATTRIBUTES` and in
`MERGED_EXERCISES` holds the display name through a re-seed. 1-Arm Cable Pulldown (migration 0016) is the cable
machine, half kneeling, and took Nippard's single-arm pulldown. 1-Arm Lat Pull-In is a different exercise.

## One row per exercise

A program's new name for an exercise the library already has is an alias, never a second row (migration 0017, Frank's
call, 2026-11-05): the same exercise goes in `LIBRARY_ALIASES`, and a row that differs by equipment or technique stays a
row in its movement. Nippard's cues often match a Notion note word for word, which is how these duplicates show up.

## Thumbnails: the main lift

A workout's, template's or program's row thumbnail is its main lift's illustration (Frank's call, 2026-11-08, from the
Nippard Covers review, https://claude.ai/artifact/UW134j66Qbj7f2SGVhKjCu): `WorkoutThumb` in
`src/components/workout-thumb.tsx`, on every list (Home's Workouts and Up Next, History, a program's weeks, Programs on
Templates, Choose Program, the start sheet). The tall cards on Templates show the main lift filling the card in place of
the colour gradient, with dark gradients for the name and label. The main lift is the first working lift that has an
illustration: `workingSlugs` in `src/lib/workout/workout-art.ts` drops the warm-up (Cardio and Stretches groups, and the
activation drills in `ACTIVATION_SLUGS`) unless the workout is nothing else, and `mainLift` takes the first drawn one. A
program's main lift comes from its first week. With nothing drawn, the lettered colour tile stays. The Nippard PDF photos
were reviewed and rejected: they are blue duotone or dark grayscale in the source.

## Following a program is optional

With no program followed, Home's Up Next is an empty state with Choose Program, which opens a sheet of
the training programs (`src/app/(home)/program-empty-state.tsx`). The app never requires one. The workout
that completes a program's last day stops following it (`stopFollowingIfEnded` in `actions.ts`), and Home
treats an ended program as none. Past completions are not scoped to a follow date, so following a program
you already finished ends it again; rerunning one needs a start date first.

## Recovery workouts removed

Frank is back to normal training. Migration 0011 removed the recovery program's templates and the
exercises only they used (his call, 2026-11-05), and `listPrograms` shows training programs only.
`seed:achilles` is retired and throws; `scripts/data/achilles/` and the sections below on the Achilles
seed and rehab templates describe what was removed. The recovery log (recoveries, clearances, events,
rules, the program row and phases) stays in the database.

## Rehab templates and following a program

The recovery program carries rehab templates (category `rehab`, from
migration 0008) beside its Push, Pull and Legs: one set per handout
phase, in `scripts/data/achilles/rehab-templates.ts` with their
exercises in `rehab-exercises.ts`. Authority order: treating surgeon,
physio, clinic handout, Willits Table E-1, anything else.

- Clinic templates (`needs_signoff` null): "Achilles Rehab, Weeks 2-6",
  "Weeks 6-8" and "Weeks 8-12" from the handout. "Weeks 8-12" holds the
  handout's resistance band with no dose (a test pins it) and runs in
  phases 7 and 8. The physio's sheet's rows were removed by Frank's call
  (2026-11-05).
- E3 Rehab templates (phases 1 to 5, running, strength tests) carry
  `needs_signoff` text and a cue on every row where E3 disagrees with
  the handout. The handout governs. Never merge E3 rows into a clinic
  template.
- A null dose in the seed writes an empty prescription. Never fill one
  in from another protocol. `parseDose` reads a hold with no set count
  ("45-60 sec") with `sets` null.
- `templates.source_id` and `templates.needs_signoff` say where a
  template comes from and what to ask before using it.

Following: `user_settings.active_program_id` is the program you
follow and `program_phase_position` a phase set by hand.
`src/lib/programs/` (pure, tested) works out today: a recovery phase
comes from the hand-set phase, else the clearance log while it is not
stale, else the calendar from day 0, and the screen also names the
phase a week behind when that differs. Rehab templates are listed every
day and never scheduled (no source gives a frequency); the other
templates in the phase rotate after the last one completed. A training
program runs its days in sequence after the last completed day.

The Achilles seed now deletes seed-owned templates the data no longer
names, unless a workout was logged from one (`staleTemplatesKept`).

## App

Single user, no sign-in, by choice. The browser never talks to Supabase:
server components read through `src/lib/data/queries.ts` and every write
is a server action in `src/app/actions.ts`, both on the service-role
client in `src/lib/supabase/server.ts` (server-only), with the user fixed
by `APP_USER_ID`. Because that client bypasses RLS, every query filters
by the user and every action checks the row belongs to them first. The
deployed URL is open: anyone who has it can read and log workouts.

Screens follow `docs/planning.md`, with three tabs: Home, Templates, Progress.
Home (`src/app/(home)/`, with History at `/workouts`) is the calendar, then
Workouts only when the selected day has something logged, then Up Next, then the
Library section. Starting a workout is the dock's + button, on every tab but the
active workout (`src/components/start-workout.tsx`): Apple's Glass Prominent (iOS 27
kit, `prominentMaterial` in `src/glass/presets.ts`), 62pt and 8pt from the bar. It
keeps its blue, outside the context rule (`data-glass-skip`). It opens the template
sheet, the program's next workout first. The sheet lives in the root layout, so a
pick closes it itself. The date header is
MyFitnessPal's (`src/app/week-calendar.tsx`): the title is the selected day
and opens the floating month panel (`month-panel.tsx`, Liquid Glass's menu
morph, measured; see `Templates/liquid-glass/liquid-glass-reference.md` in the
vault), and the week strip is one native sideways scroller with snap, Monday
first, as wide as every week since 1970 with only the weeks near the view
rendered. A swipe selects the same weekday once settled. Dots outside the
selected month load from `/api/calendar`. The selected day is in `?d=` and its
workouts are cards that open the workout.

The Library section lives in the `(home)` layout, not the page, because a day
tap re-renders the page only and the muscle art is about 150 KB of paths. It is
a search field over the muscle group cards. A card opens
`/exercises/group/[id]`, a list with a back arrow. An exercise row, there or in
search, opens the exercise's bottom sheet (`src/components/exercise-sheet.tsx`,
fetching `/api/exercises/[id]`): Summary, History, How to
(`exercise-detail.tsx`). Search loads its rows from `/api/exercises` when it
opens, so Home never fetches all 342. `/exercises` redirects to Home;
`/exercises/[id]` stays for links from templates, workouts and Progress, and
shows the same tabs. Exercise illustrations are `public/exercises/<slug>.webp` (red
highlight, Frank's call, 2026-11-05), added with `bun run images:import <folder>`,
which rewrites `src/lib/exercise-image-slugs.ts`. `src/components/exercise-art.tsx`
shows one on `--exercise-tile`, the same gray in light and dark (Frank's call,
2026-11-05), or the muscle group's art on the themed tile until it exists. Going back restores the screen's
scroll position (`src/components/app-scroller.tsx`). Templates has the 18 Notion
day templates (`program_id` null). Progress is `/analytics`. The active
workout (`/workouts/[id]`) is described under "Active workout" below. Delete has one place on a
finished workout: the trash button in the summary's top bar, opening a confirming sheet; the active
workout discards from its More menu. A finished workout's summary deletes (`deleteWorkout` in `actions.ts`, which refuses one in
progress). Pure helpers for dates, formatting and PRs live in
`src/lib/workout/` with tests.

Sheets are Apple's iOS 27 sheet (kit 27.0.1, `src/components/sheet.tsx`, values
in `src/lib/sheet-detent.ts`), fitted to their content by Frank's call
(2026-11-04), as Apple's `.height(_:)` detents allow. A sheet rests at its
content's height up to the large detent, and never shrinks while open, so tabs
stay under the finger; taller content scrolls. There is no medium stop, so a drag
only closes it. Below large: 6pt inset, 34pt top and 58pt bottom corners, a CSS blur with
transparency.
Large: edge to edge under the 62pt status bar, 38pt top corners, opaque. A focused
text field takes it to large. The confirming action is `SheetConfirm`.
A `thumbnail` makes the sheet open on it large (232pt), and scrolling the content
shrinks it into the kit's Activity View header (thumbnail, title and subtitle in
one row, close at the trailing edge), as the exercise sheet uses. The shrink
follows the finger, the large title rides up and fades while the small one fades
in where it rests, the close button never moves, and a header stopped halfway
settles on SwiftUI's smooth spring (Frank's call, 2026-11-07, from the Exercise
Sheet Hero prototype, https://claude.ai/artifact/4WWmpj6GS3aqRKhwm7eKur). Values
and geometry are pure and tested in `src/lib/sheet-hero.ts`. At the large detent
the content gets a minimum height so the shrink can always finish; a fitted sheet
never scrolls, so it stays large. Without a thumbnail a sheet has the kit's
toolbar (close, centred title, confirm).
The scrim is the kit's Overlays/Default (`--scrim-alpha`: 20% black, 48% in dark)
and covers the bars too. On the WebGPU path it is painted into the page, so the
bars' glass takes a `dim` uniform and its HTML symbols a brightness filter. Sheets,
menus and controls on them (the sheet's close button) are CSS on both paths, by
Frank's call (2026-11-04): the shader reads the page, so glass on a sheet showed
what was behind the sheet, and the sheet's frost looked blotchy. The release projection is hand-tuned, not measured, until a recording
exists.

The look is Liquid Glass Preset 1 from the Glass Lab V3 artifact. Sheets
use the lab's measured iOS sheet material as CSS (`.glass-sheet`). The rest runs two
ways.

With WebGPU, `src/glass/glass-stage.tsx` puts the lab's renderer over
the app. The HTML stays where it is for layout, taps and VoiceOver; an
opaque canvas sits over it with pointer events off and shows the page
painted from that HTML, with every `.glass` element outside a `.glass-sheet`
drawn by the lab's shader. `src/glass/paint/` walks the DOM into a
display list and paints it to a 2D canvas (`UNPAINTED` in
`display-list.ts` names what it skips: glass, the sheet, live elements,
the focused input, toasts). `src/glass/engine/` is the lab's GPU
surface: the content texture, the frosts, the glass and cast materials,
the top edge effect and the context rule on the page's own pixels. The
rule's brightness grid is a box average of the raw page on the GPU, read
back asynchronously; never read the canvas back synchronously, which
stalls every scroll frame on the GPU. Values come from
`src/glass/presets.ts`, copied from the lab's database row; change them
only by copying a newer row. The stage adds `gpu` to `<html>` once every
glass element on screen has its shaders built, and removes it on any
failure, so the CSS material holds the screen until then. A lost device
gets one fresh start. A resize restarts the stage only when the width or
the pixel ratio changes; the canvas is sized to the large viewport
(`100lvh`), so Safari's toolbar collapsing only repaints.

Both paths use the same properties, and a fallback change is measured against the
shader at 4x (rules in `Templates/liquid-glass/liquid-glass-reference.md` in the
vault).

Without WebGPU (or before the stage is ready) the CSS material carries
it: `.glass` in `globals.css`, dark and light, with blur, haze, fills,
rim, inner shadows and outer ring, and `src/components/glass-context.tsx`
runs the context rule by sampling the DOM. Both paths share the rule's
numbers (`CTXV` in `presets.ts`, `decideDark` in `src/glass/context.ts`).
The CSS lives in `@layer components` so Tailwind utilities on the same
element win; keep new global rules layered too.

Under `html.gpu`, anything the canvas must not cover needs a z-index
above 5: glass in the page's flow is lifted to 6, live elements carry
`data-live`, and the sheet keeps z-50 over its scrim (`data-scrim`). A
`data-live` input is the exception: it is painted at rest, so it scrolls
with its box, and lifted over the canvas only while it has focus. Its
value is in the stage's signature, so a value set by script repaints.

The tab bar's selection is iOS 26's lens, read off Frank's screen
recording, measured frame by frame (`docs/lab/glass-presets.md`, Tab
lens). Four springs: the lens's place (critically damped, no overshoot);
its lift, held while touched or still more than 4px from its tab, which
scales it both ways to about 1.3x and turns it clear above about 1.1x;
the bar's swell, which follows the finger alone, so on a tap the bar has
deflated before the lens lands; and a small dip of the bar as the lens
drops back in. A drag past 6pt carries the lens under the finger and
selects the nearest tab on release, navigating at once. The motion is
pure and tested in `src/lib/tab-lens.ts` (the tests replay the recorded
tap and check its timings), whose `LENS` values are the
lab's Tab lens dials (copy a tuned row there). `tab-bar.tsx` steps it in
its own animation frame loop, which stops once the lens settles, and
writes each frame to `src/glass/lens-state.ts`. Each tab is drawn twice,
once in the bar's ink and once in the tint clipped to the lens, so a
lens half over a tab tints half of it. On the CSS path that is all
there is (the lens is `[data-tab-lens]`, the swell a `scale` on the
bar). On the WebGPU path the stage's tabs layer (`src/glass/engine/tabs.ts`)
draws the capsule, the lens and the ink from one mask of the tabs'
symbols and labels, magnified and split at the rim inside the lens, and
`html.tabs-gpu` makes the HTML ink transparent, kept for taps and
VoiceOver. Taps still select through the tab's link.

The rule behind every drift fix: nothing in the scrolling content stays
on the live layer at rest. The compositor moves live HTML with the
finger and the canvas a frame or more later, so glass, a `data-live`
element or an unpainted native control inside the scroller slides
against the painted page around it. A control is painted at rest and
live only while in use (a focused input), or it is a painted face with
the real control invisible over it (the Settings select: a painted value
and chevron, a transparent `<select>` on top). Glass belongs in the
pinned layer only. In development the stage warns in the console about
anything live in the scroller (`warnLiveInScroll` in
`src/glass/glass-stage.tsx`).

The window never scrolls, as in the Glass Lab's app mode: `html` and
`body` are locked and every screen scrolls inside `[data-app-scroller]`
(`src/components/app-scroller.tsx`, helpers in `src/lib/scroller.ts`),
with the canvas and the pinned bars over it. iOS's rubber-band bounce
and its handling of fixed elements during a window scroll otherwise
move the HTML and the painted glass apart. The scroller is
`position: absolute`, never `fixed`, and carries nothing else that makes
a stacking context (`transform`, `opacity`, `-webkit-overflow-scrolling`,
which does so on iOS only): one would sink every glass label and live
input inside it under the canvas. Read scroll position with `scrollTop()`, never
`window.scrollY`.

Muscle art: Frank's Notion Muscle Groups covers, traced by
`scripts/trace-muscle-art.ts` into `src/components/muscle-art/paths.ts`
(generated, committed; downloads and `preview.png` gitignored in
`scripts/data/muscles/`). Forearms, Neck, Cardio and Stretches have no
drawing of their own and are derived from his by flood fill
(`scripts/lib/muscle-tones.ts`). `<MuscleArt>` fills the paths from the
`--muscle-*` tokens and renders on the server, so the path data never
ships as JS. Home's Library shows the groups as a card grid. The icons beside prescriptions (warm-up, sets, reps, rest), on
workout thumbs by category (`src/lib/workout/icons.ts`) and before
muscle group names are Notion's own icons (its `fire`, `repeat`,
`hashtag`, `clock`, `accessibility`, `gym`, `hand`, `pants`, `shoe`,
`tshirt`), copied into `icons.tsx` with the fill set to currentColor.

Appearance: Settings offers System, Light and Dark, saved per device in
the `theme` cookie. The layout writes it onto `<html data-theme>` (and
the viewport's theme colour), so the first paint is right; every dark
token block in `globals.css` exists twice, under the phone's
`prefers-color-scheme: dark` (unless `data-theme="light"`) and under
`[data-theme="dark"]`. Script reads it through `appearance()` and
`onAppearanceChange()` in `src/lib/appearance.ts`, never the media
query directly.

## Colours: Apple's iOS 27 system colours

Decided and built 2026-11-08 (Frank's call, from the Fixed Stage prototype,
https://claude.ai/artifact/Pi7NdnzFdCp5EWNetaSSZg). Every screen uses Apple's system colours from the iOS 27 kit's Colors
page (Figma `wH8YZbekJXNew109clIJz1`, Backgrounds 5532:7801, Labels 5532:8406), in light and dark, as one set of tokens.
The active workout, sheets and the Journal follow the appearance like every other screen; nothing keeps its own dark.

| Token | Light | Dark | On a sheet (dark only) |
|---|---|---|---|
| Screen | `#ffffff` | `#000000` | `#1c1c1e` |
| Card | `#f2f2f7` | `#1c1c1e` | `#2c2c2e` |
| Inside a card | `#ffffff` | `#2c2c2e` | `#3a3a3c` |
| Primary text | `#000000` | `#ffffff` | |
| Secondary text | `#3c3c43` at 60% | `#ebebf5` at 70% | |
| Tertiary text | `#3c3c43` at 30% | `#ebebf5` at 30% | |
| Divider | black at 12% | white at 17% | |

A sheet redefines the same tokens to the dark column on the right (Apple's elevated set), so a card on a sheet steps up
by itself; light has no elevated set. Fades over the active workout's illustration use the screen token. Text people need
to read uses secondary; tertiary is for placeholders, chevrons, disabled items and icons in empty art. Text over images
or a coloured tile stays fixed white. The gold record icon gets a token (`#b38f00` light, `#ffd60a` dark). In `globals.css`
the dark elevated set is a rule on `.glass-sheet` and `.jcard`. The status bar colour and the manifest use `#000000` in
dark. Blue is still the older `#007aff` / `#0a84ff` (the kit's iOS 27 blues, `#0088ff` / `#0091ff`, are not adopted).

## Active workout

Aligned with Ladder, except the ending, then settled in the Fixed Stage prototype (Frank's calls, 2026-11-08;
https://claude.ai/artifact/XKi4yGQMMGzJAbWqUQE37v and https://claude.ai/artifact/Pi7NdnzFdCp5EWNetaSSZg).
`src/app/workouts/[id]/active-workout.tsx` is one screen per set in the app's colours, light or dark like every other
screen. The top bar is More alone. Its 44pt row stacks the timer (17pt, its own line) over the exercises as Apple's
progress bar (Frank's call, 2026-11-09; blue for every logged set on the kit's Fills/Primary track, `bg-fill-2`, no other mark; tap a segment to look at that
exercise). The percentage is gone. Under it the header: the set as blue text, the title and "Up next". The header is
the same in work and rest; there is no rest header.

The illustration never moves or resizes: it is the screen's width, square, centred in the space between the header and
the controls. Both zones hold their tallest size: the header has a minimum height for a two-line title
(`HEADER_ROOM`), and the controls stack last time with the steppers and the rest arc in one grid cell, the one not in use
`invisible` (the glass painter skips `visibility: hidden`), so the cell is always the taller. The image comes first in
the DOM (CSS `order` puts it back) because the painter draws in DOM order, so the header and "Last time" paint over it,
each on a short 70pt fade at 65% of the screen colour (`--bg-rgb`) that covers only the image's bleed. Weight and reps
are `Stepper` cards (`bg-card`, the iOS stepper under a number that shrinks to fit, 5 lb or 2.5 kg and 1 rep a tap,
typeable). Swipe sideways to look through the exercises, swipe up for the Journal. Logging a working set starts the
prescription's rest, which takes the steppers' place as an arc, and the log button becomes Skip; looking at another
exercise during rest shows a Rest capsule over the controls that goes back. The screen carries no floor, "Preview" or
"Swapped from" labels (Frank's call).

Two versions, switched in the workout's More menu under Settings and saved per device in the `workout_version` cookie
(`src/lib/workout-layout.ts`, Frank's call, 2026-11-09). Version 1, the default, is View 5 of the five views Frank
tried (https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=7-2): the pill below. Version 2 brings back the old
View 3 toolbar under the steppers (https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=28-1716): the 72pt
Glass Prominent log button in the middle (Skip, Play and Stop as the pill's circle has them), Journal (56pt, the set
count under its icon) and Swap (56pt) each centred under the stepper card above it, which is a two-column grid with
the steppers' 20pt sides and 12pt gap. Version 2 opens the Journal as a sheet (`Journal` in `journal.tsx`) and drops
Swap from More. The header is the same in both. The old `workout_view` cookie is ignored.

Settings also has a Glass Steppers switch, off by default, saved per device in the `workout_glass_steppers` cookie
(Frank's call, 2026-11-10, from https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=38-2134). On, the stepper
cards (and the outdoor run's Time readout) take the `.glass` material at 26pt corners in place of `bg-card`
(`stepperCard` in `stepper.tsx`); the label, number and kit stepper on them are unchanged, and the row is one
`data-glass-unit="box"`. It applies in both versions.

- The header: the set as blue text ("Set 2 of 3", "Warm-up 1 of 2", `SetText`, 15pt semibold), then the set's rep
  target in blue before the exercise's name ("8x Bench Press", "8–10x"; `repTarget` in `active.ts`: the prescription
  for a working set, else the row's prefilled reps, else none). Up next shows only on the exercise's last set, sliding
  in 10pt from the left as it fades (`.upnext-in`); it is hidden, not removed, so nothing moves.
- The pill is Ladder's, in the dock (67pt, 20pt from each side so it lines up with the steppers, 26pt corners, Liquid
  Glass; Frank's call, 2026-11-10): its empty circle logs the set (`PillCheck`: 51pt, 8pt from every edge of the pill as
  the iOS dock holds its icons, a 2pt `#0082f0` ring and a 21.25pt check, from Figma node 28:945, Frank's
  call, 2026-11-10; a blue fill for a moment when logged, Skip while resting), its middle opens the Journal, with set
  dots above the name (Frank's call, 2026-11-10; `PillDots`: 8pt, 4pt apart; logged solid blue, current ringed in blue, upcoming Fills/Primary;
  logging fills the dot as a transition). Swap is Swap Exercise in the More menu.

The prototype's other options (set circles under Last time, steppers as an inset list) are not built; `StepperList` and
`StepperRow` stay in `stepper.tsx` unused.

The Journal is `journal-card.tsx`, one card that grows from the pill under the finger, driven by `--jp` (0 the pill, 1
  open under the 62pt status bar; `.jcard` in globals.css). Its content is in it the whole way with the current exercise
  pinned under the header, as Ladder does, and the circle stays 28pt from the edge. A tap or swipe grows it, a drag past
  90pt or a flick opens it, the header pulls down to close (`src/lib/workout/journal-card.ts`, tested). The card is CSS
  on both glass paths: `[data-unpainted]` keeps it out of the painted page, as sheets are.

The steppers are the kit's Stepper (Figma `wH8YZbekJXNew109clIJz1`, Steppers 5415:17699): 92 × 32pt, 46pt halves in
Fills/Tertiary, a 1 × 24pt separator in Labels/Tertiary, − and + at 17pt semibold, touch areas padded to 44pt.

The model is pure and tested in `src/lib/workout/active.ts`: `buildRows` turns a workout exercise into set rows (the
prescription's warm-ups and working sets, filled by logged sets, prefilled from the same set last time on the floor),
and records, totals and stepper steps live there too. `journal.tsx` is the Journal's content (`JournalBody`), shown in the card. Warm-up circles show SF Symbols `flame.fill`
(`SfFlameFillIcon`, a mask in `public/icons`, Frank's call, 2026-11-09, aware Apple licenses SF Symbols for Apple-platform
apps) in the label colour, never orange. The current set's Log It circle keeps the default ring (no blue, no outer ring; it got
lost on the band) and its row a 15% blue band across the card, as Ladder tints its active row (no left-edge bar). It has no sections (supersets get none until there is a way to mark one): every exercise with set
circles, the shown one open with Max Weight and Est. 1 Rep Max (`bests` in `getWorkout`), a floor chip on two-floor
exercises, Swap, History and More (Do Later, Move Up, Move Down, Remove), and a Log It grid. `swap-sheet.tsx` is a
carousel of `getSwapPicks` (the program's subs, versions of the movement done before, the muscle group's most done)
ending on See all, a search of the library; `swapExercise` replaces the row when nothing is logged, else adds the new
exercise after it, and `workout_exercises.swapped_from_exercise_id` (migrations 0025 and 0026, no foreign key: a second
one made every `exercises(...)` embed ambiguous) remembers what it replaced. `finish-sheet.tsx` shows new records,
time, working sets and volume, and Keep swaps in template, which `completeWorkout` writes onto the template row that
held the old exercise. Effort and notes are no longer asked for.

The focus screen is painted with the page (the glass stage repaints on DOM changes and animations); only its number
fields are live. A full-screen box must not carry `data-live`, since `html.gpu [data-live]` forces `position:
relative`. Illustrations are 1024px WebP (`images:import`) and kept out of the PWA's install cache.

## Glass context rule

Applies to every glass control in the lab (`docs/lab/glass-lab-v3.html`)
and in the app, on both the WebGPU and the CSS path. Sources: Apple's WWDC25 "Meet
Liquid Glass" (219) and "Build a SwiftUI app with the new design"
(323), the HIG Materials and Toolbars pages, `ScrollEdgeEffectStyle`.

- Small glass flips between its material's light and dark sides with
  the content behind it, in either appearance; symbols, labels, tint,
  the selected capsule and shadows flip with it. Never switch only the
  icon colour. Large glass (sheets, menus, popovers) keeps the page's
  appearance.
- The unit is the bar, not the button. A pinned top toolbar is one
  unit, the bottom dock is one unit, and a row of controls sitting
  together in the content (a search row, an action row) is one unit.
  Every control in a unit decides together. A lone control is its own
  unit.
- A pinned bar reads the whole band its edge effect covers (full
  width, from the screen edge to about 34pt past the bar); any other
  unit reads the box round its controls. Average sRGB luminance, dark
  below 0.40, light again above 0.50. The move is a 0.25s crossfade.
- The pinned top bar has a scroll edge effect (Apple's soft style)
  behind it: a progressive blur plus, on the light side, a fade toward
  white, and on the dark side, a dimming (0.45 of the page at the
  screen edge, gone about 140pt down). The soft effect appears once
  content has scrolled under the bar. The bottom dock has no edge
  effect (Frank's call, 2026-10-11).
- A media page (a photo grid, as Photos draws its Library) gets a
  dimming edge at all times, and its top bar sits on the dark side.
- Text that belongs to a bar (a large title over media) is drawn
  above the edge effect, never blurred by it, and takes the bar's
  side.
- The glass refracts and blurs the page with the edge effect
  applied, so a bar sits on the band it decided from.
- No per-screen scroll thresholds. A new control or screen gets the
  rule by joining a unit.
- Liquid Glass is for the navigation and control layer only: the top
  bar, the tab bar and the resume pill, the dock's + button, the active
  workout's floating bottom bar, the pinned search field. Buttons in the page's content
  use the standard iOS styles in `src/components/button.tsx` (filled
  for the view's main action, tinted or gray for the rest; white and
  a white veil over media), per Apple's HIG ("Don't use Liquid Glass
  in the content layer") and Frank's call (2026-10-14): glass in
  scrolling content shows its label and its material moving apart.
  One exception, behind a switch: the active workout's Glass Steppers
  (Frank's call, 2026-11-10). It is allowed because that screen never
  scrolls, so nothing can drift. Glass outside the dock is hidden on the
  WebGPU path when its HTML is `visibility: hidden` (`stage.ts`), so the
  cards vanish under the rest arc as they do on the CSS path.

In the lab: surfaces with `flip: true` follow the rule; `UNITS.of`
names each control's unit, `UNITS.band` the band a pinned bar reads,
`UNITS.edges` the edge effects (`style: "dim"` for media); the page
with its effects is rendered to `pageTex`, which the glass and frosts
read; bar text goes on the overlay passed to `draw` as `T.over`. The
surface element carries `ctx-dark` or `ctx-light`, which sets
`--sym`, `--tab-ink`, `--tab-on-ink` and `--search-ink`. Details and
measurements in `docs/lab/glass-presets.md`.

## What's done (Milestone 1)

- Scaffold + deps
- Schema migration with RLS
- Analytics views migration
- Notion seed script with verification report
- PWA manifest, icons, service worker config
- Parser tests passing (suite now 400)
- Production build clean

## Milestone 2

- Done: every screen in `docs/planning.md` in Liquid Glass Preset 1.
- Done: programs in the UI (`/programs/[id]`, Programs on Templates,
  Up Next on Home) and the Achilles rehab templates by phase.
- Done (2026-11-08): the Ladder-aligned active workout, with swapping, Do Later, Move and Remove (see "Active workout").
  Not built: adding an exercise mid-workout, and supersets of two lifts that alternate. A lift with a static stretch
  between its sets is built (see "What a set measures").
- `_notion_id` stays: it is the ownership key for the three seeds
  (`template:`, `achilles:`, `program:`), not a temporary import column
