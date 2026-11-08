/**
 * The active workout's layout: two choices Frank switches between to compare on his phone (his call, 2026-11-08, from
 * the Workout App Teardown prototype, https://claude.ai/artifact/XKi4yGQMMGzJAbWqUQE37v). Saved per device in cookies,
 * as Appearance is, and changed in Settings or from the workout's More menu.
 *
 * - `log`: `centred` is the toolbar with the Glass Prominent ✓ between Journal and Swap; `pill` is Ladder's pill, whose
 *   empty circle logs and which grows into the Journal, with Swap in the top bar.
 * - `steppers`: `cards` puts weight and reps in cards over the iOS 27 kit's stepper; `list` is the kit's inset list rows
 *   with the stepper trailing.
 */
export type LogLayout = "centred" | "pill";
export type StepperLayout = "cards" | "list";
export type WorkoutLayout = { log: LogLayout; steppers: StepperLayout };

export const LOG_LAYOUT_COOKIE = "workout_log";
export const STEPPER_LAYOUT_COOKIE = "workout_steppers";
/** The single choice this replaced (centred or pill, each with its steppers); read once as the starting point */
const OLD_COOKIE = "workout_layout";

export function workoutLayoutFrom(get: (name: string) => string | undefined): WorkoutLayout {
  const old = get(OLD_COOKIE) === "pill";
  const log = get(LOG_LAYOUT_COOKIE);
  const steppers = get(STEPPER_LAYOUT_COOKIE);
  return {
    log: log === "pill" || log === "centred" ? log : old ? "pill" : "centred",
    steppers: steppers === "list" || steppers === "cards" ? steppers : old ? "list" : "cards",
  };
}

/** Save the choice on this device */
export function setWorkoutLayout(layout: WorkoutLayout) {
  const year = "path=/; max-age=31536000; samesite=lax";
  document.cookie = `${LOG_LAYOUT_COOKIE}=${layout.log}; ${year}`;
  document.cookie = `${STEPPER_LAYOUT_COOKIE}=${layout.steppers}; ${year}`;
  document.cookie = `${OLD_COOKIE}=; path=/; max-age=0; samesite=lax`;
}
