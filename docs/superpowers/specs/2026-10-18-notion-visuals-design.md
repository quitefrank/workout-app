# Notion visuals: muscle art and column icons

Date: 2026-10-18

## Goal

Bring the Notion Workout page's visuals into the app: the muscle group
body diagrams (page covers on the Muscle Groups database) and the icons
Notion shows on column headers and workout pages. The app should read
more visually without leaving the Liquid Glass look.

## Sources in Notion

- Muscle Groups covers, uploaded files. Ten are 2048 x 2048 RGBA PNGs
  with a transparent background and three flat tones: outline
  `#454545`, body `#B1B1B1`, worked muscle `#FFFFFF`. They cover Chest,
  Shoulders, Triceps, Back, Biceps, Abs, Quadriceps, Hamstrings,
  Glutes, Calves. Cardio and Stretches have photos; Forearms and Neck
  (added by the program seed) have nothing.
- Column icons from Notion's built-in set: Workout `gym`, Exercise
  `run`, Warm Up `fire`, Sets `repeat`, Reps `hashtag`, Weight
  dumbbell, Rest and Time `clock`, Muscle `accessibility`.
- Workout page icons: Push `hand`, Pull `gym`, Legs `pants`, Full Body
  `accessibility`, Run `shoe`, Abs `tshirt`.

> Updated 2026-10-18: Frank wants Notion's icons exactly, so they are
> copied from notion.so/icons into `icons.tsx` (fill set to currentColor),
> replacing the redrawn line icons. The sections below that say "redrawn"
> are superseded.

## 1. Muscle group grid on Library

`/exercises` gets a responsive grid of muscle group cards in place of
the muscle chips. The "Logged" filter and its chip are removed. The
"All" chip goes too: clearing the selection is a tap on the selected
card.

- Layout: CSS grid, `repeat(auto-fill, minmax(104px, 1fr))`, gap 10px,
  16px side gutter. About 3 columns on a phone, more on wider screens.
- Card: the Notion gallery card. A square art tile (`MuscleArt`) over
  a label row with the figure icon and the group name, on the grouped
  surface with the app's card radius. Content layer, so no glass.
- Tap filters the list to that group; tapping the selected card
  clears it. The selected card gets a 2px `--blue` ring and
  `aria-pressed`.
- The grid sits under the pinned search field, above the exercise
  list, and scrolls away with the content. Searching does not hide it.
- Order: the order `listMuscleGroups()` already returns.

## 2. Muscle art

### Pipeline

`bun run art:muscles` runs `scripts/trace-muscle-art.ts`, one-shot:

1. Reads the Muscle Groups data source with `NOTION_API_KEY` and
   downloads each file cover to `scripts/data/muscles/` (gitignored).
2. Splits each PNG into three binary layers by nearest tone (outline,
   body, hit); transparent pixels belong to none.
3. Traces each layer with the `potrace` npm package (dev dependency).
4. Derives the four groups without a drawing (see New art).
5. Writes `src/components/muscle-art/paths.ts`, generated and
   committed: `{ [slug]: { viewBox, line, body, hit } }` with SVG path
   data. A header comment says it is generated and how to rerun it.

The tone split is a pure function in `scripts/lib/muscle-tones.ts`
with tests.

### New art

Derived in the same script from Frank's drawings, so the style matches
exactly. A derivation names a base drawing and recolours its regions
(areas of body tone enclosed by outline) by flood fill from seed
points:

- Forearms: the Biceps drawing; existing hit cleared, the four forearm
  regions below the elbow crease filled as hit.
- Neck: the Chest drawing; existing hit cleared, the front of the neck
  (between the two neck lines) filled as hit. The Back drawing's neck
  region runs into the whole trapezius, so it was dropped.
- Cardio: the Chest drawing (neck to mid thigh) with every body region
  as hit.
- Stretches: the Chest drawing with the hit cleared.

Seeds are checked against a rendered preview before the paths are
committed.

### Component

`<MuscleArt group={name} />` renders an inline `<svg>` with three
paths filled `var(--muscle-body)`, `var(--muscle-hit)`,
`var(--muscle-line)`, drawn in that order. Lookup is by slug of the
group name (`src/components/muscle-art/lookup.ts`, pure, tested). A
group with no art renders the figure icon centred in the tile.

Tokens in `globals.css`:

- Light: line `#454545`, body `#B1B1B1`, hit `#FFFFFF`.
- Dark: line `#D1D1D6`, body `#48484A`, hit `#FFFFFF`. Defined in both
  dark blocks (`prefers-color-scheme` and `[data-theme="dark"]`).

The glass painter already draws inline SVG with computed paint, so the
WebGPU path needs no change.

## 3. Icons

Added to `src/components/icons.tsx` in its line style (24 viewBox,
1.9 stroke, round caps): `FlameIcon`, `RepeatIcon`, `HashIcon`,
`DumbbellIcon`, `ClockIcon`, `FigureIcon`, `HandIcon`, `PantsIcon`,
`ShoeIcon`, `ShirtIcon`.

Placement:

- Prescription labels: Warm Up (flame), Sets (repeat), Reps (hash),
  Weight (dumbbell), Rest (clock) beside their values on the active
  workout card (`src/app/workouts/[id]/exercise-card.tsx`) and on
  template exercise rows. Icons at 15px in `--ink-3`.
- Workout type: `workoutIcon(category)` in `src/lib/workout/icons.ts`,
  pure and tested. push hand, pull dumbbell, legs pants, full_body
  figure, cardio shoe, abs shirt, arms dumbbell, rehab figure, null
  dumbbell. Shown in `Thumb`, the gradient tile that leads every
  workout and template row (Calendar, History, Up Next, Start a
  workout, program pages): the icon over the variant label. The tall
  template tiles on Templates show it top right.
- The muscle art is rendered by the server page and passed to the
  client Library as nodes, so the path data never ships as JS.
- Icons that carry meaning (the prescription labels) get `role="img"`
  and an `aria-label`, so VoiceOver reads "3 sets" rather than "3".
- Muscle label: figure icon before the group name on Library rows and
  on the exercise detail page.

## Testing

- Unit: tone split on a small fixture buffer; art lookup (exact, case,
  missing); `workoutIcon` for every enum value and null.
- Visual: run the app, check Library, the active workout, Templates and
  Calendar in light and dark, with WebGPU and with the CSS path.

## Out of scope

Exercise row runner icons, diagrams on exercise detail or Progress,
storing art in the database.
