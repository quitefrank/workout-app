/**
 * The rehab exercises: ankle, tendon and foot work, as distinct from the
 * strength work in the boot that exercises.ts carries.
 *
 * Three sources, in the order of authority the handoff set:
 *   1. The physiotherapist's handwritten sheet (source "physio-sheet").
 *      Names and doses are the physio's. The how-to lines are plain
 *      descriptions of the named exercise, written for the app, not the
 *      physio's instructions, and each notes field says so.
 *   2. The clinic handout ("handout"). It names movements and gives no
 *      doses.
 *   3. E3 Rehab's Achilles rupture guide ("e3rehab"). Outside the
 *      authority chain: every template built from it carries a sign-off
 *      note, and every row where it disagrees with the handout says how.
 *
 * Where two sources name the same movement it is one library row, so
 * history attaches to one place: the physio's "towel scrunch" is E3's
 * "towel curl". Where they name different movements they stay apart:
 * the physio's seated calf raise hold is not E3's single-leg seated
 * heel raise, and neither is E3's plantar flexion isometric.
 *
 * No clip is attached. E3's companion video covers the whole article,
 * not one exercise, and the handoff allows a clip only once a page is
 * confirmed to show that exact exercise.
 *
 * loadsBootedFoot is true for anything that puts body weight or an
 * external load through the injured foot; a seated, unweighted raise is
 * false. Library rows matched by slug (leg-extensions, seated-leg-curl,
 * goblet-squat, dumbbell-rdl, db-step-up, indoor-bike) keep their name,
 * group and demo link; the seed only sets their authoring inputs.
 */

import type { ExerciseSeed } from "./types";

const PHYSIO_NOTE =
  "From the physiotherapist's sheet, which gives the name and dose only. The description is a plain account of the named exercise, not the physio's instructions.";
const E3_NOTE = "From E3 Rehab's Achilles rupture guide, outside the clinic's protocol.";

type Rated = Pick<
  ExerciseSeed,
  "supportRequired" | "loadDirection" | "loadsBootedFoot" | "ankleInvolvement" | "floorTransferRequired" | "equipmentNeeded"
>;

const SEATED_ANKLE: Rated = {
  supportRequired: "seated_supported",
  loadDirection: "none",
  loadsBootedFoot: false,
  ankleInvolvement: true,
  floorTransferRequired: false,
  equipmentNeeded: [],
};

const SEATED_FOOT: Rated = { ...SEATED_ANKLE, ankleInvolvement: false };

const STANDING_ANKLE: Rated = {
  supportRequired: "standing_supported",
  loadDirection: "vertical",
  loadsBootedFoot: true,
  ankleInvolvement: true,
  floorTransferRequired: false,
  equipmentNeeded: [],
};

function row(
  e: Pick<ExerciseSeed, "name" | "slug" | "muscleGroup" | "equipmentType" | "notes"> & Rated,
): ExerciseSeed {
  return {
    videoUrl: null,
    videoVerifiedAt: null,
    videoCredit: null,
    minHoursBetweenSessions: null,
    maxSessionsPerWeek: null,
    alternates: [],
    ...e,
  };
}

export const REHAB_EXERCISES: ExerciseSeed[] = [
  // ------------------------------------------------------------------
  // The physio's sheet (items 1 to 6) and the handout's band (item 7)
  // ------------------------------------------------------------------
  row({
    name: "Seated passive heel slide",
    slug: "seated-passive-heel-slide",
    muscleGroup: "Stretches",
    equipmentType: "bodyweight",
    notes: `Sitting, foot flat. Slide the foot back under the chair with the heel down, to the end of your range, and hold. End of range will likely take the ankle past neutral; that is allowed, because the handout's neutral limit covers weighted resisted exercise, standing calf stretches and heel raises only. ${PHYSIO_NOTE}`,
    ...SEATED_ANKLE,
  }),
  row({
    name: "Seated calf raise hold",
    slug: "seated-calf-raise-hold",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `Sitting, feet flat. Raise the heels and hold at the top. The sheet lists "possible weight on knee" with no trigger for adding it; once weight is added it counts as a weighted resisted exercise and the neutral limit applies. From a flat floor the ankle cannot pass neutral anyway. ${PHYSIO_NOTE}`,
    ...SEATED_ANKLE,
    loadDirection: "vertical",
  }),
  row({
    name: "Toe spread and hold",
    slug: "toe-spread-and-hold",
    muscleGroup: null,
    equipmentType: "bodyweight",
    notes: `Spread the toes apart and hold. ${PHYSIO_NOTE}`,
    ...SEATED_FOOT,
  }),
  row({
    name: "Towel scrunch",
    slug: "towel-scrunch",
    muscleGroup: null,
    equipmentType: "bodyweight",
    notes: `Towel flat under the foot. Pull it toward you with the toes. E3 Rehab calls the same exercise a towel curl. ${PHYSIO_NOTE}`,
    ...SEATED_FOOT,
  }),
  row({
    name: "Standing weight shift to single-leg stand",
    slug: "standing-weight-shift-to-single-leg-stand",
    muscleGroup: null,
    equipmentType: "bodyweight",
    notes: `Standing, holding on to something. Shift your weight side to side, then onto one leg and hold. Shoes on: the handout says always wear shoes in weeks 8 to 12, limiting time barefoot. ${PHYSIO_NOTE}`,
    ...STANDING_ANKLE,
    loadDirection: "lateral",
  }),
  row({
    name: "Weight shift with calf raise",
    slug: "weight-shift-with-calf-raise",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `The sheet says: repeat the weight shift with a calf raise. It does not say whether the raise is on one leg or both; that is a question for the physio. It is a heel raise, so the neutral limit applies: flat floor only, never off a step edge. Shoes on. ${PHYSIO_NOTE}`,
    ...STANDING_ANKLE,
  }),
  row({
    name: "Ankle resistance band",
    slug: "ankle-resistance-band",
    muscleGroup: "Calves",
    equipmentType: "other",
    notes:
      'The handout, weeks 6 to 8: "Graduated resistance exercises ... starting with Theraband exercises". It names no movements, sets, reps or band colours. "Graduated" is the reason for two levels, a lighter band then a heavier one. If you need movements, the handout\'s own range of motion directions are foot up, down, in and out; pairing those with the band is an inference, not the source.',
    ...SEATED_ANKLE,
    equipmentNeeded: ["resistance_band"],
  }),

  // ------------------------------------------------------------------
  // The handout, weeks 2 to 8. Movements only; it gives no doses.
  // ------------------------------------------------------------------
  row({
    name: "Active ankle plantarflexion and dorsiflexion to neutral",
    slug: "active-ankle-plantarflexion-and-dorsiflexion-to-neutral",
    muscleGroup: "Stretches",
    equipmentType: "bodyweight",
    notes:
      'The handout, weeks 2 to 6: "ACTIVE ankle range of motion exercises: Ankle plantarflexion and dorsiflexion to NEUTRAL", with "PLEASE ENSURE ANKLE DOES NOT GO PAST NEUTRAL WHILE DURING EXERCISES". Point the foot down, then bring it back up to neutral and no further. No dose given.',
    ...SEATED_ANKLE,
  }),
  row({
    name: "Active ankle inversion and eversion below neutral",
    slug: "active-ankle-inversion-and-eversion-below-neutral",
    muscleGroup: "Stretches",
    equipmentType: "bodyweight",
    notes:
      'The handout, weeks 2 to 6: "Foot inversion and eversion BELOW NEUTRAL". Turn the sole in, then out, with the foot pointed slightly down. No dose given.',
    ...SEATED_ANKLE,
  }),
  row({
    name: "Dorsiflexion stretching, slowly",
    slug: "dorsiflexion-stretching-slowly",
    muscleGroup: "Stretches",
    equipmentType: "bodyweight",
    notes:
      'The handout, weeks 6 to 8: "Dorsiflexion stretching SLOWLY". It gives no method and no dose. Slowly is the operative word; E3 Rehab also warns that aggressive stretching is not recommended early on.',
    ...SEATED_ANKLE,
  }),

  // ------------------------------------------------------------------
  // E3 Rehab, phase 1 (controlled mobilisation) and phase 2 (walking)
  // ------------------------------------------------------------------
  row({
    name: "Single-leg seated heel raise",
    slug: "single-leg-seated-heel-raise",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `Sitting on a bench, foot on the floor (on a heel wedge early on, which E3 shows as less stress on the tendon). Lift the heel as high as you can, slow and controlled, and lower. Load goes on the knee once 3 sets of 25 are comfortable: dumbbell, kettlebell, Smith machine or seated calf raise machine. ${E3_NOTE}`,
    ...SEATED_ANKLE,
    loadDirection: "vertical",
    equipmentNeeded: ["adjustable_bench"],
  }),
  row({
    name: "Banded plantar flexion",
    slug: "banded-plantar-flexion",
    muscleGroup: "Calves",
    equipmentType: "other",
    notes: `Long sitting on a bench, a light band round the ball of the foot. Point the foot against the band, as repetitions or as a held isometric. E3 says to limit how far you move into dorsiflexion on the way back. ${E3_NOTE}`,
    ...SEATED_ANKLE,
    equipmentNeeded: ["resistance_band", "adjustable_bench"],
  }),
  row({
    name: "Plantar flexion isometric",
    slug: "plantar-flexion-isometric",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `Seated, foot on the floor or a heel wedge. Gently push the ball of the foot into the ground and hold; nothing moves. E3 says it can be done in the boot. ${E3_NOTE}`,
    ...SEATED_ANKLE,
  }),
  row({
    name: "Short foot",
    slug: "short-foot",
    muscleGroup: null,
    equipmentType: "bodyweight",
    notes: `Draw the ball of the foot toward the heel to lift the arch, toes long and relaxed, and hold. E3 shows it standing barefoot; done seated here, because the handout keeps you off the foot and out of bare feet in the early weeks. ${E3_NOTE}`,
    ...SEATED_FOOT,
  }),
  row({
    name: "Single-leg balance",
    slug: "single-leg-balance",
    muscleGroup: null,
    equipmentType: "bodyweight",
    notes: `Flat ground, in shoes, fingertips on a chair back for help if needed. Stand on one leg. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    loadDirection: "none",
  }),
  row({
    name: "Retro walking",
    slug: "retro-walking",
    muscleGroup: null,
    equipmentType: "bodyweight",
    notes: `Walk backward. The easier version: hold something steady (E3 shows a dowel), step back with the injured leg, slowly lower the heel, and return. Lowering the heel toward the floor behind you moves the ankle toward dorsiflexion, so keep it inside what the handout and your physio allow. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    loadDirection: "sagittal",
  }),

  // ------------------------------------------------------------------
  // E3 Rehab, phase 3 (advanced strength)
  // ------------------------------------------------------------------
  row({
    name: "Seated double-leg heel raise, weighted",
    slug: "seated-double-leg-heel-raise-weighted",
    muscleGroup: "Calves",
    equipmentType: "other",
    notes: `Seated, weight across both knees (barbell, dumbbells, kettlebells, Smith machine or a seated calf machine), from the floor or from a deficit. E3 prioritises the single-leg version over this one. A deficit takes the ankle past neutral. ${E3_NOTE}`,
    ...SEATED_ANKLE,
    loadDirection: "vertical",
    loadsBootedFoot: true,
    equipmentNeeded: ["dumbbells", "adjustable_bench"],
  }),
  row({
    name: "Standing heel raise",
    slug: "standing-heel-raise",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `Knee straight, slow and controlled, heel as high as it goes every rep. E3's ladder: two legs on the floor, one leg on the floor, one leg off a step edge, then one leg off a step edge holding weight. Start once you can walk without an aid. A step edge takes the ankle past neutral. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    equipmentNeeded: ["half_rack", "step_platform", "dumbbells"],
  }),
  row({
    name: "Staggered stance heel raise",
    slug: "staggered-stance-heel-raise",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `The step between two legs and one: the injured foot carries most of the load, the other foot rests forward on its toes for help. E3 shows the back foot on a block. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    equipmentNeeded: ["half_rack"],
  }),
  row({
    name: "Step-down",
    slug: "step-down",
    muscleGroup: "Quadriceps",
    equipmentType: "bodyweight",
    notes: `Standing on a step, lower the other foot slowly to the floor and come back up. E3 ranks it above the step-up for Achilles load and uses it to restore dorsiflexion range, so it goes past neutral. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    equipmentNeeded: ["step_platform"],
  }),
  row({
    name: "Standing calf stretch",
    slug: "standing-calf-stretch",
    muscleGroup: "Stretches",
    equipmentType: "bodyweight",
    notes: `Gently. E3 shows the foot on a step edge and says aggressive stretching is not recommended early on. The handout's weeks 8 to 12: calf stretches in standing, gently, "DO NOT ALLOW ANKLE TO GO PAST NEUTRAL POSITION", which rules out the step edge in that window. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    loadDirection: "none",
  }),

  // ------------------------------------------------------------------
  // E3 Rehab, phase 4 (energy storage and release) and running
  // ------------------------------------------------------------------
  row({
    name: "Double-leg rebound heel raise",
    slug: "double-leg-rebound-heel-raise",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `Quick, springy heel raises on both legs, the first of E3's phase 4 exercises. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
  }),
  row({
    name: "Hopping progression",
    slug: "hopping-progression",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `E3's six levels: 1 in place, 2 side to side, 3 forward and backward (both legs); 4 in place, 5 side to side, 6 forward and backward (one leg). If level 1 is too hard, hop without leaving the ground. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
  }),
  row({
    name: "Vertical jump progression",
    slug: "vertical-jump-progression",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `E3's six levels: 1 double-leg submaximal, 2 double-leg maximal, 3 double-leg drop jump (step off a raised surface, land on two legs, jump as high as possible), 4 single-leg submaximal, 5 single-leg maximal, 6 single-leg drop jump. If level 1 is too hard, jump lower. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
  }),
  row({
    name: "Horizontal jump progression",
    slug: "horizontal-jump-progression",
    muscleGroup: "Calves",
    equipmentType: "bodyweight",
    notes: `E3's four levels: 1 double-leg submaximal (about 80% effort), 2 double-leg maximal, 3 single-leg submaximal, 4 single-leg maximal. Stick the landing. If level 1 is too hard, jump less far. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    loadDirection: "sagittal",
  }),
  row({
    name: "Treadmill walk-jog progression",
    slug: "treadmill-walk-jog-progression",
    muscleGroup: "Cardio",
    equipmentType: "cardio_machine",
    notes:
      "The University of Delaware levels E3 shows: 1 walk 0.1 mile, jog 0.1 mile, ten times; 2 walk 0.1, jog 0.2, 2 miles total; 3 walk 0.1, jog 0.3, 2 miles total; 4 walk 0.1, jog 0.4, 2 miles total; 5 jog 2 miles; 6 jog 2.5 miles; 7 jog 3 miles; 8 alternate jog and run every 0.25 miles. Rest at least 1 to 2 days between sessions. Move up a level only with no soreness during or after; soreness during means drop a level, soreness after means repeat the level. From E3 Rehab's Achilles rupture guide, outside the clinic's protocol.",
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    loadDirection: "sagittal",
    equipmentNeeded: ["treadmill"],
  }),
  row({
    name: "Sprint, cut and change of direction drills",
    slug: "sprint-cut-and-change-of-direction-drills",
    muscleGroup: "Cardio",
    equipmentType: "bodyweight",
    notes: `E3's phase 5: from treadmill running to sprinting, cutting and change of direction, then modified practice and sport-specific drills, then full participation. No dose given. ${E3_NOTE}`,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    loadDirection: "lateral",
  }),

  // ------------------------------------------------------------------
  // Library rows matched by slug; only their authoring inputs are set.
  // ------------------------------------------------------------------
  row({
    name: "Leg Extensions",
    slug: "leg-extensions",
    muscleGroup: "Quadriceps",
    equipmentType: "machine",
    notes: null,
    ...SEATED_FOOT,
    loadDirection: "sagittal",
  }),
  row({
    name: "Seated Leg Curl",
    slug: "seated-leg-curl",
    muscleGroup: "Hamstrings",
    equipmentType: "machine",
    notes: null,
    ...SEATED_FOOT,
    loadDirection: "sagittal",
  }),
  row({
    name: "Goblet Squat",
    slug: "goblet-squat",
    muscleGroup: "Quadriceps",
    equipmentType: "dumbbell",
    notes: null,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    equipmentNeeded: ["dumbbells"],
  }),
  row({
    name: "Dumbbell RDL",
    slug: "dumbbell-rdl",
    muscleGroup: "Hamstrings",
    equipmentType: "dumbbell",
    notes: null,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    equipmentNeeded: ["dumbbells"],
  }),
  row({
    name: "DB Step-Up",
    slug: "db-step-up",
    muscleGroup: "Quadriceps",
    equipmentType: "dumbbell",
    notes: null,
    ...STANDING_ANKLE,
    supportRequired: "standing_free",
    equipmentNeeded: ["step_platform", "dumbbells"],
  }),
  row({
    name: "Indoor Bike",
    slug: "indoor-bike",
    muscleGroup: "Cardio",
    equipmentType: "cardio_machine",
    notes: null,
    supportRequired: "seated_supported",
    loadDirection: "none",
    loadsBootedFoot: true,
    ankleInvolvement: true,
    floorTransferRequired: false,
    equipmentNeeded: [],
  }),
];

/** Rows above that match a Notion-seeded library row by slug. */
export const REHAB_MATCHED_LIBRARY_SLUGS = [
  "leg-extensions",
  "seated-leg-curl",
  "goblet-squat",
  "dumbbell-rdl",
  "db-step-up",
  "indoor-bike",
];
