/**
 * The active workout's layout, a choice in Settings saved per device in the `workout_layout` cookie (as Appearance is),
 * so Frank can compare the two finalists on his phone (his call, 2026-11-08, from the Workout App Teardown prototype,
 * https://claude.ai/artifact/XKi4yGQMMGzJAbWqUQE37v):
 *
 * - `centred`: the toolbar with the Glass Prominent ✓ between Journal and Swap; weight and reps are cards with the iOS 27
 *   kit's stepper.
 * - `pill`: Ladder's pill with an empty circle that logs, which grows into the Journal; Swap sits in the top bar; weight
 *   and reps are the kit's inset list rows with a trailing stepper.
 */
export type WorkoutLayout = "centred" | "pill";

export const WORKOUT_LAYOUT_COOKIE = "workout_layout";

export function workoutLayoutFrom(value: string | undefined | null): WorkoutLayout {
  return value === "pill" ? "pill" : "centred";
}

/** Save the choice on this device */
export function setWorkoutLayout(layout: WorkoutLayout) {
  document.cookie =
    layout === "centred"
      ? `${WORKOUT_LAYOUT_COOKIE}=; path=/; max-age=0; samesite=lax`
      : `${WORKOUT_LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax`;
}
