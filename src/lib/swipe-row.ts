/**
 * Swipe to delete, as UITableView's trailing swipe with a destructive action does it (Mail's full swipe).
 *
 * Apple publishes no numbers for it (the HIG has no swipe actions page; SwiftUI's `swipeActions` documents only that a
 * full swipe performs the first action, on by default). The values come from SwipeCellKit
 * (https://github.com/SwipeCellKit/SwipeCellKit, Source/, develop), built to match Mail.app frame for frame:
 * - `SwipeActionsView`: a button is at least 74pt wide, its title padded 8pt.
 * - `SwipeExpansionStyle.destructive`: the target is the row's width less 30pt (`.edgeInset(30)`), at least the button
 *   plus 20pt (`minimumTargetOverscroll`), with a second trigger once the finger is past 80% of the row from its
 *   trailing edge (`.touchThreshold(0.8)`); nothing expands before 8pt of travel (`minimumExpansionTranslation`).
 * - `SwipeController.handlePan`: the row follows the finger 1:1 up to the target and at 20% past it
 *   (`targetOverscrollElasticity`), and at 20% when dragged the other way (`elasticTranslation`'s default ratio). When
 *   the expansion triggers short of the target the row animates to the target and the finger carries on from there.
 * - On release: a full swipe deletes; otherwise the row opens unless the finger was moving back toward closed
 *   (`targetState(forVelocity:)`), on a spring of mass 1, stiffness 100, damping 18 carrying the finger's velocity
 *   (scaled by 0.4 inside the elastic zone, `elasticScrollRatio`), or critically damped over 0.7s without one.
 * - Deleting (`performFillAction`): the row slides off past its own width plus the button in 0.3s, critically damped,
 *   while the row's height collapses in 0.3s (UIView.animate's default ease in and out).
 * - A tap elsewhere or a scroll closes an open row (`handleTap`, `handleTablePan`), and one row is open at a time.
 *
 * Everything here works in "reveal": how far the row has moved toward the leading edge, in points (0 closed).
 */

export const SWIPE = {
  minButton: 74,
  buttonPadding: 8,
  edgeInset: 30,
  minimumOverscroll: 20,
  touchThreshold: 0.8,
  minimumExpansionTranslation: 8,
  overscrollElasticity: 0.2,
  oppositeElasticity: 0.2,
  elasticScrollRatio: 0.4,
  /** UISpringTimingParameters(mass: 1, stiffness: 100, damping: 18): ω 10, damping ratio 0.9 */
  snap: { mass: 1, stiffness: 100, damping: 18 },
  /** UIViewPropertyAnimator(duration:dampingRatio: 1) without a velocity */
  settleSeconds: 0.7,
  deleteSeconds: 0.3,
  /** travel before the row claims the gesture from the vertical scroll; the pan recognizer's own slop */
  claim: 10,
} as const;

/** The delete button's width for a title of `titleWidth` points. */
export function buttonWidth(titleWidth: number): number {
  return Math.max(SWIPE.minButton, Math.ceil(titleWidth + SWIPE.buttonPadding * 2));
}

/** Where a full swipe triggers by distance alone. */
export function expansionTarget(rowWidth: number, button: number): number {
  return Math.max(button + SWIPE.minimumOverscroll, rowWidth - SWIPE.edgeInset);
}

/** The row's reveal for a raw reveal (where it started plus the finger's travel): 1:1, then 20% past the target. */
export function elasticReveal(raw: number, rowWidth: number, button: number): number {
  if (raw < 0) return raw * SWIPE.oppositeElasticity;
  const target = expansionTarget(rowWidth, button);
  return raw > target ? target + (raw - target) * SWIPE.overscrollElasticity : raw;
}

/** Whether the row is inside an elastic zone, where the release velocity is scaled down. */
export function isElastic(raw: number, rowWidth: number, button: number): boolean {
  return raw < 0 || raw > expansionTarget(rowWidth, button);
}

/**
 * Whether a full swipe is armed: past the button and either past the target or with the finger beyond 80% of the row
 * from its trailing edge. `fingerFromTrailing` is the finger's distance from the row's trailing edge in points.
 */
export function shouldExpand(reveal: number, travel: number, fingerFromTrailing: number, rowWidth: number, button: number): boolean {
  if (Math.abs(travel) <= SWIPE.minimumExpansionTranslation) return false;
  if (reveal <= button) return false;
  if (reveal > expansionTarget(rowWidth, button)) return true;
  return fingerFromTrailing / rowWidth > SWIPE.touchThreshold;
}

export type Release = "delete" | "open" | "close";

/**
 * What a release does. `velocity` is the finger's in points per second, positive toward the leading edge (opening).
 * A stopped finger leaves the row open, as SwipeCellKit's `velocity.x > 0 ? .center : .right` does.
 */
export function release(expanded: boolean, velocity: number): Release {
  if (expanded) return "delete";
  return velocity < 0 ? "close" : "open";
}

/** A critically damped spring that settles in `seconds` (within 0.1% of its goal), as a period for `spring`. */
export function responseFor(seconds: number): number {
  // (1 + ωt)e^(-ωt) = 0.001 at ωt ≈ 9.233
  return (2 * Math.PI * seconds) / 9.233;
}

/** The release spring's period and damping ratio from mass, stiffness and damping. */
export function snapSpring(): { response: number; damping: number } {
  const { mass, stiffness, damping } = SWIPE.snap;
  const omega = Math.sqrt(stiffness / mass);
  return { response: (2 * Math.PI) / omega, damping: damping / (2 * Math.sqrt(stiffness * mass)) };
}

/** UIView.animate's default curve, ease in and out: cubic-bezier(0.42, 0, 0.58, 1). */
export const EASE_IN_OUT = "cubic-bezier(0.42, 0, 0.58, 1)";
