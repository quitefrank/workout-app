/**
 * The page push, as UINavigationController moves its pages (Frank's call, 2026-11-10): going forward the new page
 * slides in from the right over the old one, which drifts a quarter of the width left and dims; going back the page you
 * leave slides out to the right and the one under it comes back from a quarter left. The bars stay where they are.
 *
 * Cross-referenced 2026-11-10 (Frank asked; the first cut at a 0.5s response read slow). UIKit's push runs on the
 * private animation curve 7, a CASpringAnimation of mass 3, stiffness 1000, damping 500 played over 0.5s (printed from
 * the live animation, leavez.xyz/2017/03/20/animation-curve; React Native found the same values inspecting the native
 * push). Measured, it starts from rest, is 90% of the way at about half its 0.5s and settles with a long tail. The
 * curve here is a critically damped spring through those points: 90% at 250ms, so a 0.404s response, done by 500ms.
 * The geometry (the page under drifts a quarter of the width, a 10% black dim, a 6pt shadow) is from a side-by-side
 * re-creation of the iOS 10 push (gist.github.com/stuartjmoore/037dda91cc25daf66cd2d6578de41285). Neither has been
 * measured on iOS 26; replace them from a frame-sampled recording of the phone when one exists. Pure, so the glass
 * stage and the tests share it.
 */

export type PushDirection = "forward" | "back";

export const PUSH = {
  /** the spring's period in seconds (SwiftUI's response): critically damped, 90% of the way at 250ms, as curve 7 is */
  response: 0.404,
  /** curve 7's 0.5s; the run snaps the last 0.4% here, under 2pt across a phone */
  durationMs: 500,
  /** how far the page underneath sits left of its place, as a share of the width */
  under: 0.25,
  /** how much the page underneath is dimmed when fully covered */
  dim: 0.1,
  /** the soft shadow off the top page's leading edge: its width in pt and its darkness at the edge */
  shadowWidth: 6,
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
