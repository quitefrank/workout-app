/**
 * The active workout's views: three saved layouts Frank picked in the Fixed Stage prototype (his calls of 2026-11-08 and 2026-11-09,
 * https://claude.ai/artifact/Pi7NdnzFdCp5EWNetaSSZg), switched in Settings or from the workout's More menu and saved per
 * device in a cookie, as Appearance is.
 *
 * Every view has the same header (the progress bar with the timer on its left on the More button's row, then the set
 * circles, the title and Up next) and weight and reps in cards. They differ in two things:
 *
 * - `log`: `centred` is the toolbar with the Glass Prominent ✓ between Journal and Swap; `pill` is Ladder's pill, whose
 *   empty circle logs, whose middle opens the Journal and whose trailing button swaps.
 * - `sets`: where the set mark sits, `header` (a header row) or `pill` (inside the pill, under the exercise's name).
 * - `setStyle`: the mark is the set circles, or the set as blue text ("Set 2 of 3", "Warm-up 1 of 2").
 */
export type LogLayout = "centred" | "pill";
export type SetsPlace = "header" | "pill";
export type SetStyle = "circles" | "text";
export type WorkoutView = 1 | 2 | 3;
export type ViewSpec = { log: LogLayout; sets: SetsPlace; setStyle: SetStyle; summary: string };

export const VIEWS: Record<WorkoutView, ViewSpec> = {
  1: { log: "pill", sets: "header", setStyle: "circles", summary: "Pill, set circles in the header" },
  2: { log: "pill", sets: "pill", setStyle: "text", summary: "Pill, the set as text in the pill" },
  3: { log: "centred", sets: "header", setStyle: "text", summary: "Centred log button, the set as text in the header" },
};

export const VIEW_COOKIE = "workout_view";
/** The choices this replaced: the log button on its own, and before that one layout cookie */
const OLD_COOKIES = ["workout_log", "workout_steppers", "workout_layout"];

export function workoutViewFrom(get: (name: string) => string | undefined): WorkoutView {
  const v = Number(get(VIEW_COOKIE));
  if (v === 1 || v === 2 || v === 3) return v;
  // someone who picked the centred log button before views existed keeps it
  const old = get("workout_log") ?? (get("workout_layout") === "pill" ? "pill" : get("workout_layout") ? "centred" : undefined);
  return old === "centred" ? 3 : 1;
}

/** Save the choice on this device */
export function setWorkoutView(view: WorkoutView) {
  const year = "path=/; max-age=31536000; samesite=lax";
  document.cookie = `${VIEW_COOKIE}=${view}; ${year}`;
  for (const c of OLD_COOKIES) document.cookie = `${c}=; path=/; max-age=0; samesite=lax`;
}
