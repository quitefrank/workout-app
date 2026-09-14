# Achilles exercise review

The gate before any exercise or template data is written for the recovery programme. Every candidate below was rated on the six authoring inputs and the two caps, then run through the real rule engine (`checkExercise` and `checkSpacing` in `src/lib/recovery/authoring.ts`) in a scratch script. Nothing was eyeballed. The user approves this document; the approved rows become `scripts/data/achilles/exercises.ts` and `templates.ts` in Task 3.

**Precedence.** The 416 Physio article's 14 exercises anchor the templates and carry the demonstration clips. The prototype's 22 exercises fill what the article does not cover: calf work, loaded pulling, hanging work, and the cable and dumbbell isolation the article has no equipment for. Where an article exercise trips a rule it is kept and the template row records the override, rule number and reason. Where the prototype duplicates the article, the article row wins and the prototype row becomes an alternate or merges.

**Sources consulted.** `01` (the hard-won rules, the gym inventory, the pull-up cap), `04` section "Training During Immobilisation" (cross-education), `05` (what the handout permits in weeks 2 to 6: protected weight-bearing in the boot at the cleared percentage, knee and hip work with no ankle involvement, non-weight-bearing cardio with the boot on; the appendix names leg lifts from sitting, prone or side-lying and one-leg bicycling), `06` blocks A to C and the equipment section, `08` (the article, written by a physiotherapy practice for a generic walking-boot audience), and the prototype's `D_PULL`, `D_LEG`, `D_PUSH`, `D_PULL2` arrays. Nothing from the case file appears here.

**Restriction state used.** Now: cleared load 75%, ankle range of motion not cleared, boot on, no wedges removed. Weaning: cleared load 100%, boot weaning, ankle still not cleared. Both states block rule 1 (the engine treats weaning as boot on) and rule 2. Rule 3 and rule 4 fire only at partial load, so they separate the two states.

**Equipment list used.** The building gym plus the home kit from `06`: cable towers, dumbbells to 40 lb, adjustable bench in the half rack, plate tree, mat, medicine ball, stability ball, treadmill, elliptical, stepper, spin bike, upright bike, pull-up bar, resistance bands, hanging ab straps, bathroom scale. Floor-transfer items were run at position 1 and everything else at position 3, per the plan; the proposed templates were then re-run at their real positions.

## How to read a verdict

Each verdict is a level and a rule number from spec section 6. `blocked` means the row cannot be seeded without an override. `warn` means the row seeds but the reason is recorded. `ok` names the rule that passed it: 6 (seated with a sagittal load, one foot braces it), 7 (vertical load pulls into the support) or 0 (nothing triggered). The rules: 1 loads the booted foot while the boot is on or load is under 100%; 2 ankle involvement before range of motion is cleared; 3 standing against a horizontal load at partial weight; 4 standing free at partial weight; 5 seated against a lateral load; 8 floor transfer not first in the template; 9 equipment missing; 10 an input still null; 11 two templates share a capped exercise with no spacing note. An override keeps the exercise in: the template row records which rule it breaks and why. The reason in every case below is the handout's own allowance for protected weight-bearing in the boot at the cleared percentage from week 2. The article's partial-weight-bearing section is exactly that. The rule engine is stricter than the handout on this point and the override is where that gap is written down.

Two rating conventions, stated once. `ankle` means the injured ankle; the sound-leg calf raise moves the sound ankle and is rated no. `load` is the line the external load pulls along: dumbbells and bodyweight pull vertical, cables and bands pull along their anchor line (sagittal or lateral), and a closed band loop between your own knees or an unloaded floor movement is none.

## 416 Physio exercises (14)

Clips are Vimeo id and hash, extracted from the article HTML in document order and each confirmed by title through Vimeo's oEmbed today. Embed URL is `https://player.vimeo.com/video/<id>?h=<hash>`. Support values: lying, seated (seated_supported), standing (standing_supported), hanging.

| name | clip | library slug or NEW | support | load | booted foot | ankle | floor | equipment | verdict now | verdict weaning | keep / override / drop | why |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Straight Leg Raises | 1131834121, 7c25a0f7d7 | NEW `straight-leg-raises` | lying | none | no | no | yes | mat | ok (0) | ok (0) | keep | The appendix names leg lifts from lying as week 2 work. Alternate: the prototype's seated version, no floor transfer |
| Side-Lying Hip Abductions | 1132227018, 12fe6ede9c | NEW `side-lying-hip-abductions` | lying | none | no | no | yes | mat | ok (0) | ok (0) | keep | Article cue keeps the ankle relaxed in the boot. Alternate: the prototype's seated band abduction |
| Leg Extensions with Band | 1132227414, 971f218e2b | NEW `leg-extensions-with-band` | seated | sagittal | no | no | no | band, bench | ok (6) | ok (6) | keep | Band loops over the boot at the ankle; the boot holds the ankle still. Anchor to the rack upright behind the bench. Library `leg-extensions` is a machine |
| Glute Bridges | 1117498689, d52633a987 | NEW `glute-bridges-in-a-walking-boot` | lying | vertical | yes | no | yes | mat | blocked (1) | blocked (1) | override rule 1 | Push through both heels with the ankle locked; the booted heel takes no more than the cleared percentage. Article's "per side" is a copy error, a bridge is bilateral. Named as in the plan's worked example so it sits apart from the library's `glute-bridge`. No-override alternate: single-leg bridge on the sound leg (NEW, reviewer-added) |
| Ball Wall Squats | 1132237887, c7bff3ce44 | NEW `ball-wall-squats` | standing | vertical | yes | no | no | stability ball | blocked (1) | blocked (1) | override rule 1 | Mini squat inside the boot's range, weight split at the cleared percentage. Same "per side" copy error. No-override alternate: the prototype's sound-leg wall sit |
| Sit-to-Stand from a High Surface | 1117498539, ed815dfe11 | NEW `sit-to-stand-from-a-high-surface` | standing | vertical | yes | no | no | bench, rack | blocked (1) | blocked (1) | override rule 1 | The article's own progression starts with weight mostly through the sound side and arms for support; one hand on the rack. No-override alternate: single-leg sit-to-stand, sound leg (the prototype's wall-sit alternate) |
| Tricep Extensions (supine) | 1132246391, 8753f7f001 | NEW `tricep-extensions-supine` | lying | vertical | no | no | yes | mat, dumbbells | ok (7) | ok (7) | keep | The clip is the supine variation, boot resting on a chair (the bench, in the gym). Own row: the library's `floor-skullcrushers` has no boot rest. Alternate: the prototype's seated cable pushdown |
| Shoulder Press | 1117498397, d2af511a8d | `db-shoulder-press` | seated | vertical | no | no | no | dumbbells, bench | ok (7) | ok (7) | keep | Same movement at the same station as the library row and the prototype's row. The library row carries a Notion demo link the seed would replace with this clip; see open items |
| Banded Rows (seated) | 1117498366, 4192d25fe9 | NEW `banded-rows-seated` | seated | sagittal | no | no | no | band, bench | ok (6) | ok (6) | keep | The article offers sit or stand. Seated passes rule 6. The home-kit row; the cable row is the loaded gym version |
| Banded Rows (standing) | same clip | no row | standing_free | sagittal | no | no | no | band | blocked (3), warn (4) | ok (0) | drop | Both hands on the handles, nothing to brace a horizontal pull on one leg. Clears at 100% load, when rule 4 clears too. Not seeded |
| Seated Russian Twists | 1117498450, 6d44a545db | NEW `seated-russian-twists` | seated | vertical | no | no | yes | mat, medicine ball | ok (7) | ok (7) | keep | Feet flat on the mat with the boot on. The held weight pulls down; nothing anchored pulls sideways, so rule 5 does not apply. Placed in Recovery Pull as its floor opener |
| Supine Marches | 1117498578, 710ae9cd08 | NEW `supine-marches` | lying | none | no | no | yes | mat | ok (0) | ok (0) | keep | Hip flexion with the knee bent; the resting foot sits flat and does not drive |
| Front Plank | 1132534126, b956595f59 | NEW `front-plank` | lying | none | no | no | yes | mat | ok (0) | ok (0) | keep | The article's cue crosses the booted leg over the sound one, so only the sound toes bear. Placed in Recovery Push's floor block |
| Modified Push Ups | 1132534236, 1f97d4db14 | NEW `modified-push-ups` | standing | vertical | no | no | no | bench | ok (7) | ok (7) | keep | Hands on the bench in the rack. The article says nothing about the feet; this row borrows the plank cue (booted leg crossed over the sound one) so nothing goes through the boot. The wall version is the built-in regression |
| Stationary Bike (one leg) | 1132558822, 5fbba43004 | NEW `stationary-bike-one-leg` | seated | vertical | no | no | no | upright bike | ok (7) | ok (7) | keep as an exercise, outside the strength templates | The appendix lists one-leg bicycling from week 2 and `06` block A lists it as optional. The brief says neither building bike has a boot rest and both need a leg swung over the frame; see open items. `parseDose` has no minutes, so a cardio template row needs a dose format first |
| Stationary Bike (both feet) | same clip | no row | seated | vertical | yes | no | no | upright bike | blocked (1) | blocked (1) | drop until phase 6 | The handout adds weight-bearing cardio in weeks 6 to 8. Rule 1 blocks whenever the boot is on, so a phase 6 to 7 cardio template would carry a rule 1 override citing that line |

Not among the 14, no clip: pool work is a question for the treating physician (the boot comes off in water; `06` flags the contradiction with the handout's hydrotherapy line). The SkiErg is neither in the gym nor in the equipment enum. Both dropped.

Expected outcomes from the plan, confirmed by the engine: bridge and ball wall squat block on rule 1 and are kept with an override; sit-to-stand blocks on rule 1 for the same reason and is kept the same way, which the plan did not list; the standing banded row blocks on rule 3 and the seated variant passes; the two-foot bike is out until phase 6 and the one-leg variant passes.

## Prototype exercises (22)

Same columns, plus a demo URL column. Library rows already carry a Notion demo link (unverified, `video_verified_at` null); the seed leaves those alone unless a verified URL replaces them. NEW rows have no URL yet and Task 3 searches for one, two attempts each.

### Pull (`D_PULL`)

| name | library slug or NEW | support | load | booted foot | ankle | floor | equipment | verdict now | verdict weaning | keep / alternate / merge / drop | why | demo URL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pull-ups | `pull-ups` | hanging | vertical | no | no | no | pull-up bar (the rack bar in the gym, bench for the mount) | ok (7) | ok (7) | keep, Recovery Pull | Fills the hanging pull gap. Caps 72 h and 2 per week, from the brief. Alternates: seated cable pulldown and single-arm cable pulldown (both NEW, both ok 7) | library Notion link |
| Seated cable row | `cable-seated-row` | seated | sagittal | no | no | no | cable tower | ok (6) | ok (6) | keep, Recovery Pull | The loaded row. Alternates: `incline-chest-supported-db-row` (library), single-arm cable row (NEW). Seat at the towers to confirm; see open items | library Notion link |
| Seated cable face pull | NEW `seated-cable-face-pull` | seated | sagittal | no | no | no | cable tower | ok (6) | ok (6) | keep, Recovery Pull | Library's `omni-direction-face-pull-*` rows are a machine at another location. Alternates: cable rear delt fly (`reverse-cable-flies`), prone dumbbell rear delt row (NEW) | to find, Task 3 |
| Seated dumbbell curl | `db-curls` | seated | vertical | no | no | no | dumbbells, bench | ok (7) | ok (7) | keep, Recovery Pull | Alternate: `cable-curl`, seated at the low pulley | library Notion link |
| Hanging knee raise | `hanging-leg-raise` | hanging | vertical | no | no | no | pull-up bar | ok (7) | ok (7) | keep, Recovery Pull | The bent-knee regression of the library row, same bar. Alternates: seated cable crunch (NEW), dead bug (`dead-bug-kicks`, a floor item, so only usable if it moves to the template's floor block) | library Notion link |

### Sound Leg (`D_LEG`)

| name | library slug or NEW | support | load | booted foot | ankle | floor | equipment | verdict now | verdict weaning | keep / alternate / merge / drop | why | demo URL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Single-leg calf raise, sound leg | NEW `single-leg-calf-raise-sound-leg` | standing | vertical | no | no (sound ankle) | no | rack, dumbbells | ok (7) | ok (7) | keep, Recovery Legs | The highest-value item per `04`: homologous-muscle cross-education against the primary long-term deficit. Library `standing-calf-raise` is the two-leg row. The bodyweight version with both hands on the frame is the same row at lower load, a note rather than an alternate | to find, Task 3 |
| Seated dumbbell calf raise, sound leg | NEW `seated-dumbbell-calf-raise-sound-leg` | seated | vertical | no | no (sound ankle) | no | dumbbells, bench | ok (7) | ok (7) | keep, Recovery Legs | Soleus. Library `seated-calf-raise` is a machine | to find, Task 3 |
| Wall sit, sound leg | NEW `wall-sit-sound-leg` | standing | vertical | no | no | no | bench behind you | ok (7) | ok (7) | alternate of Ball Wall Squats | The no-override version of the article's wall squat. Its own alternate, single-leg sit-to-stand from the high bench (NEW `single-leg-sit-to-stand-sound-leg`, ok 7), doubles as the no-override alternate for the article's sit-to-stand | to find, Task 3 |
| Seated band hip abduction | NEW `seated-band-hip-abduction` | seated | none | no | no | no | band, bench | ok (0) | ok (0) | alternate of Side-Lying Hip Abductions | Closed band loop between your own knees; nothing pulls you toward an anchor, so rule 5 does not apply | to find, Task 3 |
| Straight-leg raise, injured side | NEW `straight-leg-raise-injured-side` | seated | none | no | no | no | bench | ok (0) | ok (0) | alternate of Straight Leg Raises | The article's lying version carries the clip; the seated version skips the floor transfer | to find, Task 3 |

### Push (`D_PUSH`)

| name | library slug or NEW | support | load | booted foot | ankle | floor | equipment | verdict now | verdict weaning | keep / alternate / merge / drop | why | demo URL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Seated dumbbell shoulder press | `db-shoulder-press` | seated | vertical | no | no | no | dumbbells, bench | ok (7) | ok (7) | merge into the article's Shoulder Press | Same row. The article's dose (2-3 x 8-12) replaces the prototype's (4 x 10-12) by precedence; see open items. Alternate: seated cable press (NEW, ok 6) | library Notion link |
| Dumbbell bench press | `db-bench-press` | lying (bench) | vertical | no | no | no | dumbbells, bench, rack | ok (7) | ok (7) | keep, Recovery Push | Boot resting on the floor, not pushing. Alternate: dumbbell floor press (NEW, floor item) | library Notion link |
| Seated cable fly | NEW `seated-cable-fly` | seated | sagittal | no | no | no | cable tower | ok (6) | ok (6) | keep, Recovery Push | Two-arm and symmetric: the lateral components cancel and the net pull is backward. A single-arm version would be lateral and fail rule 5. Alternate: `dumbbell-flyes` | to find, Task 3 |
| Seated dumbbell lateral raise | `bench-db-lateral-raise` | seated | vertical | no | no | no | dumbbells, bench | ok (7) | ok (7) | keep, Recovery Push | The library's `db-lateral-raise` is the standing row, which rule 4 would warn on; the bench row is the seated one | library Notion link |
| Seated cable pushdown | NEW `seated-cable-pushdown` | seated | vertical | no | no | no | cable tower | ok (7) | ok (7) | alternate of Tricep Extensions (supine) | The cable from the high pulley pulls up, so vertical. No floor transfer | to find, Task 3 |
| Seated suitcase hold | NEW `seated-suitcase-hold` | seated | vertical | no | no | no | dumbbells, bench | ok (7) | ok (7) | keep, Recovery Push | Anti-lateral-flexion with a vertical load: the job of the Pallof press without the sideways pull that tipped it off the bench. Alternates: side plank on knees (NEW, floor item), dead bug | to find, Task 3 |

### Pull light (`D_PULL2`)

| name | library slug or NEW | support | load | booted foot | ankle | floor | equipment | verdict now | verdict weaning | keep / alternate / merge / drop | why | demo URL |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Pull-ups, reduced volume | `pull-ups` | hanging | vertical | no | no | no | pull-up bar | ok (7) | ok (7) | merge into Pull-ups | Same row, lighter dose (3 x leave 2-3 in reserve). Becomes the second weekly run of Recovery Pull | library Notion link |
| Single-arm cable row | NEW `single-arm-cable-row` | seated | sagittal | no | no | no | cable tower | ok (6) | ok (6) | alternate of Seated cable row | Off-centre sagittal pull, still braced by one foot | to find, Task 3 |
| Cable rear delt fly | `reverse-cable-flies` | seated | sagittal | no | no | no | cable tower | ok (6) | ok (6) | alternate of Seated cable face pull | Same station and movement as the library row; rated seated, high pulleys crossed | library Notion link |
| Seated cable pull-apart | none | seated | sagittal | no | no | no | cable tower | ok (6) | ok (6) | drop | Covered by the face pull and the rear delt fly | none |
| Seated dumbbell curl (light) | `db-curls` | seated | vertical | no | no | no | dumbbells, bench | ok (7) | ok (7) | merge into Seated dumbbell curl | Same row, lighter dose | library Notion link |
| Dead bug | `dead-bug-kicks` | lying | none | no | no | yes | mat | ok (0) at slot 1; warn (8) at slot 3 | same | alternate of Hanging knee raise and Seated suitcase hold | Floor item. Rated against the library's dead-bug row, same mat and same pattern | none in library |

Tally: 11 kept as template rows, 7 become alternates, 3 merge into the same row as another candidate, 1 dropped.

## Proposed templates

Three templates, the recovery programme's own Push, Pull and Legs in the boot, separate from any training programme that follows. Article rows first where the movement allows, prototype rows fill the gaps, floor work first in every template. The plan's shape is kept with two moves: the front plank goes to Recovery Push and the Russian twist opens Recovery Pull, so each template starts with a floor block and no single session carries the whole of the article's core section. Legs was ten rows with both in it. Cues are the article's where a clip exists and the prototype's verbatim otherwise; doses are strings `parseDose` accepts, all checked.

Phase validity by position in `05`: Recovery Push and Recovery Pull in phases 1 to 7. Recovery Legs in phases 2 to 7, because three of its rows are rule 1 overrides that rely on a cleared percentage above zero. Nothing here is valid past phase 7; out of the boot the user moves to a training programme.

### Recovery Legs (phases 2 to 7)

| # | exercise | slug | dose | cue | clip | override |
|---|---|---|---|---|---|---|
| 1 | Straight Leg Raises | `straight-leg-raises` | 2-3 x 8-12 each side | Keep knee locked and movement controlled | 1131834121 | |
| 2 | Side-Lying Hip Abductions | `side-lying-hip-abductions` | 2-3 x 10-15 each side | Keep your ankle relaxed in the boot and make sure your leg does not drift forward | 1132227018 | |
| 3 | Supine Marches | `supine-marches` | 2-3 x 10-15 each side | Lift one leg a few inches, alternate like a slow march; keep core engaged and hips steady | 1117498578 | |
| 4 | Glute Bridges | `glute-bridges-in-a-walking-boot` | 2-3 x 10-15 | Push through heels to lift hips until shoulders, hips, and knees form a line; hold briefly, then lower | 1117498689 | rule 1: protected weight-bearing in the boot at the cleared percentage is what the handout permits from week 2; the bridge loads the heel through the boot with the ankle locked |
| 5 | Leg Extensions with Band | `leg-extensions-with-band` | 2-3 x 10-15 each side | Avoid locking the knee out fully | 1132227414 | |
| 6 | Sit-to-Stand from a High Surface | `sit-to-stand-from-a-high-surface` | 2-3 x 8-10 | Weight mostly through the sound side to start, one hand on the rack; even weight only as the cleared percentage allows | 1117498539 | rule 1: same handout allowance; the article's own progression keeps the booted foot under the cleared percentage |
| 7 | Ball Wall Squats | `ball-wall-squats` | 2-3 x 10-15 | Lower into a mini squat keeping weight balanced within available range; push back up slowly. To increase difficulty, add weight in hand | 1132237887 | rule 1: same handout allowance; a mini squat inside the boot's range with the weight split |
| 8 | Single-leg calf raise, sound leg | `single-leg-calf-raise-sound-leg` | 4 x 10-15 slow | One hand on the rack upright, dumbbell in the other. Knee straight, so this is gastrocnemius: the homologous muscle to the one you are protecting, and the highest-value item of your week. No step in this gym, so you lose some range at the bottom | | |
| 9 | Seated dumbbell calf raise, sound leg | `seated-dumbbell-calf-raise-sound-leg` | 3 x 12-15 | Sitting on the bench, dumbbell resting on the sound knee. Knee bent, which shifts the work to soleus. No balance demand at all | | |

Engine at real positions, now: 1 ok (0); 2 warn (8); 3 warn (8); 4 blocked (1), warn (8); 5 ok (6); 6 blocked (1); 7 blocked (1); 8 ok (7); 9 ok (7). The three blocks are the recorded overrides. The three rule 8 warnings are the finding in the next paragraph.

### Recovery Push (phases 1 to 7)

| # | exercise | slug | dose | cue | clip | override |
|---|---|---|---|---|---|---|
| 1 | Tricep Extensions (supine) | `tricep-extensions-supine` | 2-3 x 8-12 | Lie on back, boot resting on the bench. Keep movements slow and steady without swinging | 1132246391 | |
| 2 | Front Plank | `front-plank` | 3 x 10-30 sec | Keep body in a straight line, brace core, avoid sagging hips. Booted leg crossed over the other one | 1132534126 | |
| 3 | Shoulder Press | `db-shoulder-press` | 2-3 x 8-12 | Keep your back tall and avoid arching | 1117498397 | |
| 4 | Dumbbell bench press | `db-bench-press` | 3 x 10-12 | Bench flat, boot resting on the floor, not pushing | | |
| 5 | Seated cable fly | `seated-cable-fly` | 3 x 12-15 | Pulleys at shoulder height, sitting between the towers | | |
| 6 | Seated dumbbell lateral raise | `bench-db-lateral-raise` | 3 x 12-15 | Light, high reps, controlled | | |
| 7 | Modified Push Ups | `modified-push-ups` | 2-3 x 8-12 | Hands on the bench, lower chest toward it with elbows angled slightly back; push back up with control. Booted leg crossed over the sound one | 1132534236 | |
| 8 | Seated suitcase hold | `seated-suitcase-hold` | 3 x 20-30 sec each side | Sit tall on the bench, one heavy dumbbell hanging at your side, nothing in the other hand. Resist the side-bend. Same job as a Pallof press, resisting sideways collapse, but the load pulls straight DOWN instead of sideways, so there is nothing trying to tip you off the bench | | |

Engine at real positions, now: 1 ok (7); 2 warn (8); 3 to 8 ok (7, 7, 6, 7, 7, 7).

### Recovery Pull (phases 1 to 7)

| # | exercise | slug | dose | cue | clip | override |
|---|---|---|---|---|---|---|
| 1 | Seated Russian Twists | `seated-russian-twists` | 2-3 x 10-15 | Sit tall on the mat, feet flat, light weight or ball. Rotate torso side to side keeping spine tall | 1117498450 | |
| 2 | Pull-ups | `pull-ups` | 4 x leave 1-2 in reserve | Step up from the bench already in the rack. Both hands on the bar before you shift weight. Step down onto the sound leg, never drop | | |
| 3 | Hanging knee raise | `hanging-leg-raise` | 3 x 10-15 | Only worth it if you are already at the bar. Zero foot contact, controlled, no swing | | |
| 4 | Seated cable row | `cable-seated-row` | 3 x 10-12 | Low pulley, sound foot braced on the frame, boot resting. Seated is what makes this work: the bench takes the reaction instead of your feet | | |
| 5 | Banded Rows (seated) | `banded-rows-seated` | 3 x 10-15 | Anchor the band at chest height, sit tall. Pull back by driving elbows past ribs, squeezing shoulder blades together; slowly return to start | 1117498366 | |
| 6 | Seated cable face pull | `seated-cable-face-pull` | 3 x 15 | Pulley at head height. Standing, this pulls you off balance on one leg. Seated, it cannot. Counters the crutch hunch | | |
| 7 | Seated dumbbell curl | `db-curls` | 3 x 12-15 | Bench upright, back supported | | |

Engine at real positions, now: 1 ok (7); 2 ok (7); 3 ok (7); 4 ok (6); 5 ok (6); 6 ok (6); 7 ok (7). Template note: pull-ups are capped at two sessions a week, 72 hours apart (the brief). Recovery Pull is the only template that carries them, so the cap sets how often it runs: twice a week at most, 72 hours between runs, with the second run at the prototype's light dose (3 x leave 2-3 in reserve). `checkSpacing` over the three templates returns nothing, since no capped exercise is shared. The prototype's four-workout split (a separate light pull template) was run too: it warns on rule 11 until both pull templates carry a spacing note. It buys nothing the frequency check does not already enforce at workout time.

### Where the rules and the article disagree

Rule 8 as implemented warns on every floor-transfer row that is not in slot 1. The brief's rule is "floor work goes first in a session, never last", which a block of floor rows at the top honours: one transfer down, one transfer up. The article's leg and core section has six floor rows and the engine can pass only one of them per template. Task 3's test rejects any rule 8 verdict, so as written it fails on Recovery Legs (slots 2 to 4) and Recovery Push (slot 2). The fix is to amend rule 8 to warn only when a floor row follows a non-floor row; the scratch run of that amendment returns no warnings on any of the three templates. This is a change to `authoring.ts` and its test; the data stays as rated. It needs approval because it touches a hard-won rule's implementation while keeping its intent. The alternatives are worse: one floor row per template drops most of the article's leg section. Marking rows two to four as needing no floor transfer would be false data.

Rule 1 versus the handout is the other disagreement, resolved by the overrides above: the engine blocks anything through the booted foot while the boot is on, the handout permits protected weight-bearing in the boot at the cleared percentage from week 2, and the three article rows that load the boot are kept with that reason recorded on each.

## Alternative programme structures

**A. Seated upper-body cardio circuit** (`06` block A, secondary cardio: 2 to 3 sessions a week, 20 minutes continuous). Four or five seated stations, 45 seconds on and 15 off, four rounds: Banded Rows (seated), seated cable press, Shoulder Press light, seated cable pull-apart, Seated Russian Twists. Every station is seated with a sagittal or vertical load, so the engine passes all of them at both states. Evidence: moderate to strong that arm work tops out near two thirds of leg VO2 (Orr 2013, in `06`), so this preserves about half of what leg cardio would. Worth doing as calorie flux; `06` keeps ambient boot walking as the primary engine.

**B. Home template** for the pull-up bar, bands, ab straps and the article's floor work. One session: Straight Leg Raises, Side-Lying Hip Abductions, Supine Marches, Glute Bridges (override 1), Front Plank, Leg Extensions with Band, Banded Rows (seated, band on a door anchor), Pull-ups, Hanging knee raise (ab straps), Modified Push Ups at the counter, single-leg calf raise on the sound leg with a hand on the wall. Evidence: strong for the calf raise (cross-education, `04`); the rest is general strength principle with no published Achilles protocol behind it, which `01` says to state plainly.

**C. Three-day rotation** for weeks the gym is out of reach, which is B split so no session is long: Home Pull (Russian twist, pull-ups, hanging knee raise, banded rows seated), Home Floor and Legs (the five floor rows, band leg extension, sound-leg calf raise), Home Push (supine triceps extension, modified push-ups, shoulder press with dumbbells or a band). Run through the engine: every row passes except the bridge's recorded override and the rule 8 slots the amendment removes. With a spacing note on Home Pull, `checkSpacing` over the gym templates plus these three returns nothing. The pull-up cap still governs: Home Pull and Recovery Pull together count toward two a week.

Recommendation: the three gym templates as the programme, C as the fallback for gym-free weeks, A optional on non-lifting days once daily boot walking is established.

## Open items for the user

Decisions needed before Task 3:

1. Rule 8 amendment (above). Approve the change to "warn when a floor row follows a non-floor row", or say which floor rows to cut.
2. Pool work and isometric plantarflexion in the closed boot are questions for the treating physician (`06` open questions 1 and 3). Neither is a template item here. Confirm they stay out.
3. The one-leg bike. The brief says the building's bikes need a leg swung over the frame and have nowhere to rest the boot. Confirm whether a peg or block can be rigged on the upright bike; until then the row exists with its clip and sits in no template. A cardio template also needs `parseDose` to accept minutes.
4. Seat at the cable towers. The seated row, face pull, fly, pushdown and rear delt fly are rated as seated on a bench or seat at the towers, per the prototype's cue that the bench takes the reaction. If the only bench is the one in the rack, these become floor sits on the mat, which is a floor transfer and changes their slot.
5. `db-shoulder-press` carries a Notion demo link. Matching the article's Shoulder Press to it, as the plan says, replaces that link with the 416 clip. If you want both, the article row becomes its own row ("Shoulder Press in a walking boot") and the match list shrinks by one.
6. Doses. Precedence gives the article's dose where an article row replaces a prototype row: shoulder press goes from 4 x 10-12 to 2-3 x 8-12. Say if you want the prototype's numbers on any article row.
7. Recovery Pull carries both the seated cable row and the seated banded row, as the plan lists. They are the same movement at two stations. Keep both or make the banded row the home alternate of the cable row.
8. Clips on library near matches (`glute-bridge`, `push-ups`, `torso-twist-with-medicine-ball`, `floor-skullcrushers`, `leg-raise`, `indoor-bike`). Recommendation: no. The clips show the boot version and belong to the article rows.

Calls made here; say so if any is wrong:

- The front plank sits in Recovery Push and the Russian twist opens Recovery Pull. The plan had both in Legs.
- Modified Push Ups borrow the plank's crossed-leg cue so nothing loads the boot. The article leaves foot placement unstated.
- The article's "per side" on Glute Bridges and Ball Wall Squats is treated as a copy error and dropped from the dose string.
- "Glute Bridges in a walking boot" is the one article name changed, to sit apart from the library's `glute-bridge`; every other article row keeps the article's name.
- Pull-ups and the hanging knee raise are rated against `pull_up_bar`. The enum has no value for the rack's bar; the check passes as long as `pull_up_bar` stays in the user's equipment list.
- Recovery Legs is valid from phase 2. Push and Pull from phase 1.
- One reviewer-added row: single-leg glute bridge on the sound leg, the no-override alternate for the article's bridge.

New library rows the templates need: 17 (13 article rows and the prototype's face pull, two calf raises, cable fly and suitcase hold), plus the one-leg bike outside the templates and 14 alternate rows, 32 new rows in all. Library rows matched and updated with authoring inputs: 7 in the templates (`pull-ups`, `cable-seated-row`, `db-curls`, `hanging-leg-raise`, `db-shoulder-press`, `db-bench-press`, `bench-db-lateral-raise`) and 5 as alternates (`incline-chest-supported-db-row`, `cable-curl`, `dead-bug-kicks`, `dumbbell-flyes`, `reverse-cable-flies`).
