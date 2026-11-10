/**
 * The active workout's two versions (Frank's call, 2026-11-09), switched from the workout's More menu under Settings and
 * saved per device in a cookie, as Appearance is.
 *
 * - Version 1: Ladder's pill in the dock (its circle logs, its middle opens the Journal card), set dots under the name,
 *   Swap in More. View 5 of the views Frank tried.
 * - Version 2: the toolbar under the steppers, the old View 3 brought back. The Glass Prominent ✓ logs in the middle,
 *   with Journal and Swap either side, each centred under the stepper card above it (Frank's Figma frame,
 *   https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=28-1716). The Journal opens as a sheet.
 */
export type WorkoutVersion = 1 | 2;

export const VERSION_COOKIE = "workout_version";

export const VERSIONS: Record<WorkoutVersion, string> = {
  1: "The pill in the dock logs the set and opens the Journal",
  2: "The log button under the steppers, with Journal and Swap either side",
};

export function workoutVersionFrom(get: (name: string) => string | undefined): WorkoutVersion {
  return get(VERSION_COOKIE) === "2" ? 2 : 1;
}

/** Save the choice on this device */
export function setWorkoutVersion(version: WorkoutVersion) {
  document.cookie = `${VERSION_COOKIE}=${version}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Glass stepper cards (Frank's call, 2026-11-10, from https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=38-2134):
 * a Settings switch that gives the stepper cards' background the Liquid Glass material, the steppers and values on top
 * unchanged. Off by default; saved per device like the version. An exception to "glass is the control layer only",
 * allowed because the active workout never scrolls, so the cards cannot drift.
 */
export const GLASS_STEPPERS_COOKIE = "workout_glass_steppers";

export function glassSteppersFrom(get: (name: string) => string | undefined): boolean {
  return get(GLASS_STEPPERS_COOKIE) === "1";
}

export function setGlassSteppers(on: boolean) {
  document.cookie = `${GLASS_STEPPERS_COOKIE}=${on ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * Swap in the pill (Frank's call, 2026-11-10, Figma ZD41TUAEBtLJI7t0qChNup 3:164): a 44pt button with the 22pt swap
 * icon at the pill's trailing end, on unless switched off in Settings, saved per device. Off, Swap Exercise is in More.
 */
export const PILL_SWAP_COOKIE = "workout_pill_swap";

export function pillSwapFrom(get: (name: string) => string | undefined): boolean {
  return get(PILL_SWAP_COOKIE) !== "0";
}

export function setPillSwap(on: boolean) {
  document.cookie = `${PILL_SWAP_COOKIE}=${on ? 1 : 0}; path=/; max-age=31536000; samesite=lax`;
}
