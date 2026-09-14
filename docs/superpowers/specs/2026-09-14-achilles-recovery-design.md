---
project: workout-app
type: design-spec
status: draft-for-review
created: 2026-09-14
updated: 2026-09-14
---

# Achilles Recovery Layer: Design

## 1. Purpose and scope

The app described in `docs/planning.md` (calendar home, start a workout from a template, log every set) gains a recovery layer. The recovery layer knows the clinical protocol, where the user is in it, the appointments ahead, the daily checks, and which exercises are safe to put in a template right now. Templates and workouts stay the same objects they already are.

Everything from the Achilles project goes in. This spec covers the data model, the domain rules, the seed pipeline, the exercise review gate, and the tests. It does not cover screens or the visual design system. Those get a separate spec after a review of Apple's UI conventions, because the user does not want a page per feature and wants the recovery material folded into the existing screens.

## 2. Sources, authority, privacy

Sources live in the vault at `/Users/quitefrank/Claude/Personal/raw/achilles/`, outside this repository:

| File | Role |
|---|---|
| `01-CLAUDE-CODE-STARTER.md` | The brief. Hard-won rules, the gym inventory, the Notion schema, mistakes to avoid |
| `02-CASE-FILE.md` | Patient, injury, equipment, timeline, open questions. Personal |
| `03-PROTOCOL-RECONCILED.md` | Handout merged with the Willits appendix, dated |
| `04-EVIDENCE-BASE.md` | The literature, graded |
| `05-SOURCE-DOCUMENTS.md` | Verbatim handout transcription. Primary source |
| `06-CONDITIONING-AND-TRAINING.md` | Training during immobilisation, blocks A to F |
| `07-REDDIT-FIELD-NOTES.md` | 2,238 patient comments. Anecdote throughout |
| `achilles-recovery-program.html` | The prototype. Behaviour and content reference |
| `handout-page-1.jpg`, `handout-page-2.jpg`, `appendix-table-e1.jpg` | Photographs of the printed protocol |

Authority order for any conflict: the treating surgeon, then the handout (`05`), then the Willits appendix, then the wider literature. Never import a dose from another protocol.

`quitefrank/workout-app` on GitHub is public. Committed files carry no patient detail: no injury date, no clearances, no appointments, no imaging findings, no clinician names. The clinic's generic protocol (phases, percentages, wording) is not patient detail and is committed as seed data. Per-user rows seed from a gitignored local file.

## 3. Vocabulary

Five levels, top to bottom:

| Term | Table | Meaning |
|---|---|---|
| Program | `programs` | A multi-week programme with phases and sources. The recovery protocol is one. A normal training programme is another. |
| Phase | `program_phases` | A span of weeks inside a program with its own guidance |
| Template | `templates` | One day's prescription: exercises, sets, reps. The 18 Notion day templates and the four Achilles workouts |
| Workout | `workouts` | A template performed on a date |
| Set | `sets` | One logged set |

This renames the existing `programs` and `program_exercises` tables to `templates` and `template_exercises`, and `workouts.program_id` to `workouts.template_id`. The schema has never been pushed to a Supabase project, so `0001_initial_schema.sql` is edited in place rather than migrated. `scripts/seed-from-notion.ts`, `README.md`, `CLAUDE.md` and the vocabulary table in `docs/planning.md` change to match.

## 4. Data model

### 4.1 Enums

| Enum | Values |
|---|---|
| `support_type` | hanging, lying, seated_supported, standing_supported, standing_free |
| `load_direction` | vertical, sagittal, lateral, none |
| `equipment_item` | cable_tower, dumbbells, adjustable_bench, half_rack, pull_up_bar, plate_tree, mat, medicine_ball, stability_ball, treadmill, elliptical, stepper, spin_bike, upright_bike, resistance_band, hanging_ab_straps, barbell, rower, leg_press, calf_machine, assisted_pull_up, captains_chair, chest_press_machine, shoulder_press_machine, step_platform, bathroom_scale |
| `program_kind` | recovery, training |
| `clearance_kind` | weight_bearing, ankle_rom, wedge_removal, boot_weaning, out_of_boot, strength_gate |
| `clearance_source` | clinic, self, planned |
| `event_kind` | appointment, milestone, reminder |
| `rule_kind` | rule, prohibition |
| `source_kind` | trial, review, cohort, handout, convention, anecdote |

`load_direction` splits the brief's "horizontal" into sagittal and lateral. That is the difference between a seated cable row, which passed, and a seated Pallof press, which failed.

### 4.2 `exercises` additions

| Column | Type | Shown in UI | Purpose |
|---|---|---|---|
| `slug` | text, unique | no | Normalised name for matching Achilles rows to Notion rows. Arrows stripped, lower case, hyphens; machine-location variants get a `-upstairs` or `-downstairs` suffix |
| `support_required` | support_type, nullable | yes | The one safety attribute a screen may display |
| `load_direction` | load_direction, nullable | no | Authoring input |
| `loads_booted_foot` | boolean, nullable | no | Authoring input |
| `ankle_involvement` | boolean, nullable | no | Authoring input |
| `floor_transfer_required` | boolean, nullable | no | Authoring input |
| `equipment_needed` | equipment_item[], nullable | no | Authoring input |
| `min_hours_between_sessions` | integer, nullable | no | Authoring input. 72 for pull-ups |
| `max_sessions_per_week` | integer, nullable | no | Authoring input. 2 for pull-ups |
| `video_verified_at` | timestamptz, nullable | yes, as a badge | Set only after the URL was fetched and its title matched the exercise |

Authoring inputs are stored so the rules in section 5 can run against them, first in seed tests, later in an in-app template builder. They are never rendered as fields on an exercise. Nullable because the roughly 100 Notion exercises arrive unrated; every Achilles exercise must have all of them set, and a test enforces that.

### 4.3 `templates` additions

| Column | Type | Purpose |
|---|---|---|
| `program_id` | uuid, fk programs, nullable | Which program this template belongs to. Null for the 18 Notion templates |

Plus a join table `template_phases (template_id, phase_id)` recording which phases of the program a template is valid in. The review document in section 8 names the phases for each Achilles template; the working assumption is every phase where the boot is on.

### 4.4 Dose additions

`template_exercises` and `workout_exercises` gain `prescribed_rir_min`, `prescribed_rir_max`, `prescribed_seconds_min`, `prescribed_seconds_max` (integers, nullable). `sets` gains `seconds` (integer, nullable). A prescription is one of reps, RIR, or seconds; the existing `prescribed_reps_*` columns stay for reps. Cues ("Step up from the bench already in the rack") go in the existing `notes` column on `template_exercises`.

### 4.5 `exercise_alternates` addition

`notes` (text, nullable): when and why to use the alternate. The existing `position` (1 or 2) maps onto Notion's Sub Option 1 and 2.

### 4.6 Library tables (new)

Any authenticated user reads; the service role writes.

**`programs`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `name` | text |
| `kind` | program_kind |
| `description` | text |
| `citation` | text, nullable |
| `authority_notes` | text, nullable |
| `source_id` | uuid fk sources, nullable |
| `created_at`, `updated_at` | timestamptz |

**`program_phases`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `program_id` | uuid fk programs |
| `position` | integer |
| `label` | text |
| `week_from` | integer |
| `week_to` | integer, nullable (open-ended) |
| `load_pct` | integer, nullable |
| `gate` | text, nullable ("80% strength") |
| `guidance` | jsonb: ordered array of `{ heading, items[] }` |
| `flag` | text, nullable |
| `flag_source_id` | uuid fk sources, nullable |

Weeks count from day 0 of the enrolment (`recoveries.injury_date` for a recovery program). The recovery program's phases are the handout in `05`, as printed. Nothing is shifted. No offset column exists anywhere.

**`sources`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `citation` | text |
| `url` | text, nullable |
| `kind` | source_kind |
| `quality` | text (the grade as written in `04` and `06`) |
| `notes` | text, nullable |

### 4.7 Per-user tables (new)

RLS on `auth.uid()` through `recoveries.user_id`.

**`recoveries`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `user_id` | uuid fk auth.users |
| `program_id` | uuid fk programs |
| `label` | text |
| `side` | text check in (left, right) |
| `injury_date` | date |
| `notes` | text, nullable |
| `created_at`, `updated_at` | timestamptz |

Day 0 lives here and nowhere else.

**`clearances`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `recovery_id` | uuid fk recoveries |
| `effective_from` | date |
| `kind` | clearance_kind |
| `value_pct` | integer, nullable |
| `value_text` | text, nullable |
| `phase_id` | uuid fk program_phases, nullable: the phase this clearance enters |
| `source` | clearance_source |
| `note` | text, nullable |
| `voided_at` | timestamptz, nullable |
| `created_at` | timestamptz |

Insert-only. The RLS policies allow select and insert, and an update policy that permits changing `voided_at` only. Correcting a clearance means voiding it and inserting a new one, so the trail is never rewritten. This replaces the prototype's `CLEARED` array.

**`events`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `recovery_id` | uuid fk recoveries |
| `date` | date |
| `kind` | event_kind |
| `label` | text |
| `note` | text, nullable |
| `questions` | text[] (things to raise at an appointment) |
| `created_at`, `updated_at` | timestamptz |

Replaces the prototype's `EVENTS` array and the "raise with the clinical team" list in `02`.

**`rules`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `recovery_id` | uuid fk recoveries |
| `position` | integer |
| `kind` | rule_kind |
| `title` | text |
| `detail` | text, nullable |
| `active` | boolean |

The seven rules from the prototype's disclosure plus the ankle range-of-motion prohibition. Per-user because the prohibition is the surgeon's call, not the handout's.

**`daily_checks`**

| Column | Type |
|---|---|
| `id` | uuid pk |
| `recovery_id` | uuid fk recoveries |
| `date` | date, unique with recovery_id |
| `upright_minutes` | integer, nullable |
| `skin_check` | boolean, nullable |
| `scale_recalibrated` | boolean, nullable |
| `pain_0_10` | integer, nullable, check 0 to 10 |
| `numbness` | boolean, nullable |
| `note` | text, nullable |

From the rules disclosure and Block A in `06` (ambient walking bouts building to 45 to 60 upright minutes daily by week 6).

### 4.8 `user_settings` addition

`equipment_available equipment_item[]`, nullable. The gym inventory from `02` plus the home equipment. Authoring input, not a settings screen field until the screens spec says otherwise.

### 4.9 RLS summary

| Tables | Policy |
|---|---|
| `muscle_groups`, `exercises`, `exercise_alternates`, `templates`, `template_exercises`, `template_phases`, `programs`, `program_phases`, `sources` | select for authenticated |
| `workouts`, `workout_exercises`, `sets`, `user_settings` | all, owner via `user_id` (unchanged) |
| `recoveries` | all, owner via `user_id` |
| `events`, `rules`, `daily_checks` | all, owner via `recoveries.user_id` |
| `clearances` | select and insert via `recoveries.user_id`; update restricted to `voided_at` |

Every table has RLS on. The analytics views in `0002` are rewritten for the renamed tables and keep `security_invoker = true`.

### 4.10 Migration files

`0001_initial_schema.sql` is edited in place for the rename (section 3), the dose columns (4.4), and `exercise_alternates.notes` (4.5). `0002_analytics_views.sql` is edited for the rename. Then:

| File | Contents |
|---|---|
| `0003_exercise_authoring.sql` | Enums `support_type`, `load_direction`, `equipment_item`; the `exercises` additions; `user_settings.equipment_available` |
| `0004_programs.sql` | `program_kind`, `source_kind`; `sources`, `programs`, `program_phases`; `templates.program_id`; `template_phases` |
| `0005_recovery.sql` | `clearance_kind`, `clearance_source`, `event_kind`, `rule_kind`; `recoveries`, `clearances`, `events`, `rules`, `daily_checks`; their RLS |

The `_notion_id` columns stay until the Notion seed has run clean once, per the existing plan.

## 5. Domain rules

Pure TypeScript in `src/lib/recovery/`, no Supabase import, every function unit-tested with value assertions.

| Module | Exports | Rule |
|---|---|---|
| `dates.ts` | `dayIndex`, `weekIndex`, `phaseWindow` | Day 0 is `injury_date`. Week is `floor(day / 7)`. A phase's reference window is `injury_date + week_from * 7` to `injury_date + week_to * 7 - 1` |
| `state.ts` | `restrictionState(clearances, today)` | Latest non-voided clearance per kind with `effective_from <= today`. Returns cleared load (0 when no weight_bearing clearance exists), ankle ROM cleared only when an ankle_rom clearance exists, boot status (on until a boot_weaning clearance, weaning until an out_of_boot clearance, then off), wedges removed (count of wedge_removal clearances), strength gate (latest strength_gate value), current phase from the latest clearance that names one, and days since the last clearance for the stale warning (threshold 21 days) |
| `authoring.ts` | `checkExercise(exercise, state, equipment)`, `checkTemplate(template, state, equipment)` | Section 6 |
| `frequency.ts` | `frequencyViolation(exercise, history, proposedDate)` | Returns a violation when the proposed date is inside `min_hours_between_sessions` of the last session containing the exercise, or when `max_sessions_per_week` would be exceeded in the ISO week |
| `dose.ts` | `formatDose`, `parseDose` | "3 x 10-12", "4 x RIR 1-2", "3 x 20-40 sec". `parseDose` reads the prototype's strings for the seed and rejects anything it cannot classify |

## 6. Authoring rules

These are the brief's hard-won rules made executable. They run when a template is built: against the seed data in tests now, inside a template builder later. They do not run at workout time and produce no badges. Each returns `blocked`, `warn`, or `ok` with a reason string.

| # | Rule | Verdict |
|---|---|---|
| 1 | `loads_booted_foot` while boot status is on or cleared load is under 100% | blocked |
| 2 | `ankle_involvement` while ankle ROM is not cleared | blocked |
| 3 | `support_required` is standing_free or standing_supported and `load_direction` is sagittal or lateral, while cleared load is under 100% | blocked. On one leg there is nothing to brace a horizontal pull |
| 4 | `support_required` is standing_free while cleared load is under 100%, any load direction | warn. The prototype has no standing-free exercise for this reason; a hand on the rack is the minimum |
| 5 | `support_required` is seated_supported and `load_direction` is lateral | blocked. The seated Pallof press tipped off the bench |
| 6 | `support_required` is seated_supported and `load_direction` is sagittal | ok. One foot braces a sagittal pull |
| 7 | `load_direction` is vertical with any support other than standing_free | ok. The load pulls into the seat |
| 8 | `floor_transfer_required` and the exercise is not first in the template | warn. Transfers are where falls happen |
| 9 | any item of `equipment_needed` missing from `equipment_available` | warn |
| 10 | any authoring input is null | warn, "unrated" |
| 11 | two templates in the same program both contain an exercise with `min_hours_between_sessions` and no ordering note keeps them apart | warn |

Rule 3 and rule 6 encode the same fact from two sides: the test is not whether the movement can be performed, it is what stops you moving. Rules 1 to 7 have the prototype's 25 exercises as named test cases, with the seated Pallof press and a standing band row as the expected failures.

## 7. Seed pipeline

Order: the Notion seed runs first, the Achilles seed second.

### 7.1 Committed data, `scripts/data/achilles/`

| File | Contents | Source |
|---|---|---|
| `program.ts` | The recovery program row and its phases, wording as printed, guidance groups Boot, Do, Do not, flag text. Side-neutral: "the injured foot", never left or right | `05`, cross-checked against `03` and the prototype's `PHASES` |
| `sources.ts` | Every citation with URL, kind and quality grade | `04`, `06`, footer of the prototype |
| `equipment.ts` | The enum values with display names | `02`, `01` |
| `exercises.ts` | The reviewed exercise list with every authoring input set, video URL and `slug` | Section 8 |
| `templates.ts` | The reviewed templates, exercises in order with dose, cue and alternates | Section 8 |

No patient detail in any of these. Several of the prototype's phase flags mix generic guidance with personal facts (an unanswered prophylaxis question, an imaging finding on the other side). The generic sentence stays in `program.ts`; the personal sentence becomes an `events` row of kind `reminder`, dated at the phase's reference start, seeded from the personal file.

### 7.2 Personal data, gitignored

`scripts/data/achilles/personal.local.json` with a committed `personal.example.json`. Holds the `recoveries` row (label, side, injury date), the clearance history with sources and phase names, the events with their question lists and the phase reminders above, the rules, and `equipment_available`. The example file uses dates in the year 2000.

### 7.3 `scripts/seed-achilles.ts`

1. Load env and `personal.local.json`. Refuse to run if the Notion seed has not populated `muscle_groups`.
2. Upsert `sources`, then `programs`, then `program_phases` (matching on program name and phase position).
3. For each exercise in `exercises.ts`, compute the slug, look it up in `exercises`. If found, update the authoring inputs, and the video fields only when the Achilles URL is verified (a Notion URL is never overwritten by an unverified one). Insert otherwise. Report every miss and every match so mismatches with Notion names get a hand-fix.
4. Upsert `exercise_alternates` with notes.
5. Upsert `templates` (with `program_id`), `template_exercises`, `template_phases`.
6. For `SEED_USER_ID`: upsert `recoveries`, insert `clearances` that are not already present (matched on effective date and kind), upsert `events`, `rules`, `user_settings.equipment_available`.
7. Write `scripts/seed-achilles-report.json`: counts, exercise matches and misses, any dose string `parseDose` rejected, any exercise whose video is unverified.

Idempotent. Running it twice changes nothing.

## 8. Exercise review and video verification

A gate before any exercise or template data is written.

`docs/achilles-exercise-review.md` covers the prototype's 25 exercises and proposes alternatives. For each exercise: the authoring inputs, the verdict from every rule in section 6, the equipment check against the gym in `02`, a keep, swap or add recommendation with the reason, and a candidate demo URL. It closes with alternative programme structures worth considering beyond the current four templates, each argued from `04` and `06` and labelled by the strength of its evidence. The user approves the document; the approved content becomes `exercises.ts` and `templates.ts`. The review document itself contains no patient detail.

Video verification: each candidate URL is fetched, must resolve, and its page title must name the exercise. Only then is `video_verified_at` set. Anything that fails stays null and is listed in the seed report.

## 9. Testing

| Layer | What is asserted | Tool |
|---|---|---|
| Domain modules | Every function in section 5 with value assertions. `dates.ts` includes a case proving no offset exists: day 0 equals the injury date and week boundaries follow from it alone | Vitest |
| Authoring rules | Section 6, with the 25 prototype exercises as named cases and the two known failures | Vitest |
| Seed data integrity | Every Achilles exercise has every authoring input; every template exercise resolves to an exercise; every dose string parses; every phase in `program.ts` matches `05` on weeks and percentages; no file under `scripts/data/achilles/` other than the gitignored personal file contains an ISO date, the word "ultrasound", or the whole words "left" or "right". Cues stay second person; that is instruction, not patient detail | Vitest |
| Existing parsers | The 63 tests keep passing after the rename | Vitest |
| Lint | `no-redeclare` added | ESLint |
| Build | `bun run build` clean | Next |
| Migrations | `supabase db push` applies from empty; a smoke script signs in as the seed user and confirms a select on each per-user table returns only that user's rows | Manual, in the plan |

## 10. Build map

| Plan | Delivers | Ends when |
|---|---|---|
| 0 Infra | Supabase project created and linked, `.env.local`, auth user, migrations pushed, Notion seed run, `seed-report.json` reviewed and hand-fixes applied | Notion data visible in the Supabase dashboard |
| 1 Schema and domain | Rename in `0001` and `0002`, migrations `0003` to `0005`, seed script updated for the rename, generated types, the five domain modules with tests | Tests green, `db push` clean |
| 2 Content | Review document written and approved, videos verified, seed data files, `seed-achilles.ts`, seed run, report reviewed | All 25 exercises and four templates in Supabase with the recovery program and personal rows |
| 3 onward | Screens and design system | Defined by the screens spec |

Plans 0 to 2 need nothing from the screens spec. Plan 0 needs the user's Supabase and Notion credentials.

## 11. Risks

- Notion exercise names will not all match Achilles names by slug. The seed report lists misses; the fix is a hand edit in `exercises.ts` or in the library, not a fuzzy matcher.
- The roughly 100 Notion exercises stay unrated on the authoring inputs until someone rates them. Rule 9 makes that visible in the review, not a silent pass.
- The rename touches `seed-from-notion.ts` in eleven places. The 63 parser tests do not cover the seed script's table writes, so Plan 0's dashboard check is the verification.
- `guidance` as jsonb is display content, not queried data. If a query ever needs it, normalise then.

## 12. Deferred to the screens spec

Every route, the calendar home's recovery strip, the protocol chart, the clearance and event forms, the daily check-in, the template and workout screens with timed sets and RIR, the library and analytics additions, settings, sources, the theme, the Tailwind tokens, the contrast and type audits, PWA polish, and deployment. Also deferred: an in-app template builder that runs section 6 live, and runtime eligibility badges, which the user has said he does not want as UI.
