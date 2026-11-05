/**
 * The iOS 27 sheet's height. A sheet fits its content, up to the large detent of Apple's iOS 27 kit (Figma
 * wH8YZbekJXNew109clIJz1, Sheet - iPhone, 10525:1632): edge to edge from under the 62pt status bar. Apple's custom
 * detents, `.height(_:)`, do this natively. Pure, so the gesture's decisions are tested without a browser.
 */
export const SHEET_STATUS_BAR = 62;
/**
 * How far a release carries, in ms of its velocity. Not measured: no recording of a sheet drag exists yet, so this is
 * tuned by hand. Measure it the way the tab lens was measured and replace it.
 */
export const SHEET_PROJECTION_MS = 200;

/** `full` says the sheet is at the large detent: edge to edge and opaque. Below it a sheet stays inset glass. */
export type SheetFit = { height: number; full: boolean };

/** With no content height (a raised keyboard needs the room), it is the large detent. */
export function sheetFit(screenHeight: number, contentHeight = Infinity): SheetFit {
  const large = screenHeight - SHEET_STATUS_BAR;
  return { height: Math.min(contentHeight, large), full: contentHeight >= large };
}

/** How far a drag has slid the sheet down, for the height still showing. It never goes above its resting place. */
export function sheetSlide(visible: number, height: number): number {
  return height - Math.min(height, Math.max(0, visible));
}

/** Whether a release closes the sheet: where its velocity (px per ms, up is positive) would carry it is nearer closed. */
export function releaseDismisses(visible: number, velocityUp: number, height: number): boolean {
  return visible + velocityUp * SHEET_PROJECTION_MS < height / 2;
}
