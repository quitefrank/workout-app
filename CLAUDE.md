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
bun run convert:powerbuilding3   # Powerbuilding Phase 3.0 5x dump -> program JSON (gitignored)
bun run seed:programs    # Every program JSON -> programs, phases, templates
bun run icons:generate   # Re-render placeholder PWA icons
bun run icons:sf         # SF Symbols (macOS renderer, via JXA) -> src/components/sf-symbol-data.ts
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
- `scripts/lib/powerbuilding3-pdf.ts` Parse the Powerbuilding Phase 3.0
  (5x) dump: week from the page banner, a banner row above a table's
  header dropped, option B for week 10, "(OR ...)" names split by
  `NAME_CHOICES`, a "~" RPE kept as the RPE with an "Approximate RPE" note.

Run `bun run test` to exercise them. 580 tests across 54 files.

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

Four Nippard PDFs in `scripts/data/programs/sources/` go through a
second pipeline into the same contract. `bun run extract:pdfs` runs
`scripts/extract-pdf-tables.py` (pdfplumber) over each PDF and writes
one page dump per file, text lines plus tables with cells as written,
to `scripts/data/programs/raw/` (gitignored). One tested parser per
program walks its dump (`scripts/lib/ppl1-pdf.ts`,
`powerbuilding-pdf.ts`, `arm-pdf.ts`, `powerbuilding3-pdf.ts`, on the
shared helpers in `pdf-program.ts`) and one thin CLI per program
(`convert:ppl1`, `convert:powerbuilding`, `convert:arm`,
`convert:powerbuilding3`) writes the gitignored JSON,
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
- Powerbuilding Phase 3.0 (5x): 5 blocks (Loading weeks 1 to 4,
  Semi-Deload week 5, Loading weeks 6 to 8, Taper week 9, Max Testing
  week 10), 46 days, 227 rows. Weeks 1 to 8 are five full body days,
  the taper three, max testing three (Squat, Bench and Deadlift Test).
  Week 10 is option B, the AMRAP at 90% the PDF recommends for general
  strength goals; option A, heavy singles for competitive powerlifters,
  is reported as omitted. That is the same rule as the 4x, where the
  AMRAP option was A. Pause, strict and touch-and-go spellings follow
  the library rules (Frank's calls via Claude, 2026-11-10): Strict Bench
  Press is the Pause Bench Press row; Touch-and-Go and Reset Deadlift and
  Strict EZ-Bar Curl are the standard row with the set instruction in
  `ALIAS_VARIANTS`; EZ bar is the curl and barbell its substitution, as in
  the 4x. Anderson Squat, Barbell Pin Bench Press and Pin Good Morning are
  new seed rows placed in their families by migration 0029, which runs
  after the seed on a fresh database (it touches nothing before).
  Nippard's substitution list (pages 101 to 104) is not loaded; only the
  "(OR ...)" choices in the tables become substitutions.

`nippard-get-ready-manual.pdf` holds no program (gear checklist, 1RM
testing, nutrition) and stays a reference. `nippard-ultimate-ppl-4x.xlsx`
still goes through `convert:ppl`. The same seed loads all five JSONs
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

## Confirmations: action sheets

A question about an action the person just chose is the iOS 27 kit's Action Sheet, never a `Sheet` (Frank's call,
2026-11-13, from the HIG's Alerts, Action sheets and Modality pages: "Use an action sheet, not an alert, to offer
choices related to an intentional action", and with data at stake, offer a save choice beside the destructive one, as
Mail's Delete Draft and Save Draft). `ActionSheet` in `src/components/pop-up-menu.tsx`, values and placement in
`src/lib/action-sheet.ts` (tested; Figma `wH8YZbekJXNew109clIJz1` 5446:10266): a 300pt card on the sheet's glass, 34pt
corners, 14pt padding, a 17pt semibold title and 17pt message, 48pt capsule actions on Fills/Secondary
(`bg-fill-secondary`), 8pt apart, destructive first in red. It grows out of the button that asked with the menu's
measured morph, pinned at the button's top-right corner, or its bottom-right corner growing up when there is no room
below. No Cancel, as the kit draws it: anchored to its button, iOS leaves the cancel action out, and a tap outside, a
scroll or Escape cancels. The page is not dimmed, as behind a menu. A question that would lose nothing is not asked.
The words are in `src/lib/workout/confirm.ts` and `startAsk` (tested). Three today: Exit Workout Early (Delete Workout,
Complete Workout), a finished workout's Delete, and Start with a workout in progress. An alert stays for something the
person did not start (none yet).

## Swipe to delete a set

A set row in the Journal deletes with UITableView's trailing swipe (Frank's call, 2026-11-12), the pair to + Add Set.
`src/components/swipe-row.tsx` is the gesture; its values are pure and tested in `src/lib/swipe-row.ts`, taken from
SwipeCellKit's `.destructive` style (built to match Mail; Apple publishes no numbers, sources in the file's header): a
74pt Delete, 1:1 travel to 30pt short of the row's width and 20% past it, a full swipe armed past that or with the
finger past 80% of the row, the title pinned to the trailing edge until armed and then springing to the row's edge,
release on UIKit's mass 1 / stiffness 100 / damping 18 spring, and a delete that slides off and collapses the row in
0.3s. One row is open at a time; a tap elsewhere or a scroll closes it. iOS Safari has no haptics, so the arming tick
is missing on the phone. The last row of an exercise can't be deleted. What a delete means is
`src/lib/workout/row-delete.ts` (tested): a logged row deletes its set; prescribed rows are dropped off the end of
their block as a count, kept on the screen like + Add Set's, and the rows after keep their values.

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

An exercise's chart is Heaviest Weight alone, under its own heading with no switch (Frank's call, 2026-11-13: he never
tests a one rep max). Its PRs are Heaviest Weight and One Rep Max. Best-set volume was removed (Frank's call, 2026-11-05):
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

With no program followed, Home shows Recommended in Up Next's place (Frank's call, 2026-11-11): the day workout whose
muscle groups have rested longest, with the reason ("Glutes last trained 9 days ago"), a Start button, two runners-up
and Choose Program, which opens a sheet of the training programs (`src/app/(home)/program-empty-state.tsx`; ranking in
`recommend` in `src/lib/workout/heat.ts`, tested: cardio and anything done today or yesterday left out, days rested
capped at 14). With nothing to suggest it is the No Program card. The app never requires a program. The workout
that completes a program's last day stops following it (`stopFollowingIfEnded` in `actions.ts`), and Home
treats an ended program as none. Past completions are not scoped to a follow date, so following a program
you already finished ends it again; rerunning one needs a start date first.

## Home: Last 7 Days

A body map modelled on Fitbod's recovery map (Frank's calls, 2026-11-11): front and back side by side
(`src/components/body-map/`, paths from react-muscle-highlighter 1.2.0, MIT, licence in `paths.ts`), each muscle
coloured by its group's working sets in the window against the evidence baseline (ACSM 2026: at least 10 a week,
diminishing returns past about 20). A ramp mixes `--red` into `--heat-body`: 16% for a first set to 66% just short of
10, 70% at 10 to 100% at 20. Stepped: a set counts in full until its day leaves the window, with no decay. Under the
body: the legend, the window's workouts and working sets (time left out), then a bar per group with the 10 to 20 band.
Tapping a muscle or its bar shows its count, how far from 10, and the exercises it came from. The model is pure and
tested in `src/lib/workout/heat.ts`; `getHeatWorkouts` reads 60 days for it and Recommended.

The window is a setting, `user_settings.heat_window` (migration 0033): `rolling` (today and the six days before, the
default, titled Last 7 Days) or `week` (from Monday, titled This Week), in Settings under Last 7 Days.

Secondary muscles count half a set (Pelland 2025, ref 187 of the ACSM paper): `exercises.secondary_muscle_group_ids`
(migration 0033, Frank's review of the draft, 2026-11-11), set by family and main group so every version of a lift
shares its helpers (Bench Press: Triceps, Shoulders; Row: Biceps, Shoulders; Deadlift under Glutes: Hamstrings, Back,
Quadriceps; under Hamstrings: Glutes, Back). No seed touches it; a new family needs its row by hand.

Cardio counts no sets (Frank's call, 2026-11-13): the baseline is resistance sets and the ACSM paper gives no rate for
aerobic work. A cardio exercise's secondaries (migration 0034: runs and walks Quadriceps, Hamstrings, Glutes, Calves;
bike and elliptical Quadriceps, Glutes, Hamstrings; the rower those and Back) list it in a tapped muscle's detail with
its minutes, "not counted" (`CARDIO_GROUP` and share 0 in `heat.ts`).

The fills are custom properties on the `<svg>` applied by `.body-map` rules in `globals.css`, never inline styles on the
paths: the glass painter's detached copy of an svg keeps a style attribute but cannot resolve a `var()` in it, so an
inline `var()` fill paints black on the WebGPU path.

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

Screens follow `docs/planning.md`, with three tabs: Home, Library, Progress (Frank's calls, 2026-11-11, from the Tab
Bar and Home Lab, https://claude.ai/artifact/CTuL1AAXJZ52gaByMyMRTk). Home (`src/app/(home)/`, with History at
`/workouts`) is the calendar, then Workouts only when the selected day has something logged, then Up Next (or
Recommended), then Last 7 Days (see "Home: Last 7 Days" below). Starting a workout is the dock's + button, on every tab but the
active workout (`src/components/start-workout.tsx`): Apple's Glass Prominent (iOS 27
kit, `prominentMaterial` in `src/glass/presets.ts`), 62pt and 8pt from the bar. It
keeps its blue, outside the context rule (`data-glass-skip`). It opens Choose a Workout, which starts a workout from
the sheet (Frank's calls, 2026-11-13, option D "Split row" with the hero card, https://claude.ai/artifact/NhAD3QmuzrigseuXLTvxXR).
A workout in progress comes first, under In Progress, with a Resume capsule. Then the hero card: the followed program's
Up Next (main lift art, the name, "Next in the rotation · N exercises"), else Home's first Recommended with its reason
(`topRecommendations` in `src/lib/workout/start-sheet.ts`, shared with Home; `getTopRecommendation` in the layout), else
no card. Its Start Workout is the list's one filled button. Then the day templates by category. The rule: a list row
whose job is an action carries a trailing button, never a chevron; the row body opens a preview. Each row ends in a gray
Start capsule (`Button compact`, the kit's Medium Bordered button: 34pt, play symbol, touch area padded to 44pt) that
starts it, and its body opens a preview step inside the sheet (title the workout, `onBack` to the list, the exercises
from `/api/templates/[id]` worded as the workout page words them, a filled Start Workout at the end). Starting calls
`beginWorkout` and pushes the new workout; the sheet stays up showing Starting… until the workout screen replaces the
tab bar, and then a toast offers Undo for 5 seconds, which is `discardWorkout` (back to Home). One workout in progress
at a time: `startWorkout` and `beginWorkout` refuse a second one on the server (`startDecision`, tested), and in the
sheet a Start with one in progress asks in an action sheet grown from that Start, over the list ("<name> is still in
progress. Exit it early to start <new>?", with Exit Early and Start and Resume <name>; a tap outside cancels; see
"Confirmations: action sheets"). Exit Early and Start
deletes the open workout and starts the new one in one action. `/templates/[id]` stays the full preview from the Library. The date header is
MyFitnessPal's (`src/app/week-calendar.tsx`): the title is the selected day
and opens the floating month panel (`month-panel.tsx`, Liquid Glass's menu
morph, measured; see `Templates/liquid-glass/liquid-glass-reference.md` in the
vault), and the week strip is one native sideways scroller with snap, Monday
first, as wide as every week since 1970 with only the weeks near the view
rendered. A swipe selects the same weekday once settled. Dots outside the
selected month load from `/api/calendar`. The selected day is in `?d=` and its
workouts are cards that open the workout.

The Library tab (`/library`, `src/app/library/`) is one scroll of Exercises (the muscle group cards), Workouts (the
tall cards, those with exercises first) and Programs, in that order since exercises are looked up most, under one
search field over all three (`library-search.tsx`; results in the same order, the muscle group pills filter exercises
only). Each section title carries a chevron to its own page (`SectionHeader`'s `href`, as Photos marks a section, in
place of See All): `/library/exercises` (the groups, then every exercise A to Z), `/library/workouts` (by category)
and `/library/programs` (Following first). `/templates` and `/exercises` redirect into it; `/templates/[id]` is still
a workout's page, pushed with the tab bar hidden and Start Workout pinned; its exercise rows open the exercise sheet
over it, never another page (`template-exercises.tsx`, Frank's call, 2026-11-13, from the HIG's one-sheet rule and Hevy). A New button (creating workouts and programs) is decided in concept and not built. The muscle groups show as twelve cards, three across, four full rows, each one muscle (Frank's calls, 2026-11-13,
after Equinox+'s Find a Movement grid on Mobbin; `CARD_SPECS` in `src/lib/workout/library-cards.ts`, tested): Core
(the Abs group, shown as Core), Biceps (with Forearms), Chest, Glutes, Lats, Upper Back, Shoulders (with Neck),
Hamstrings, Calves, Quadriceps, Triceps, Stretches. Back is two cards by family: Lats takes `LATS_FAMILIES` (Lat
Pulldown, Pull-Up, Chin-Up, Lat Pull-Over, 1-Arm Lat Pull-In, Muscle Up) and Upper Back the rest (Row, Shrug). Cardio
has no card. Display only: exercises keep their own group, and the body map and records use the groups. Search's pills
are the same cards. Lats and Upper Back are drawn from the Back drawing (`DERIVED` in `scripts/trace-muscle-art.ts`).
A card opens `/exercises/group/<slug>` (an old group id still resolves): a section per group it holds, then
Secondary, the exercises naming one of its muscles as a secondary (`isSecondary`; a Back secondary shows on Upper Back
only), with All and per-section pills that filter when there is more than one section. One entry per family
throughout. Cardio appears under Secondary on the leg cards and the rower on Upper Back (migration 0034). An exercise row, there or in
search, opens the exercise's bottom sheet (`src/components/exercise-sheet.tsx`,
fetching `/api/exercises/[id]`): Summary, History, How to
(`exercise-detail.tsx`). Search loads its rows from `/api/exercises` when it
opens, so the Library never fetches all 342 up front.
`/exercises/[id]` stays for links from templates, workouts and Progress, and
shows the same tabs. Exercise illustrations are `public/exercises/<slug>.webp` (red
highlight, Frank's call, 2026-11-05), added with `bun run images:import <folder>`,
which rewrites `src/lib/exercise-image-slugs.ts`. An exercise without its own image borrows the closest one
through `src/lib/exercise-image-standins.ts` (Frank's call, 2026-11-12: no empty tiles); its own image always wins,
and a test fails until the stand-in line is deleted. Build every image URL with `exerciseImageSrc`, never
`/exercises/${slug}.webp`. `src/components/exercise-art.tsx`
shows one on `--exercise-tile`, one background level above what holds it in both appearances, per the HIG's
system backgrounds (Color page: primary, secondary within it, tertiary within secondary) and the kit's Backgrounds
page: the card colour on the screen (the workout cards, `#f2f2f7` / `#1c1c1e`) and the inside-a-card colour inside a
`bg-card` or `.grouped` list (row thumbnails, the Journal's cards, `#ffffff` / `#2c2c2e`), stepping up on a dark sheet
(Frank's calls, 2026-11-13), or the muscle group's art on the themed tile until it exists. Going back restores the screen's
scroll position (`src/components/app-scroller.tsx`). The UI calls templates "workouts" (Frank's call, 2026-11-11);
the code and tables keep `templates`. The 18 Notion day templates have `program_id` null. Progress is `/analytics`. The active
workout (`/workouts/[id]`) is described under "Active workout" below. Delete has one place on a
finished workout: the trash button in the summary's top bar, asking in an action sheet grown from it; the active
workout deletes itself with Exit Workout Early in its More menu, which asks in an action sheet grown from More (Delete
Workout or Complete Workout) and, with nothing logged, exits without asking. A finished workout's summary deletes (`deleteWorkout` in `actions.ts`, which refuses one in
progress). Pure helpers for dates, formatting and PRs live in
`src/lib/workout/` with tests.

The large-title header is the kit's Toolbar - Top - iPhone (Figma `wH8YZbekJXNew109clIJz1` 754:47485; Frank's calls,
2026-11-13, from the Large Title Spacing prototype, https://claude.ai/artifact/8KEgoTinwD1fFxH16GZ6VV): the controls row
starts at the status bar's edge (`--bar-top` is the safe area, no added 8pt, so every top bar moved up with it), the 34pt
title sits 10pt under the controls with -0.24px tracking (the kit has +0.4), and the first content starts 26pt under the
title or subtitle (the toolbar's 10 plus the grouped table's 16). `LargeTitle` owns the 26 as its bottom padding, so the
first block on a page adds no top margin and a leading `SectionHeader` takes `pt-0`. Cards keep their 16pt side inset
(the kit's 20 was declined).

Sheets are Apple's iOS 27 sheet (kit 27.0.1, `src/components/sheet.tsx`, values
in `src/lib/sheet-detent.ts`), fitted to their content by Frank's call
(2026-11-04), as Apple's `.height(_:)` detents allow. A sheet rests at its
content's height up to the large detent, and never shrinks while open, so tabs
stay under the finger; taller content scrolls. There is no medium stop, so a drag
only closes it. Below large: 6pt inset, 34pt top and 58pt bottom corners, a CSS blur with
transparency.
Large: edge to edge under the 62pt status bar, 38pt top corners, opaque. A focused
text field takes it to large. The confirming action is `SheetConfirm`.
A `thumbnail` makes the sheet open on it large (232pt, 70pt from the top, where
other sheets' content starts, so the close button is never on it; Frank's call,
2026-11-13), and scrolling the content shrinks it into the kit's Activity View
header (thumbnail, title and subtitle in one row, close at the trailing edge), as
the exercise sheet uses. The shrink follows the finger, the large title rides up and
fades while the small one fades in where it rests (Frank tried titles that slide
right or left into the header on 2026-11-13 and kept the fade, which is how Apple's
large titles behave). The close button never moves, and a header stopped
halfway settles on SwiftUI's smooth spring (Frank's call, 2026-11-07, from the
Exercise Sheet Hero prototype, https://claude.ai/artifact/4WWmpj6GS3aqRKhwm7eKur).
In the exercise sheet the Summary / History / How to tabs stick under the collapsed header (`stickyTop` on
`ExerciseDetailTabs`, Frank's call, 2026-11-13); the band is always the sheet's solid colour (scaled by `--sheet-full`),
never switched on by script, since the observer reports after the scroller has already stuck it and the band showed the
content through for those frames. Stuck, it carries the header's 22pt fade, and it sits above the header layer. Sticky `top` counts from inside the scroller's padding, which is the hero header,
so the component subtracts it. Values
and geometry are pure and tested in `src/lib/sheet-hero.ts`. At the large detent
the content gets a minimum height so the shrink can always finish; a fitted sheet
never scrolls, so it stays large. Without a thumbnail a sheet has the kit's
toolbar (close, centred title, confirm).
Three rules for placing and stacking sheets (Frank's calls, 2026-11-13, from the sheet audit,
https://claude.ai/artifact/NhAD3QmuzrigseuXLTvxXR, on the HIG's sheet and toolbar pages):
- The close button takes the slot the header leaves free: leading in the toolbar, trailing beside a thumbnail and in
  the Journal's header. With Back, Back is leading and close trailing.
- One sheet at a time. A sheet opened from another (or from the Journal) closes the first, opens once that close has
  finished, and on a cancel reopens the first where it was. Journal > Swap and Journal > History do this in
  `active-workout.tsx` (`fromJournal`, `reopenJournal`): a dismissed Swap or a closed History sheet brings the Journal
  back with its scroll and open cards; a completed swap lands on the focus screen with the Journal closed. Swap from
  More or a card outside the Journal reopens nothing. Finish still closes the Journal and opens at once.
- A step inside a sheet gets Back; a version change does not. `Sheet`'s `onBack` puts Back in the leading slot (top left
  beside a thumbnail, in the close button's row) and close trailing, never with a confirm; Back fades and scales in and
  out. Swap's See all ("Swap for Any Exercise") is a step back to the carousel. In the exercise sheet an alternate is
  pushed onto a stack and slides in from the right (a back step from the left, keeping its tab and scroll); Back pops
  one step and is gone at the exercise the sheet opened on. Choosing a version in the MovementPicker replaces the
  exercise in place (`onVersion`, apart from `onAlternate` in `ExerciseDetailTabs`). With Back, the collapsed thumbnail
  moves from x 20 to 72 and the small title with it (`heroLayout(width, back)`, tested).
The scrim is the kit's Overlays/Default (`--scrim-alpha`: 20% black, 48% in dark)
and covers the bars too. It fades in and out over 300ms on both paths (Frank's call,
2026-11-10). On the WebGPU path it is painted into the page, faded by the scrim
element's own opacity read at paint time (`fade` on the display-list item), so the
bars' glass takes a `dim` uniform and its HTML symbols a brightness filter, both
scaled by the same fade (`--scrim-t` and `.scrim-dim` on `<html>`, set by the stage). Sheets,
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

A home screen app's window flips between the full screen and 50pt short of it (iOS 26), so nothing is sized or pinned
from the window's bottom there (2026-11-12, after the painted page and Start Workout were cut off 50pt up). Size from
`screenHeight()` in `src/lib/scroller.ts`, never `innerHeight`. A fixed bar at the bottom carries `data-screen-bottom`
(or is a `data-glass-unit="dock"`) and is a flex column; a full-screen cover carries `data-scrim` or `data-screen-fill`.
`html.standalone` places them from the top at `--screen-h`. The painter never clips to `body`, whose overflow only
stops the window scrolling.

The caret rule (2026-11-10): iOS draws a field's caret when it gets focus and does not redraw it when the field
moves without an edit, so nothing may move a focused field afterwards. Two things did, each leaving the caret 50pt
off: the keyboard rule fitting the scroller to the visible area, which moved the focus screen (absolute under
`html.gpu`, so the scroller is its containing block), now skipped under `:has([data-focus-screen])`; and iOS
scrolling the window into the home screen app's 50pt overhang despite `overflow: hidden`, which
`followVisualViewport` undoes once a frame and then sets the same selection again so the caret is redrawn. With
nothing left to scroll, the focus screen lifts itself above the keyboard as the HIG's keyboard layout guide does:
`--focus-lift` (`focusLift` in `src/lib/scroller.ts`, tested) moves its top and bottom, never a transform, until the
focused card ends 16pt above the keyboard's bar. iOS scrolls to centre a field it focuses (measured on the phone with a
frame recorder: 132pt on a switch, 196pt above and below the field in a 433pt viewport), but centring sat too high
(Frank's call, 2026-11-10), so every tap on a stepper's field, first or a switch, focuses it with `preventScroll`
(`focusWithoutScroll`; iOS's 379pt scroll as the keyboard opened overshot the lift and read as a spring), and a switch
by the keyboard's arrows gives iOS nothing to scroll: while the keyboard is up each stepper field's box reaches up
(`--field-reach`, `fieldReach`, padding-top with an equal negative margin) until its centre is the visible area's, where
iOS centres a field, while the digits stay put. A tap on the reaching part, above the digits, closes the keyboard
(`focusWithoutScroll`). The box must keep taking taps: with `pointer-events: none` iOS's ^ v arrows skipped the fields
and greyed out. Undoing iOS's scroll after the fact still showed 2 to 3 frames of a
132pt pan, since iOS moves the screen before the page hears of it. The glide starts on the tap with the visible
height the keyboard left last time and drops as focus leaves, so it moves with the keyboard rather than after it. The lift glides with a transition and the caret is redrawn when it settles. A scroll iOS makes anyway (379pt
in one frame as the keyboard opens) is absorbed in the same event: the window goes back to 0 and the lift takes over
where the screen shows, then glides on. Undoing it a frame later, or holding the lift after the keyboard closes, read
as jumps on the phone. Tapping a stepper's number puts
the caret after the digits.

Muscle art: Frank's Notion Muscle Groups covers, traced by
`scripts/trace-muscle-art.ts` into `src/components/muscle-art/paths.ts`
(generated, committed; downloads and `preview.png` gitignored in
`scripts/data/muscles/`). Forearms, Neck, Cardio and Stretches have no
drawing of their own and are derived from his by flood fill
(`scripts/lib/muscle-tones.ts`). `<MuscleArt>` fills the paths from the
`--muscle-*` tokens and renders on the server, so the path data never
ships as JS. The Library shows the groups as a card grid. The icons beside prescriptions (warm-up, sets, reps, rest), on
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

Settings controls follow what each setting is (Frank's call, 2026-11-13, the 2026-11-04 control rule applied): an on/off
value is the iOS 27 toggle (`ToggleRow`), a choice among values is a pop-up button (`SelectRow`, the painted value and
chevron over an invisible native select), both in `src/components/settings-rows.tsx`. A segmented control
(`src/components/segmented.tsx`) switches a view and never sets a value. The toggle is the kit's `Toggle - Switch`
(Figma `wH8YZbekJXNew109clIJz1` 29:56814): a 64 × 28 track, green on and Labels/Tertiary off, a 38 × 24 white knob 2pt
in, swelling while pressed into a 58 × 38 clear glass capsule over the track (`src/components/toggle.tsx`, values tested
in `src/lib/toggle.ts`). Every switch in the app is this one, the finish sheet's Keep swaps included. The active
workout's Settings sheet still sets Journal glass with a segmented control.

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
or a coloured tile stays fixed white. The gold record icon gets a token (`#b38f00` light, kept dark
for legibility on white, and the kit's yellow `#ffd600` dark). In `globals.css` the dark elevated set is a rule on
`.glass-sheet` and `.jcard`. The status bar colour and the manifest use `#000000` in dark.

Every colour comes from the kit (Frank's call, 2026-11-13: "We should be using the kit's blue across the board"). The
accents are the kit's Accents (Colors page 0:1746), light / dark: blue `#0088ff` / `#0091ff` (also the tab bar's
selected ink), red `#ff383c` / `#ff4245`, orange `#ff8d28` / `#ff9230`, green `#34c759` / `#30d158`. Fills: `--fill` is
Fills/Tertiary (12% / 24%), which the kit's Bordered button and the stepper halves sit on, so a gray button is `bg-fill`;
`--fill-2` is Fills/Primary (`rgba(120,120,120,0.2)` / `rgba(120,120,128,0.36)`) for tracks. A toggle's off track is
Labels/Tertiary (`bg-ink-3`). A colour the kit has must not be typed as another value; one it lacks (gold light, the
illustration and heat-map tones) is named here.

Every colour switches with the appearance (Frank's call, 2026-11-13): each token has its light value in `:root` and its
dark value in both dark blocks (the phone's `prefers-color-scheme` and `[data-theme="dark"]`), and a component uses the
token, never a hex, so nothing stays on one mode's value. The full kit table, light and dark, every variable, lives in the
vault at `Templates/liquid-glass/ios-27-colors.md`; check a new colour there first.

## Active workout

Aligned with Ladder, except the ending, then settled in the Fixed Stage prototype (Frank's calls, 2026-11-08;
https://claude.ai/artifact/XKi4yGQMMGzJAbWqUQE37v and https://claude.ai/artifact/Pi7NdnzFdCp5EWNetaSSZg).
`src/app/workouts/[id]/active-workout.tsx` is one screen per set in the app's colours, light or dark like every other
screen. The top bar is More alone. Its 44pt row holds the timer (17pt), centred on the button, and under it the exercises as
Apple's progress bar run the full width between the 20pt gutters, under the button too, about 14pt below it (Frank's
call, 2026-11-10, from Ladder, Figma 11:705; the bar itself from 2026-11-09: blue for every logged set on the kit's Fills/Primary track, `bg-fill-2`, no other mark; tap a segment to look at that
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
prescription's rest, which takes the steppers' place as an arc, and the log button becomes Skip; the arc stays on every
exercise swiped to until rest ends or is skipped (Frank's call, 2026-11-13, replacing a Rest capsule), and its buttons
either side are the kit's Large Bordered icon button (50pt, SF Symbols minus and plus at 17pt Regular in blue, Figma
40:59288), 15 seconds a tap, 32pt from the screen's edges in line with the pill's circle. The screen carries no floor, "Preview" or
"Swapped from" labels (Frank's call).

Version 2 and Glass Steppers left Settings on 2026-11-12 (Frank's call): the page always passes Version 1 and no glass
steppers and no longer reads their cookies, and their code stays for now. Two versions, switched in the workout's More menu under Settings and saved per device in the `workout_version` cookie
(`src/lib/workout-layout.ts`, Frank's call, 2026-11-09). Version 1, the default, is View 5 of the five views Frank
tried (https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=7-2): the pill below. Version 2 brings back the old
View 3 toolbar under the steppers (https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=28-1716): the 72pt
Glass Prominent log button in the middle (Skip, Play and Stop as the pill's circle has them), Journal (56pt, the set
count under its icon) and Swap (56pt) each centred under the stepper card above it, which is a two-column grid with
the steppers' 20pt sides and 12pt gap. Version 2 opens the Journal as a sheet (`Journal` in `journal.tsx`) and drops
Swap from More. The header is the same in both. The old `workout_view` cookie is ignored.

Settings also has a Glass Steppers switch, off by default, saved per device in the `workout_glass_steppers` cookie
(Frank's call, 2026-11-10, from https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=38-2134). On, the stepper
cards (and the outdoor run's Time readout) take painted glass at 26pt corners in place of `bg-card`
(`stepperCard` and `GlassLayers` in `stepper.tsx`, `.glass-card` and the `--gc-*` tokens in `globals.css`); the label,
number and kit stepper on them are unchanged. It applies in both versions. The glass is not `.glass`: it is a rim layer
(`.glass`'s 1px light ring stops) under a body inset 1px with the edge glow, measured off the shader's card, so the page
painter draws it with the page on the WebGPU path and it slides with the image when the exercise changes. Shader glass
was tried first and arrived after the slide, because the focus content remounts per exercise and the stage rebuilds a
new element's shaders before showing it. `.glass-card` makes no stacking context, so the focused number field still
lifts over the canvas while typing.

- The header: the set as blue text ("Set 2 of 3", "Warm-up 1 of 2", `SetText`, 15pt semibold, 25pt line), 3pt above
  the title and the title 6pt above Up next (Frank's call, 2026-11-10, Figma 4:48), then the set's rep
  target in blue before the exercise's name ("8x Bench Press", "8–10x"; `repTarget` in `active.ts`: the prescription
  for a working set, else the row's prefilled reps, else none). Up next shows only on the exercise's last set, sliding
  in 10pt from the left as it fades (`.upnext-in`); it is hidden, not removed, so nothing moves.
- The pill is in the dock, sized after the iOS 27 kit's collapsed notification (Figma `wH8YZbekJXNew109clIJz1`
  754:64315) and tuned in the Journal Pill Lab (Frank's calls, 2026-11-12, https://claude.ai/artifact/LoiDBexQCNYGfaauP8uTQ2):
  70pt tall, 16pt from each side, 32pt off the bottom as the kit's bottom toolbar buttons (2517:14526; Frank's call,
  2026-11-13, replacing 27pt: the pill and Start Workout are toolbar controls and sit at `--toolbar-bottom`, the tab bar
  keeps 21pt; a screen's last section ends as far above its bottom bar as the bar sits above the screen's bottom, and
  with no bar at all, as in the Library's search, 32pt above the screen's bottom and 16pt above the keyboard while it
  is up (Frank's call, 2026-11-13), `--screen-end` in
  globals.css, confirmed on the phone 2026-11-13), 24pt corners, Liquid Glass (`PILL` in
  `src/lib/workout/journal-card.ts`, tested). The workout sets `PILL.bottom` as `--dock-bottom` on `<html>` while it is
  up, so the steppers, the Journal card and the drag follow; the app's other docks keep 21pt. Settings' Journal glass (a test setting, 2026-11-12,
  `workout_journal_glass`, `css` by default) picks how the pill and the card it grows into are drawn. CSS: the pill is
  CSS glass (`glass-css`, which the stage leaves to CSS but keeps in its unit for the light/dark rule) and hides while the
  card is up; the card's first layer (`.jcard-glass`) is the same glass with the pill's side copied onto it, staying whole
  under the card while the opaque fill comes in over the first fifth of the travel and switching off past a quarter.
  Both the pill and that layer blur a constant 10pt, collapsed too, so the first frame is the pill exactly and no filter
  value changes during the drag (Frank's call, 2026-11-12; a Ladder-style frost that grew to 30pt lagged on the phone,
  and one without the luminosity layer started darker than the pill). Matched: the pill stays shader glass and the stage hides it
  (`data-glass-hidden`) behind the same CSS layer. Shader: the pill itself follows the card's geometry (`.pill-grow`,
  `--jp` mirrored, offsets as `--jc-*`), keeps its side while growing (`data-glass-hold`) and hides once settled open;
  the card over it stays clear until its fill comes in from 0.6 to 1, with no scrim. The steppers sit 20pt above it. Its empty circle logs the set (`PillCheck`:
  38pt, 16pt from every edge of the pill, a 2pt ring in `--blue` (Figma node 28:945 drew it at dark `#0082f0`; it follows the appearance) and a 17pt check, the kit's symbol
  size; a blue fill for a moment when logged, Skip while resting, and solid blue with a white check at full strength once
  every set of the shown exercise is logged, Frank's call, 2026-11-10; the "logged, swipe" line then sits 12pt above the
  pill, the gap between Last time and the steppers), its middle opens the Journal, 10pt after the circle, with set
  dots above the name (Frank's call, 2026-11-10; `PillDots`: 8pt, 4pt apart; logged solid blue, current ringed in blue, upcoming Fills/Primary;
  logging fills the dot as a transition). Swap is not in the pill or the Journal's header (Frank's call, 2026-11-12; the
  Swap in Pill setting and its `workout_pill_swap` cookie are gone): Swap Exercise is in More and on each exercise card.

The More menu (Frank's layout from the More Menu Lab, 2026-11-13, https://claude.ai/artifact/UnFkaJUBwEUwquSLLk4AGn)
is a row of three, Journal, Swap and Do Later, each an SF Symbol over a 13pt label (`palette` on `ActionMenu`, as
UIMenu's medium element size), then a hairline, Settings, a hairline, Complete Workout and Exit Workout Early in red.
List rows lead with a 17pt SF Symbol in a 26pt column, 11pt to the label, 24pt in from the menu's edges (`icon` and
`separator` on `PopUpItem`). Swap and Do Later show only while an exercise is on screen. Back to Home was removed:
Complete and Exit are the two ways out. The app's words are Complete (never Finish) and Exit Workout Early (never
Discard) everywhere on screen, including the finish sheet, the Journal's button and the Start sheet's in-progress
question (Frank's call, 2026-11-13); code names (`FinishSheet`, `discardWorkout`) keep theirs. Inside Exit Workout
Early's action sheet the destructive choice says what it does, Delete Workout, beside Complete Workout (Frank's pick of
option A, 2026-11-13).

The prototype's other options (set circles under Last time, steppers as an inset list) are not built; `StepperList` and
`StepperRow` stay in `stepper.tsx` unused.

The Journal is `journal-card.tsx`, one card that grows from the pill under the finger, driven by `--jp` (0 the pill, 1
  open under the 62pt status bar; `.jcard` in globals.css). Its content is in it the whole way with the current exercise
  pinned under the header, as Ladder does. The header is the pill's own content grown into the kit's large sheet toolbar
  (10525:1638; `OPEN_HEADER`, Frank's calls, 2026-11-12, from the Journal Pill Lab): 70pt like the pill, the circle growing
  from 38pt to 44pt on its 16pt edge, the set dots over the title still leading, 8pt after it, at 17pt in both states, the
  kit's 58 by 4pt grabber 5pt from the top, and a 44pt close button 16pt from the trailing edge with SF Symbols `xmark` at
  17pt Medium (`SfXmarkIcon`, a mask in `public/icons/sf-xmark.png`), both coming in as it opens. No set label, count,
  summary line or divider. The card has no material of its own (Frank's call, 2026-11-12): the pill's real glass stays
  on screen under it with only its content hidden (on the WebGPU path the dock's glass is drawn whatever its visibility),
  and the card fades in as a plain opaque sheet over the first quarter of the travel, its content with it, so nothing
  swaps as it mounts or unmounts. Glass on the card (the close button) is CSS, as on a sheet (`:is(.glass-sheet, .jcard) .glass` in globals.css,
  and the stage skips `.jcard`). Each exercise is Ladder's card (`ExerciseCard` in `journal.tsx`, measured off
  Ladder, Figma `ZD41TUAEBtLJI7t0qChNup` 11:706): 8pt from the Journal's edges, 4pt apart, 20pt corners, `bg-card` (the
  elevated step: `#2c2c2e` on the dark Journal, `#f2f2f7` on the light), 16pt sides (Frank's call, 2026-11-12), 14pt top,
  a 58pt thumbnail 20pt from the title, 36pt chips 8pt apart, and a 56pt band on the current set. The cards' content is
  24pt from the screen's edge, the open check 16pt. Tapping a card's header opens or closes it,
  its body's height animating; the current exercise starts open, any number can be open, and opening one moves the
  focus screen there. A tap or swipe grows it, a drag past
  90pt or a flick opens it, the header pulls down to close and the close button closes it (`src/lib/workout/journal-card.ts`, tested). The card is CSS
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
exercises, Swap, History and More (Do Later, Move Up, Move Down, Remove), and a Log It grid. Swap and History close
the Journal and open their sheet (History is the exercise sheet on its History tab, `initialTab`, so it no longer
leaves the workout), and a cancel reopens the Journal where it was (see the sheet rules under "App"). `swap-sheet.tsx` is a
carousel of `getSwapPicks` (the program's subs, versions of the movement done before, the muscle group's most done)
ending on See all, a search of the library with Back to the carousel; `onClose` is a dismissal and `onSwapped` a swap; `swapExercise` replaces the row when nothing is logged, else adds the new
exercise after it, and `workout_exercises.swapped_from_exercise_id` (migrations 0025 and 0026, no foreign key: a second
one made every `exercises(...)` embed ambiguous) remembers what it replaced. `finish-sheet.tsx` shows new records,
time, working sets and volume, and Keep swaps in template, which `completeWorkout` writes onto the template row that
held the old exercise. Effort and notes are no longer asked for.

The focus screen is painted with the page (the glass stage repaints on DOM changes and animations); only its number
fields are live. A full-screen box must not carry `data-live`, since `html.gpu [data-live]` forces `position:
relative`. Illustrations are 1024px WebP (`images:import`) and kept out of the PWA's install cache.

## Soft scroll edge

Apple's iOS 27 "Scroll Edge Effect - Soft" (Frank's call, 2026-11-12; Figma `RrXV3TJi8viPxN3lELlvfK` 2681:67704: a
blur from 0 to 10 toward the edge under the screen's colour from 0 to 81%; the kit draws only dark, so light uses the
screen's white) is `src/components/soft-edge.tsx`, with a darkening gradient over the kit's tint (`SOFT_EDGE.darken`,
0 to 70% of the screen's colour, reaching further from the edge; Frank's call after the phone, matched by eye to Claude's
iOS side menu, whose last row dissolves almost fully). The active workout's two edges and Start Workout's use `SOFT_EDGE_STRONG` (`strong` on
`ZoneSoftEdge` and `SoftEdge`, read by the painter from `data-soft-strong`): a 20pt blur and a darkening to 90% at the edge (Frank's
call, 2026-11-12). The painter blurs in six bands, each feathered over a band's width. The bottom edge's darkening goes solid at the top of the
stepper cards and the top edge's at the top of the title (`solidSide="top"`) (`solid="[data-soft-solid='bottom']"` and
`'top'` on `ZoneSoftEdge`, `solidDarken` in soft-edge.tsx, read by the painter from
`data-soft-solid-at`) and holds to the screen's edge, so the image reaches 100% black there (Frank's calls, 2026-11-12); the blur still
runs to the screen's edge. The CSS path stacks masked `backdrop-filter` bands. On the WebGPU path
the page painter blurs what is already painted in the edge's box (`drawSoftEdge` in `src/glass/paint/paint.ts`; iPhone
Safari has no canvas `filter`, so `mipBlur` halves the copy step by step and doubles it back, since one large downscale
drew blocks), so an edge must come after what it blurs in the DOM and before what
stays sharp. The active workout's focus screen therefore uses grid rows, never `order` (which reorders CSS painting):
Art, the two `ZoneSoftEdge`s, header, controls, then the timer row and progress bar. Its edges run edge to edge, from the
screen's top to 32pt under Up next and from its bottom to 32pt above the controls (doubled from 16pt, Frank's
call, 2026-11-12, so the image fades further); they replaced the 65% fades.

Start Workout's edge and the tab bar's share one tuned edge (Frank's calls, 2026-11-13): a blur and one gradient of the
screen's colour, both from the screen's bottom up to a reach above the button or bar, strongest at the bottom, with no
kit tint or darkening (`tuned` on `SoftEdge`, `TunedLayers`; the painter reads `data-soft-tuned` and the `--se-*`
properties). Reach 32pt, blur 10pt, gradient 50% at the bottom (tuned on the phone), tunable per device in Settings' Bottom edge
(`src/lib/soft-edge-tune.ts`, localStorage; its key is renamed when the defaults change). Start Workout's is `live`
(outside the painted page), keeping its CSS blur over the canvas, and shows unless On workout pages is switched off. The tab bar's (`DockEdge` in `tab-bar.tsx`) is on every
page with the bar, which is every page but the active workout and Start Workout, unless Under the tab bar is switched
off; it is painted into the page so the bar's glass sits on the faded page, and its CSS layers are hidden under
`html.gpu`.

## Motion: accordions and the page push

Every accordion expands and collapses (Frank's call, 2026-11-10): `Collapse` and `Disclosure` in
`src/components/collapse.tsx` animate the body's height from 0fr to 1fr on the sheet's curve, and a disclosure's chevron
points down and turns up. A right chevron means another page. Never use a bare `<details>`: it snaps open, and the
painter draws it even when it is closed.

Going to a page pushes it as UINavigationController does (Frank's call, 2026-11-10). Forward, the new page slides in
from the right over the old one, which drifts a quarter of the width left and dims. Back reverses it. Tab switches and
query-only changes (a calendar day) don't push. Tabs switch instantly with no transition, by Frank's call
(2026-11-10), checked against the iOS 27 HIG (Motion: avoid motion on frequent interactions); only the tab bar's lens
moves. The reasoning and sources for all three motions (push, tab switch, accordion) are in
`Templates/liquid-glass/liquid-glass-reference.md` in the vault, under Navigation transitions. The timing and layer arithmetic is pure and tested in
`src/lib/page-push.ts`: UIKit's curve 7 (90% of the way at 250ms, done at 500ms), with the sources in its header, not
yet measured on iOS 26. `PageTransitions` (in the root layout) starts a push
on a link tap, on a `data-nav="back"` link (a `GlassCircleLink` whose label starts with "Back") or `BackButton`, and on
history back. A `data-nav="none"` area (the tab bar) never pushes. The push runs in the glass stage's page pass
(`src/glass/nav-state.ts`, the NAV uniforms in `stage.ts`): the tap copies the painted page, the stage holds it until
the new route has rendered (2s at most), and then it slides the copy against the live page, so the bars stay put.
On the CSS path (before WebGPU is ready) nothing pushes. A control outside the painted page (`[data-unpainted]`, such as
the workout page's Start Workout) slides itself with `.push-in` / `.push-in-back` when it mounts during a push.
Programmatic navigation (`router.push`, a server action's redirect) does not push yet.

Every toolbar back control is `BackButton` with a `fallback`, never a link (2026-11-13, after the workout page's
Back, a link to Library > Workouts, looped with that page's history Back). `src/lib/nav-index.ts` (tested) numbers
each history entry by wrapping `pushState` and `replaceState` (installed in `PageTransitions`): Back goes through
history when a page of ours is behind, else replaces the page with its parent, never pushes (a push loops). History's
Back to Home stays a link. `completeWorkout` and `discardWorkout` redirect with `RedirectType.replace`, so Back never
lands on a finished or discarded workout.

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
  content has scrolled under the bar. The bottom dock has the tuned
  bottom edge, on by default and switched in Settings (Frank's call,
  2026-11-13, replacing 2026-10-11's no edge; see "Soft scroll edge").
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
  scrolls, so nothing can drift. The cards are painted glass, part of the
  page (see "Active workout"). Glass outside the dock is hidden on the
  WebGPU path when its HTML is `visibility: hidden` (`stage.ts`). Any lifted
  glass or live field in the page is lifted over the canvas by `z-index: 6`, so nothing between it
  and the root may make a stacking context (a z-index, `position: fixed`,
  a transform or `translate`, opacity): one sinks the glass's contents
  under the opaque canvas and only the material shows. That is why the
  focus screen is `absolute` under `html.gpu` (so a focused number field
  shows while typing), its content has no z-index, and the keyboard
  `translate` applies to the top and dock units only.

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
