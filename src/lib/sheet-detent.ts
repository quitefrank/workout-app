/**
 * The iOS 27 sheet's two detents, from Apple's iOS 27 kit (Figma wH8YZbekJXNew109clIJz1, Sheet - iPhone, 10525:1632).
 * Medium is inset 6pt with 459pt on an 874pt screen; large runs edge to edge from under the 62pt status bar. Pure, so
 * the gesture's decisions are tested without a browser.
 */
export const SHEET_MEDIUM_FRACTION = 459 / 874;
export const SHEET_STATUS_BAR = 62;
/**
 * How far a release carries, in ms of its velocity. Not measured: no recording of a sheet drag exists yet, so this is
 * tuned by hand. Measure it the way the tab lens was measured and replace it.
 */
export const SHEET_PROJECTION_MS = 200;

export type Detents = { medium: number; large: number };
export type SheetStop = "medium" | "large" | "dismiss";

export function detentsFor(screenHeight: number): Detents {
  return { medium: Math.round(screenHeight * SHEET_MEDIUM_FRACTION), large: screenHeight - SHEET_STATUS_BAR };
}

/** The sheet's shape for a visible height: above medium it grows (p 0 to 1), below it slides down whole (y px). */
export function sheetPose(visible: number, { medium, large }: Detents): { p: number; y: number } {
  if (visible >= medium) return { p: Math.min(1, (visible - medium) / Math.max(1, large - medium)), y: 0 };
  return { p: 0, y: medium - Math.max(0, visible) };
}

/** Where a release lands: the stop nearest to where its velocity (px per ms, up is positive) would carry it. */
export function settleSheet(visible: number, velocityUp: number, { medium, large }: Detents): SheetStop {
  const to = visible + velocityUp * SHEET_PROJECTION_MS;
  const stops: [SheetStop, number][] = [["dismiss", 0], ["medium", medium], ["large", large]];
  return stops.reduce((best, s) => (Math.abs(s[1] - to) < Math.abs(best[1] - to) ? s : best))[0];
}
