/**
 * The page push, as UINavigationController moves its pages (Frank's call, 2026-11-10): going forward the new page
 * slides in from the right over the old one, which drifts 30% of the width left and dims; going back the page you leave
 * slides out to the right and the one under it comes back from 30% left. The bars stay where they are.
 *
 * The curve is SwiftUI's smooth spring (critically damped) with a 0.5s response, hand-tuned and not measured until a
 * screen recording of the phone exists. Pure, so the glass stage and the tests share it.
 */

export type PushDirection = "forward" | "back";

export const PUSH = {
  /** SwiftUI's response, in seconds: the spring's period */
  response: 0.5,
  /** the run ends here and snaps the last fraction of a point, which the spring has all but covered */
  durationMs: 600,
  /** how far the page underneath sits left of its place, as a share of the width */
  under: 0.3,
  /** how much the page underneath is dimmed when fully covered */
  dim: 0.1,
  /** the soft shadow off the top page's leading edge: its width in pt and its darkness at the edge */
  shadowWidth: 16,
  shadowAlpha: 0.12,
  /** waiting for the new page longer than this gives up on the push and shows it as it is */
  holdMaxMs: 2000,
} as const;

/** The critically damped spring from 0 to 1 at `ms` after the start: 1 − (1 + ωt)e^(−ωt), with ω = 2π / response. */
export function pushProgress(ms: number): number {
  if (ms <= 0) return 0;
  if (ms >= PUSH.durationMs) return 1;
  const w = (2 * Math.PI) / PUSH.response, t = ms / 1000;
  return 1 - (1 + w * t) * Math.exp(-w * t);
}

/**
 * Where the two pages are at progress `p` (0 to 1), in points from the screen's left edge, for a screen `width` wide.
 * `top` is the page that slides over: the new one going forward, the one you leave going back. `under` is the other,
 * with its dimming.
 */
export function pushLayers(direction: PushDirection, p: number, width: number) {
  // q is how much of the width the top page has still to cover: 1 when it is off to the right, 0 when it is in place
  const q = direction === "forward" ? 1 - p : p;
  return {
    topX: width * q,
    underX: -PUSH.under * width * (1 - q),
    topIsNew: direction === "forward",
    dim: PUSH.dim * (1 - q),
  };
}

/**
 * Whether a tap on a link should push: a plain left click on a link inside the app to another path. A change of the
 * query alone (a day on the calendar) is the same page, so it does not.
 */
export function pushesFor(
  link: { href: string; target: string; download: boolean },
  click: { button: number; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean },
  here: { origin: string; pathname: string },
): boolean {
  if (click.button !== 0 || click.metaKey || click.ctrlKey || click.shiftKey || click.altKey) return false;
  if ((link.target && link.target !== "_self") || link.download) return false;
  let url: URL;
  try {
    url = new URL(link.href, here.origin);
  } catch {
    return false;
  }
  return url.origin === here.origin && url.pathname !== here.pathname;
}
