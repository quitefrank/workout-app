/**
 * Exercises with no illustration of their own borrow the closest one (Frank's call, 2026-11-12: no exercise shows an
 * empty tile). Each key is an exercise slug, each value the slug whose image it shows: the same movement on other
 * equipment or at another angle, else the nearest movement. An exercise's own image always wins, so importing it
 * replaces the stand-in; then delete its line here (a test fails until you do).
 */
export const EXERCISE_IMAGE_STANDINS: Readonly<Record<string, string>> = {
  // Biceps
  "ez-bar-preacher-bottom-half-curl": "barbell-preacher-curl",
  // Cardio
  running: "warm-up-run",
  "treadmill-run": "max-incline-walk",
  // Chest
  "barbell-high-incline-bench-press": "bench-press-incline",
  "barbell-low-incline-bench-press": "bench-press-incline",
  "barbell-pin-bench-press": "bench-press-flat",
  "decline-machine-chest-press": "machine-chest-press",
  "dumbbell-decline-bench-press": "db-bench-press",
  "dumbbell-high-incline-bench-press": "db-bench-press-incline",
  "high-incline-machine-chest-press": "incline-machine-press",
  "low-incline-machine-chest-press": "incline-machine-press",
  "smith-machine-bench-press": "low-incline-smith-machine-press",
  "smith-machine-decline-bench-press": "low-incline-smith-machine-press",
  "smith-machine-incline-bench-press": "high-incline-smith-machine-press",
  // Hamstrings
  "pin-good-morning": "barbell-rdl",
  "machine-seated-single-leg-leg-curl": "lying-leg-curl",
  "seated-leg-curl": "lying-leg-curl",
  // Quadriceps
  "anderson-squat": "pause-squat",
  "staggered-squats": "hawaiian-squats",
  // Shoulders
  "barbell-seated-shoulder-press": "overhead-press",
  "dumbbell-standing-shoulder-press": "standing-arnold-press",
  // Stretches
  "wide-leg-forward-fold": "cross-leg-forward-fold",
  "side-side-leg-swings": "front-back-leg-swings",
  "foam-roller-partial-hinge": "dynamic-toe-touch",
  "hip-flexion": "front-back-leg-swings",
  "hip-rotation": "clamshell-hip-rotation",
  kegel: "glute-bridge",
  "roll-ups": "sit-ups",
  "side-lying-twists": "torso-twist-with-medicine-ball",
  "standing-glute-stretch": "gluteal-release-with-ball",
  "static-lat-stretch": "delt-stretch",
  "step-throughs": "walking-db-lunge",
  "supine-lifting-pointing-toes": "calf-flexor-with-ball",
  "touch-your-toes": "dynamic-toe-touch",
  // Triceps
  "close-grip-smith-machine-press": "close-grip-bench-press",
  "close-grip-dip": "dip",
  "weighted-dip-close-grip": "weighted-dips",
  "1-arm-overhead-cable-extension": "french-press",
  "overhead-cable-triceps-extension": "french-press",
  "overhead-extension-stretch-only": "french-press",
  "squeeze-only-triceps-pressdown": "triceps-pressdown",
  "cross-body-tricep-extension": "single-arm-tricep-pressdown",
};
