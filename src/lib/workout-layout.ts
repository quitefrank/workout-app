/**
 * The active workout's views: three saved layouts Frank picked in the Fixed Stage prototype (his call, 2026-11-08,
 * https://claude.ai/artifact/Pi7NdnzFdCp5EWNetaSSZg), switched in Settings or from the workout's More menu and saved per
 * device in a cookie, as Appearance is.
 *
 * Every view has the same header (the progress bar with the timer on its left on the More button's row, then the set
 * circles, the title and Up next) and weight and reps in cards. They differ in two things:
 *
 * - `log`: `centred` is the toolbar with the Glass Prominent ✓ between Journal and Swap; `pill` is Ladder's pill, whose
 *   empty circle logs, whose middle opens the Journal and whose trailing button swaps.
 * - `sets`: where the set circles sit, `header` (a header row) or `pill` (inside the pill, under the exercise's name).
 * - `titleFirst`: in the header, the title sits above the set circles in place of below them.
 */
export type LogLayout = "centred" | "pill";
export type SetsPlace = "header" | "pill";
export type WorkoutView = 1 | 2 | 3 | 4;
export type ViewSpec = { log: LogLayout; sets: SetsPlace; titleFirst?: boolean; summary: string };

export const VIEWS: Record<WorkoutView, ViewSpec> = {
  1: { log: "pill", sets: "header", summary: "Pill, set circles in the header" },
  2: { log: "centred", sets: "header", summary: "Centred log button, set circles in the header" },
  3: { log: "pill", sets: "pill", summary: "Pill, set circles in the pill" },
  4: { log: "pill", sets: "header", titleFirst: true, summary: "Pill, set circles under the title" },
};

export const VIEW_COOKIE = "workout_view";
/** The choices this replaced: the log button on its own, and before that one layout cookie */
const OLD_COOKIES = ["workout_log", "workout_steppers", "workout_layout"];

export function workoutViewFrom(get: (name: string) => string | undefined): WorkoutView {
  const v = Number(get(VIEW_COOKIE));
  if (v === 1 || v === 2 || v === 3 || v === 4) return v;
  // someone who picked the centred log button before views existed keeps it
  const old = get("workout_log") ?? (get("workout_layout") === "pill" ? "pill" : get("workout_layout") ? "centred" : undefined);
  return old === "centred" ? 2 : 1;
}

/** Save the choice on this device */
export function setWorkoutView(view: WorkoutView) {
  const year = "path=/; max-age=31536000; samesite=lax";
  document.cookie = `${VIEW_COOKIE}=${view}; ${year}`;
  for (const c of OLD_COOKIES) document.cookie = `${c}=; path=/; max-age=0; samesite=lax`;
}
