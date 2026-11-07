/**
 * How program exercises map onto Frank's library.
 *
 * LIBRARY_ALIASES: a program spelling (as a slug) that is one of the
 * curated Notion rows under another name, or the same movement another
 * program spells differently (the target is the spelling that keeps
 * the seed row). The seed resolves the alias before the slug itself and
 * before near-duplicate matching, so no seed row is inserted for it. A
 * target is never itself an alias key.
 *
 * LIBRARY_ATTRIBUTES: muscle group and equipment for exercises the seed
 * inserts because no curated row exists. Applied on every run to
 * seed-owned rows only; a curated row is never touched.
 *
 * Slugs are exerciseSlug(name, null) of the JSON name after the variant
 * split ("Bench Press (Top Set)" is "bench-press").
 *
 * An alias is for the same movement under another spelling, and for a
 * set instruction that is one exercise with its standard row (cheat,
 * negative, enhanced-eccentric: ALIAS_VARIANTS keeps the instruction on
 * the program row, migration 0022). A variation loaded differently
 * (pause, bottom-half) keeps its own row with attributes, and nothing aliases to an upstairs
 * or downstairs row. Equipment comes from the name, or from the source
 * notes when the name is silent ("barbell or EZ bar" is barbell, "DB,
 * cable or band" is other). Wrist curls and farmer's walks are
 * Forearms and neck work is Neck: two groups Notion never had, which
 * the seed inserts (stamped "program:muscle-group:<slug>") when a row
 * here names them.
 */

import type { EquipmentType } from "../../lib/exercise-name";

export const MUSCLE_GROUP_NAMES = [
  "Abs", "Back", "Biceps", "Calves", "Cardio", "Chest", "Forearms", "Glutes", "Hamstrings", "Neck", "Quadriceps", "Shoulders", "Stretches", "Triceps",
] as const;
export type MuscleGroupName = (typeof MUSCLE_GROUP_NAMES)[number];

export type LibraryAttributes = { muscleGroup: MuscleGroupName; equipmentType: EquipmentType; name?: string };

export const LIBRARY_ALIASES: Record<string, string> = {
  "cable-shrug-in": "cable-shrugs",
  "close-grip-barbell-incline-press": "close-grip-incline-press",
  "cross-body-cable-y-raise-side-delt": "cable-y-raise",
  "db-bench-press-no-leg-drive": "db-larsen-press",
  "helms-row": "incline-chest-supported-db-row",
  "lat-pull-over": "cable-pullover",
  "lean-in-constant-tension-db-lateral-raise": "lean-in-db-lateral-raise",
  "machine-chest-press-no-leg-drive": "machine-chest-press",
  "n1-style-cross-body-triceps-extension": "cross-body-tricep-extension",
  "pause-high-bar-squat": "pause-squat",
  "plate-weighted-crunch": "decline-weighted-crunch",
  "press-around": "cable-press-around",
  "scott-curl": "barbell-preacher-curl",
  "1-arm-half-kneeling-lat-pulldown": "1-arm-cable-pulldown",
  "barbell-bench-press": "bench-press-flat",
  "barbell-floor-skull-crusher": "floor-skullcrushers",
  "barbell-hip-thrust": "hip-thrust",
  "bench-press": "bench-press-flat",
  "bent-over-reverse-db-flye": "bent-over-reverse-db-flies",
  "bent-over-reverse-dumbbell-flye": "bent-over-reverse-db-flies",
  "bicycle-crunch": "bicycle-crunches",
  "bulgarian-split-squat": "db-bulgarian-split-squats",
  "cable-lat-pullover": "cable-pullover",
  "cable-reverse-flye": "reverse-cable-flies",
  "cable-rope-pullthrough": "cable-pull-through",
  "cable-triceps-kickback": "cable-tricep-kickback",
  "chest-supported-dumbbell-row": "incline-chest-supported-db-row",
  "close-grip-seated-cable-row": "cable-seated-row",
  "concentration-bicep-curl": "dumbbell-concentration-curl",
  "decline-plate-weighted-crunch": "decline-weighted-crunch",
  "diamond-pushup": "diamond-push-ups",
  "dumbbell-hammer-curl": "hammer-curls",
  "hammer-cheat-curl": "hammer-curls",
  "eccentric-accentuated-pull-up": "pull-ups",
  "enhanced-eccentric-leg-extension": "leg-extensions",
  "enhanced-eccentric-lying-leg-curl": "lying-leg-curl",
  "constant-tension-cable-lateral-raise": "cable-lateral-raise",
  "constant-tension-machine-lateral-raise": "machine-lateral-raises",
  "dumbbell-incline-press": "db-bench-press-incline",
  "dumbbell-isolateral-skull-crusher": "db-skull-crushers",
  "dumbbell-one-arm-row": "dumbbell-rows",
  "dumbbell-seated-shoulder-press": "db-shoulder-press",
  "dumbbell-shrug": "db-shrug",
  "dumbbell-supinated-curl": "db-curls",
  "dumbbell-walking-lunge": "walking-db-lunge",
  "egyptian-lateral-raise": "egyptian-cable-lateral-raise",
  "ez-bar-curl": "ez-bar-bicep-curls",
  "floor-skull-crusher": "floor-skullcrushers",
  "heavy-negative-concentration-curls": "dumbbell-concentration-curl",
  "incline-db-press": "db-bench-press-incline",
  "kneeling-straight-arm-cable-pull-over": "cable-pullover",
  "lat-static-stretch": "static-lat-stretch",
  "lateral-band-walk": "banded-lateral-walk",
  "leg-curl": "lying-leg-curl",
  "low-incline-db-press": "db-bench-press-low-incline",
  "med-ball-close-grip-push-up": "med-ball-push-up",
  "medicine-ball-pushups": "med-ball-push-up",
  "military-press": "overhead-press",
  "military-press-push-press-complex": "overhead-press-push-press",
  "machine-pulldown": "lat-pulldown",
  "neutral-grip-pulldown": "neutral-grip-lat-pulldown",
  "omni-grip-machine-chest-supported-row": "omni-grip-rows",
  "overhead-rope-tricep-extension": "overhead-cable-triceps-extension",
  "overhead-triceps-extension": "overhead-cable-triceps-extension",
  "pec-static-stretch": "pec-stretch",
  "plank": "front-plank",
  "reverse-cable-flye": "reverse-cable-flies",
  "romanian-deadlift": "barbell-rdl",
  "rope-overhead-triceps-extension": "overhead-cable-triceps-extension",
  "seated-db-shoulder-press": "db-shoulder-press",
  "side-delt-static-stretch": "delt-stretch",
  "single-arm-cable-tricep-kickback": "cable-tricep-kickback",
  "single-arm-db-row": "dumbbell-rows",
  "single-arm-lat-pulldown": "1-arm-cable-pulldown",
  "single-arm-pulldown": "1-arm-cable-pulldown",
  "single-arm-row": "dumbbell-rows",
  "squat": "back-squat",
  "arnold-press": "seated-arnold-press",
  "standing-dumbbell-arnold-press": "standing-arnold-press",
  "standing-ez-bar-curl": "ez-bar-bicep-curls",
  "supinated-ez-bar-curl": "ez-bar-bicep-curls",
  "tricep-pressdown": "triceps-pressdown",
  "walking-lunge": "walking-db-lunge",
};

export const LIBRARY_ATTRIBUTES: Record<string, LibraryAttributes> = {
  "1-arm-overhead-cable-extension": { muscleGroup: "Triceps", equipmentType: "cable" },
  "3-block-pull": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "5-block-pull": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "ab-wheel-rollout": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "seated-face-pull": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "t-bar-row": { muscleGroup: "Back", equipmentType: "barbell" },
  "seated-arnold-press": { muscleGroup: "Shoulders", equipmentType: "dumbbell", name: "Seated Arnold Press" },
  "assisted-chin-up": { muscleGroup: "Back", equipmentType: "bodyweight" },
  "back-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "band-pull-apart": { muscleGroup: "Shoulders", equipmentType: "other" },
  "banded-lateral-walk": { muscleGroup: "Glutes", equipmentType: "other" },
  "barbell-floor-press": { muscleGroup: "Chest", equipmentType: "barbell" },
  "bayesian-cable-curl": { muscleGroup: "Biceps", equipmentType: "cable" },
  "bottom-half-db-lat-pullover": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "cable-crossover": { muscleGroup: "Chest", equipmentType: "cable" },
  "cable-crunch": { muscleGroup: "Abs", equipmentType: "cable" },
  "cable-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "cable-pull-through": { muscleGroup: "Glutes", equipmentType: "cable" },
  "cable-seated-elbows-out-row": { muscleGroup: "Back", equipmentType: "cable" },
  "chest-supported-t-bar-row": { muscleGroup: "Back", equipmentType: "machine" },
  "chest-supported-t-bar-row-w-band": { muscleGroup: "Back", equipmentType: "machine" },
  "close-grip-bench-press": { muscleGroup: "Triceps", equipmentType: "barbell" },
  "close-grip-smith-machine-press": { muscleGroup: "Triceps", equipmentType: "machine" },
  "db-shrug": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "db-triceps-kickback": { muscleGroup: "Triceps", equipmentType: "dumbbell" },
  "dip": { muscleGroup: "Triceps", equipmentType: "bodyweight" },
  "dumbbell-concentration-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "dumbbell-preacher-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "dumbbell-preacher-hammer-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "dumbbell-pronated-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "face-pull": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "farmers-walks": { muscleGroup: "Forearms", equipmentType: "other" },
  "flat-back-bench-press": { muscleGroup: "Chest", equipmentType: "barbell" },
  "forearm-wrist-curl": { muscleGroup: "Forearms", equipmentType: "other" },
  "glute-ham-raise": { muscleGroup: "Hamstrings", equipmentType: "machine" },
  "high-bar-box-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "high-incline-smith-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "hip-abduction": { muscleGroup: "Glutes", equipmentType: "other" },
  "incline-dumbbell-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "incline-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "incline-shrug": { muscleGroup: "Back", equipmentType: "other" },
  "kneeling-modified-push-up": { muscleGroup: "Chest", equipmentType: "bodyweight" },
  "kroc-row": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "llpt-plank": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "low-bar-back-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "low-incline-smith-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "low-to-high-cable-flye": { muscleGroup: "Chest", equipmentType: "cable" },
  "low-to-high-reverse-flye": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "lying-incline-death-curls": { muscleGroup: "Biceps", equipmentType: "other" },
  "machine-high-row": { muscleGroup: "Back", equipmentType: "machine" },
  "machine-preacher-curl": { muscleGroup: "Biceps", equipmentType: "machine" },
  "neck-flexion-extension": { muscleGroup: "Neck", equipmentType: "other" },
  "omni-direction-face-pull": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "overhead-press": { muscleGroup: "Shoulders", equipmentType: "barbell" },
  "overhead-press-push-press": { muscleGroup: "Shoulders", equipmentType: "barbell" },
  "pause-barbell-bench-press": { muscleGroup: "Chest", equipmentType: "barbell" },
  "pause-barbell-hip-thrust": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "pause-deadlift": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "pendlay-row": { muscleGroup: "Back", equipmentType: "barbell" },
  "plate-shrug": { muscleGroup: "Back", equipmentType: "other" },
  "preacher-death-curls": { muscleGroup: "Biceps", equipmentType: "other" },
  "reverse-grip-ez-bar-curl": { muscleGroup: "Biceps", equipmentType: "other" },
  "reverse-grip-forearm-wrist-curl": { muscleGroup: "Forearms", equipmentType: "other" },
  "reverse-pec-deck": { muscleGroup: "Shoulders", equipmentType: "machine" },
  "rope-upright-row": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "round-back-dumbbell-45-hyperextension": { muscleGroup: "Glutes", equipmentType: "dumbbell" },
  "barbell-preacher-curl": { muscleGroup: "Biceps", equipmentType: "barbell", name: "Barbell Preacher Curl" },
  "seal-row": { muscleGroup: "Back", equipmentType: "other" },
  "single-arm-cable-curl": { muscleGroup: "Biceps", equipmentType: "cable", name: "1-Arm Cable Curl" },
  "single-leg-leg-extension": { muscleGroup: "Quadriceps", equipmentType: "machine" },
  "single-leg-leg-press": { muscleGroup: "Quadriceps", equipmentType: "machine" },
  "skull-crusher": { muscleGroup: "Triceps", equipmentType: "barbell" },
  "omni-grip-pull-up": { muscleGroup: "Back", equipmentType: "bodyweight", name: "Omni-Grip Pull-Up" },
  "smith-machine-reverse-lunge": { muscleGroup: "Glutes", equipmentType: "machine" },
  "snatch-grip-barbell-shrug": { muscleGroup: "Back", equipmentType: "barbell" },
  "snatch-grip-romanian-deadlift": { muscleGroup: "Hamstrings", equipmentType: "barbell" },
  "spider-curl": { muscleGroup: "Biceps", equipmentType: "other" },
  "squat-walk-out-do-not-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "sumo-box-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "swiss-ball-single-leg-leg-curl": { muscleGroup: "Hamstrings", equipmentType: "bodyweight" },
  "trap-bar-deadlift": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "triceps-v-bar-pressdown": { muscleGroup: "Triceps", equipmentType: "cable" },
  "upright-row": { muscleGroup: "Shoulders", equipmentType: "other" },
  "v-sit-up": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "weighted-dip-close-grip": { muscleGroup: "Triceps", equipmentType: "bodyweight" },
  "weighted-pull-up": { muscleGroup: "Back", equipmentType: "bodyweight" },
  "wide-grip-machine-row": { muscleGroup: "Back", equipmentType: "machine" },
  "wide-grip-t-bar-row": { muscleGroup: "Back", equipmentType: "barbell" },
};

/**
 * Seed-owned exercises kept in the library though nothing references them: a program
 * names them only as a substitute for a slot Notion already fills. Frank's call: anything
 * from Jeff Nippard's programs stays.
 */
export const KEEP_UNREFERENCED = new Set(["plate-shrug"]);

/** The set instruction an aliased spelling carries onto the program row (migration 0022). */
export const ALIAS_VARIANTS: Record<string, string> = {
  "hammer-cheat-curl": "Cheat",
  "heavy-negative-concentration-curls": "Negative",
  "eccentric-accentuated-pull-up": "Eccentric-Accentuated",
  "enhanced-eccentric-leg-extension": "Enhanced-Eccentric",
  "enhanced-eccentric-lying-leg-curl": "Enhanced-Eccentric",
};

/**
 * A program row whose variant names a version the library keeps as its own row goes to that row, without the variant
 * (migration 0022): keyed by the library slug the row resolved to, then the variant as the converter writes it.
 */
export const VARIANT_TARGETS: Record<string, Record<string, string>> = {
  "triceps-pressdown": { "Squeeze-only": "squeeze-only-triceps-pressdown" },
  "overhead-cable-triceps-extension": { "Stretch-only": "overhead-extension-stretch-only" },
};
