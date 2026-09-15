/**
 * How programme exercises map onto Frank's library.
 *
 * LIBRARY_ALIASES: a programme spelling (as a slug) that is one of the
 * curated Notion rows under another name. The seed resolves the alias
 * before near-duplicate matching, so no seed row is inserted for it.
 *
 * LIBRARY_ATTRIBUTES: muscle group and equipment for exercises the seed
 * inserts because no curated row exists. Applied on every run to
 * seed-owned rows only; a curated row is never touched.
 *
 * Slugs are exerciseSlug(name, null) of the JSON name after the variant
 * split ("Bench Press (Top Set)" is "bench-press").
 */

import type { EquipmentType } from "../../lib/exercise-name";

export const MUSCLE_GROUP_NAMES = [
  "Abs", "Back", "Biceps", "Calves", "Cardio", "Chest", "Glutes", "Hamstrings", "Quadriceps", "Shoulders", "Stretches", "Triceps",
] as const;
export type MuscleGroupName = (typeof MUSCLE_GROUP_NAMES)[number];

export type LibraryAttributes = { muscleGroup: MuscleGroupName; equipmentType: EquipmentType };

export const LIBRARY_ALIASES: Record<string, string> = {
  "barbell-hip-thrust": "hip-thrust",
  "bench-press": "bench-press-flat",
  "bulgarian-split-squat": "db-bulgarian-split-squats",
  "cable-lat-pullover": "cable-pullover",
  "cable-triceps-kickback": "cable-tricep-kickback",
  "close-grip-seated-cable-row": "cable-seated-row",
  "decline-plate-weighted-crunch": "decline-weighted-crunch",
  "diamond-pushup": "diamond-push-ups",
  "ez-bar-curl": "ez-bar-bicep-curls",
  "incline-db-press": "db-bench-press-incline",
  "lat-static-stretch": "static-lat-stretch",
  "low-incline-db-press": "db-bench-press-low-incline",
  "med-ball-close-grip-push-up": "med-ball-push-up",
  "overhead-triceps-extension": "overhead-cable-triceps-extension",
  "pec-static-stretch": "pec-stretch",
  "seated-db-shoulder-press": "db-shoulder-press",
  "side-delt-static-stretch": "delt-stretch",
  "single-arm-cable-tricep-kickback": "cable-tricep-kickback",
  "single-arm-db-row": "dumbbell-rows",
  "single-arm-row": "dumbbell-rows",
  "standing-dumbbell-arnold-press": "standing-arnold-press",
  "walking-lunge": "walking-db-lunge",
};

export const LIBRARY_ATTRIBUTES: Record<string, LibraryAttributes> = {
  "1-arm-half-kneeling-lat-pulldown": { muscleGroup: "Back", equipmentType: "cable" },
  "ab-wheel-rollout": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "bent-over-reverse-db-flye": { muscleGroup: "Shoulders", equipmentType: "dumbbell" },
  "bottom-half-db-lat-pullover": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "cable-crossover": { muscleGroup: "Chest", equipmentType: "cable" },
  "cable-crunch": { muscleGroup: "Abs", equipmentType: "cable" },
  "cable-shrug-in": { muscleGroup: "Back", equipmentType: "cable" },
  "close-grip-barbell-incline-press": { muscleGroup: "Triceps", equipmentType: "barbell" },
  "constant-tension-cable-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "constant-tension-machine-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "machine" },
  "cross-body-cable-y-raise-side-delt": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "db-shrug": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "db-triceps-kickback": { muscleGroup: "Triceps", equipmentType: "dumbbell" },
  "hammer-cheat-curl": { muscleGroup: "Biceps", equipmentType: "dumbbell" },
  "high-bar-box-squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "high-incline-smith-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "incline-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "kneeling-modified-push-up": { muscleGroup: "Chest", equipmentType: "bodyweight" },
  "kroc-row": { muscleGroup: "Back", equipmentType: "dumbbell" },
  "lat-pulldown": { muscleGroup: "Back", equipmentType: "cable" },
  "lean-in-constant-tension-db-lateral-raise": { muscleGroup: "Shoulders", equipmentType: "dumbbell" },
  "llpt-plank": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "low-incline-smith-machine-press": { muscleGroup: "Chest", equipmentType: "machine" },
  "n1-style-cross-body-triceps-extension": { muscleGroup: "Triceps", equipmentType: "cable" },
  "omni-direction-face-pull": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "omni-grip-machine-chest-supported-row": { muscleGroup: "Back", equipmentType: "machine" },
  "pendlay-row": { muscleGroup: "Back", equipmentType: "barbell" },
  "plank": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "plate-shrug": { muscleGroup: "Back", equipmentType: "other" },
  "plate-weighted-crunch": { muscleGroup: "Abs", equipmentType: "bodyweight" },
  "press-around": { muscleGroup: "Chest", equipmentType: "cable" },
  "reverse-cable-flye": { muscleGroup: "Shoulders", equipmentType: "cable" },
  "reverse-pec-deck": { muscleGroup: "Shoulders", equipmentType: "machine" },
  "squat": { muscleGroup: "Quadriceps", equipmentType: "barbell" },
  "trap-bar-deadlift": { muscleGroup: "Glutes", equipmentType: "barbell" },
  "triceps-pressdown": { muscleGroup: "Triceps", equipmentType: "cable" },
  "wide-grip-machine-row": { muscleGroup: "Back", equipmentType: "machine" },
  "wide-grip-t-bar-row": { muscleGroup: "Back", equipmentType: "barbell" },
};
