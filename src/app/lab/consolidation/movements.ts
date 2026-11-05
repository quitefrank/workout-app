/**
 * Prototype only: a proposal for which library rows become one movement, with equipment and
 * technique as values on the logged row. Nothing in the app reads this outside /lab/consolidation.
 */
export type Member = { movement: string; equipment: string; variant?: string };

const family = (movement: string, rows: Record<string, [string, string?]>): [string, Member][] =>
  Object.entries(rows).map(([slug, [equipment, variant]]) => [slug, { movement, equipment, variant }]);

export const MEMBERS: Record<string, Member> = Object.fromEntries([
  ...family("Bench Press", {
    "bench-press-flat": ["Barbell"],
    "db-bench-press": ["Dumbbell"],
    "machine-chest-press": ["Machine"],
    "pause-barbell-bench-press": ["Barbell", "Pause"],
    "flat-back-bench-press": ["Barbell", "Flat-Back"],
    "db-bench-press-no-leg-drive": ["Dumbbell", "No Leg Drive"],
    "machine-chest-press-no-leg-drive": ["Machine", "No Leg Drive"],
  }),
  ...family("Incline Bench Press", {
    "bench-press-incline": ["Barbell"],
    "db-bench-press-incline": ["Dumbbell"],
    "incline-machine-press": ["Machine"],
  }),
  ...family("Pullover", {
    "cable-pullover": ["Cable"],
    "lat-pull-over": ["Cable", "Lat Pull-Over"],
    "dumbbell-pullovers": ["Dumbbell", "Bottom-Half"],
    "bottom-half-db-lat-pullover": ["Dumbbell", "Bottom-Half"],
  }),
  ...family("Lateral Raise", {
    "db-lateral-raise": ["Dumbbell"],
    "cable-lateral-raise": ["Cable"],
    "machine-lateral-raises": ["Machine"],
    "bench-db-lateral-raise": ["Dumbbell", "Seated"],
    "egyptian-cable-lateral-raise": ["Cable", "Egyptian"],
    "lean-in-constant-tension-db-lateral-raise": ["Dumbbell", "Constant Tension"],
    "constant-tension-cable-lateral-raise": ["Cable", "Constant Tension"],
    "constant-tension-machine-lateral-raise": ["Machine", "Constant Tension"],
  }),
  ...family("Bicep Curl", {
    "ez-bar-bicep-curls": ["EZ-Bar"],
    "db-curls": ["Dumbbell"],
    "cable-curl": ["Cable"],
    "ez-bar-curls-21s": ["EZ-Bar", "21s"],
  }),
  ...family("Shoulder Press", {
    "overhead-press": ["Barbell"],
    "db-shoulder-press": ["Dumbbell"],
    "machine-shoulder-press": ["Machine"],
  }),
  ...family("Shrug", {
    shrugs: ["Barbell"],
    "db-shrug": ["Dumbbell"],
    "cable-shrugs": ["Cable"],
    "plate-shrug": ["Plate"],
    "snatch-grip-barbell-shrug": ["Barbell", "Snatch Grip"],
  }),
  ...family("Reverse Fly", {
    "bent-over-reverse-db-flies": ["Dumbbell"],
    "reverse-cable-flies": ["Cable"],
    "reverse-pec-deck": ["Machine"],
  }),
  ...family("Romanian Deadlift", { "barbell-rdl": ["Barbell"], "dumbbell-rdl": ["Dumbbell"] }),
  ...family("Skull Crusher", {
    "skull-crusher": ["Barbell"],
    "db-skull-crushers": ["Dumbbell"],
    "floor-skullcrushers": ["Barbell", "Floor"],
  }),
  ...family("Triceps Kickback", { "cable-tricep-kickback": ["Cable"], "db-triceps-kickback": ["Dumbbell"] }),
  ...family("Triceps Pressdown", {
    "triceps-pressdown": ["Cable"],
    "triceps-v-bar-pressdown": ["Cable", "V-Bar"],
  }),
]);
