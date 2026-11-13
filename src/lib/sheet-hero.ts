/**
 * The exercise sheet's header, from the Exercise Sheet Hero prototype (https://claude.ai/artifact/4WWmpj6GS3aqRKhwm7eKur,
 * version 6, Frank's call 2026-11-07). The sheet opens on a large image; scrolling the content shrinks it into the kit's
 * Activity View thumbnail (754:26934) at the top left. The shrink follows the finger. The large title rides up with the
 * content and fades out; the small title fades in where it rests as the image uncovers it; titles never travel between
 * the two. The close button never moves. Stopped halfway, the header settles to the nearer end on SwiftUI's smooth
 * spring. Pure, so the geometry is tested without a browser.
 */

export type HeroBox = { x: number; y: number; w: number; h: number; r: number };

/** Header height at rest: the kit's Activity View header (16pt grabber row, 4pt, 64pt thumbnail, 12pt) */
export const HERO_COLLAPSED_H = 96;
/** The thumbnail's top, under the grabber row, level with the close button */
const TOP = 20;
/** The large image's top: where every other sheet's content starts, under its toolbar (16pt grabber row, 44pt
 *  toolbar, 10pt), so the close button never sits on the image when the sheet opens (Frank's call, 2026-11-13) */
export const HERO_LARGE_TOP = 70;
/** The large image's height */
export const HERO_IMAGE_H = 232;
/** The large title: 22pt bold, 16pt under the image; the 15pt subtitle 30pt under it, then 16pt to the content */
const TITLE_Y = HERO_LARGE_TOP + HERO_IMAGE_H + 16;
const SUB_Y = TITLE_Y + 30;
/** Header height with the image large, where the content starts */
export const HERO_EXPANDED_H = SUB_Y + 20 + 16;
/** How far the content scrolls while the image shrinks */
export const HERO_RANGE = HERO_EXPANDED_H - HERO_COLLAPSED_H;
/** The large title is gone by this share of the shrink; the small one starts appearing at this share */
export const HERO_FADE_OUT = 0.35;
export const HERO_FADE_IN = 0.6;
/** Idle time after the last scroll before the header settles, in ms */
export const HERO_SETTLE_DELAY = 140;
/** SwiftUI's .smooth: duration 0.5s, bounce 0 */
export const HERO_SPRING = { duration: 0.5, bounce: 0 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The fixed parts of the header for a sheet `width` wide: thumbnail, titles and the close button. */
export function heroLayout(width: number) {
  const smallW = Math.max(0, width - 100 - 16 - 44 - 12);
  return {
    collapsed: { x: 20, y: TOP, w: 64, h: 64, r: 16 } satisfies HeroBox,
    small: { x: 100, titleY: 32, subY: 52, w: smallW },
    large: { x: 16, w: Math.max(0, width - 32) },
    close: { x: width - 16 - 44, y: TOP },
  };
}

/** The large image's box. Its corners are concentric with the sheet's: 38pt (34pt below large) minus the 16pt inset. */
export function heroExpanded(width: number, full: boolean): HeroBox {
  return { x: 16, y: HERO_LARGE_TOP, w: Math.max(0, width - 32), h: HERO_IMAGE_H, r: (full ? 38 : 34) - 16 };
}

export type HeroPose = {
  /** 0 with the image large, 1 at the thumbnail */
  t: number;
  image: HeroBox;
  largeTitleY: number;
  largeSubY: number;
  largeOpacity: number;
  smallOpacity: number;
  /** Height of the sheet-coloured band behind the header, so content scrolls under it */
  backdrop: number;
};

/** The header after `scroll` points of scrolling. Only the large detent shrinks: a sheet below it fits and never scrolls. */
export function heroPose(scroll: number, width: number, full: boolean): HeroPose {
  const s = full ? Math.max(0, scroll) : 0;
  const t = clamp01(s / HERO_RANGE);
  const a = heroExpanded(width, full);
  const b = heroLayout(width).collapsed;
  return {
    t,
    image: { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), r: lerp(a.r, b.r, t) },
    largeTitleY: TITLE_Y - s,
    largeSubY: SUB_Y - s,
    largeOpacity: 1 - clamp01(t / HERO_FADE_OUT),
    smallOpacity: clamp01((t - HERO_FADE_IN) / (1 - HERO_FADE_IN)),
    backdrop: Math.max(HERO_COLLAPSED_H, HERO_EXPANDED_H - s),
  };
}

/** Where a header stopped halfway settles, like a large navigation title; null when it is already at an end. */
export function heroSettleTarget(scroll: number): number | null {
  if (scroll <= 0.5 || scroll >= HERO_RANGE - 0.5) return null;
  return scroll < HERO_RANGE / 2 ? 0 : HERO_RANGE;
}

export type SpringState = { x: number; v: number };

/** One frame of SwiftUI's spring: stiffness (2π/d)², damping 4π(1 − bounce)/d, mass 1. `dt` in seconds. */
export function springStep(s: SpringState, target: number, dt: number, spring = HERO_SPRING): SpringState {
  const k = (2 * Math.PI / spring.duration) ** 2;
  const c = (4 * Math.PI * (1 - spring.bounce)) / spring.duration;
  let { x, v } = s;
  const n = 8;
  const h = Math.min(0.034, dt) / n;
  for (let i = 0; i < n; i++) {
    v += (-k * (x - target) - c * v) * h;
    x += v * h;
  }
  return { x, v };
}

/** Whether a spring from `from` has come to rest at `target` */
export function springSettled(s: SpringState, from: number, target: number): boolean {
  const span = Math.abs(target - from) || 1;
  return Math.abs(s.x - target) / span < 0.0008 && Math.abs(s.v) / span < 0.02;
}
