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

/**
 * The pill's style (Frank's call, 2026-11-10, from the iOS 27 bars in Figma ZD41TUAEBtLJI7t0qChNup 56:3, measured at
 * 375pt). Ladder's pill is the default; the others are iOS 27's smaller nav bars, the log check always leading and Swap
 * trailing, the check 28pt from the screen's edge in every style.
 * - `capsule` (ChatGPT's): one 50pt capsule 21pt from the sides, a 36pt check and a 36pt Swap inside, 7pt in.
 * - `split` (search, field, compose): a 48pt glass circle each side, 28pt from the edges, 12pt from a 48pt capsule.
 * - `leading` (Messages'): a 40pt glass circle, 12pt from a 40pt capsule with Swap inside at its trailing end.
 */
export type PillStyle = "ladder" | "capsule" | "split" | "leading";

export const PILL_STYLES: Record<PillStyle, { label: string; height: number; inset: number; radius: number }> = {
  ladder: { label: "Ladder", height: 67, inset: 20, radius: 26 },
  capsule: { label: "Capsule", height: 50, inset: 21, radius: 25 },
  split: { label: "Split", height: 48, inset: 28, radius: 24 },
  leading: { label: "Leading", height: 40, inset: 28, radius: 20 },
};

export const PILL_STYLE_COOKIE = "workout_pill_style";

export function pillStyleFrom(get: (name: string) => string | undefined): PillStyle {
  const v = get(PILL_STYLE_COOKIE);
  return v === "capsule" || v === "split" || v === "leading" ? v : "ladder";
}

export function setPillStyle(style: PillStyle) {
  document.cookie = `${PILL_STYLE_COOKIE}=${style}; path=/; max-age=31536000; samesite=lax`;
}
