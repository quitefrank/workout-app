/**
 * The exercise sheet's header, from the Exercise Sheet Hero prototype (https://claude.ai/artifact/4WWmpj6GS3aqRKhwm7eKur,
 * version 6, Frank's call 2026-11-07). The sheet opens on a large image; scrolling the content shrinks it into the kit's
 * Activity View thumbnail (754:26934) at the top left. The shrink follows the finger. The close button never moves.
 * Stopped halfway, the header settles to the nearer end on SwiftUI's smooth spring. Pure, so the geometry is tested
 * without a browser.
 *
 * Two motions, switched per device in Settings while Frank compares them (2026-11-13):
 * - `fade`: the large title sits under the image, rides up with the content and fades out; the small title fades in
 *   where it rests as the image uncovers it; titles never travel. The image opens at 70pt, where other sheets' content
 *   starts, so the close button is never on it.
 * - `push`: the title and subtitle sit in the header row from the start at their final size and height. In three beats
 *   the image shrinks to the thumbnail just under the row, the titles slide right to make room, and the thumbnail rises
 *   into the space they left, so text and image never overlap.
 * - `center`: as push, but the title and subtitle start centred in the header row, each on its own width, and slide
 *   left to rest beside the thumbnail.
 */

export type HeroBox = { x: number; y: number; w: number; h: number; r: number };
export type HeroMode = "fade" | "push" | "center";
export const HERO_MODES: ReadonlyArray<HeroMode> = ["fade", "push", "center"];
/** The small titles' natural widths, measured in the DOM; `center` needs them to centre the text */
export type HeroText = { title: number; sub: number };

/** Header height at rest: the kit's Activity View header (16pt grabber row, 4pt, 64pt thumbnail, 12pt) */
export const HERO_COLLAPSED_H = 96;
/** The thumbnail's top, under the grabber row, level with the close button */
const TOP = 20;
/** The small title (15pt medium) and subtitle (13pt) in the header row, beside the thumbnail */
const SMALL_TITLE_Y = 32;
const SMALL_SUB_Y = 52;
/** The large image's height */
export const HERO_IMAGE_H = 232;
/** fade: the large title is gone by this share of the shrink; the small one starts appearing at this share */
export const HERO_FADE_OUT = 0.35;
export const HERO_FADE_IN = 0.6;
/** push: the beats as shares of the scroll (shrink, then slide, then rise) */
export const HERO_SHRINK_END = 0.7;
export const HERO_SLIDE_END = 0.85;
/** Idle time after the last scroll before the header settles, in ms */
export const HERO_SETTLE_DELAY = 140;
/** SwiftUI's .smooth: duration 0.5s, bounce 0 */
export const HERO_SPRING = { duration: 0.5, bounce: 0 };

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/** The vertical plan for a motion: where the large image starts, where the content starts, and the scroll it takes */
export function heroMetrics(mode: HeroMode) {
  if (mode !== "fade") {
    // 8pt under the subtitle's 18pt line, then 16pt from the image to the content
    const largeTop = SMALL_SUB_Y + 18 + 8;
    const expandedH = largeTop + HERO_IMAGE_H + 16;
    return { largeTop, largeTitleY: SMALL_TITLE_Y, largeSubY: SMALL_SUB_Y, expandedH, range: expandedH - HERO_COLLAPSED_H };
  }
  // where every other sheet's content starts (16pt grabber row, 44pt toolbar, 10pt); the 22pt title 16pt under the
  // image, the 15pt subtitle 30pt under it, then 16pt to the content
  const largeTop = 70;
  const largeTitleY = largeTop + HERO_IMAGE_H + 16;
  const largeSubY = largeTitleY + 30;
  const expandedH = largeSubY + 20 + 16;
  return { largeTop, largeTitleY, largeSubY, expandedH, range: expandedH - HERO_COLLAPSED_H };
}

/** The fixed parts of the header for a sheet `width` wide: thumbnail, titles and the close button. */
export function heroLayout(width: number) {
  // the small titles end 12pt before the close button
  const end = width - 16 - 44 - 12;
  return {
    collapsed: { x: 20, y: TOP, w: 64, h: 64, r: 16 } satisfies HeroBox,
    small: { titleY: SMALL_TITLE_Y, subY: SMALL_SUB_Y, x: 100, end },
    large: { x: 16, w: Math.max(0, width - 32) },
    close: { x: width - 16 - 44, y: TOP },
  };
}

/** The large image's box. Its corners are concentric with the sheet's: 38pt (34pt below large) minus the 16pt inset. */
export function heroExpanded(width: number, full: boolean, mode: HeroMode): HeroBox {
  return { x: 16, y: heroMetrics(mode).largeTop, w: Math.max(0, width - 32), h: HERO_IMAGE_H, r: (full ? 38 : 34) - 16 };
}

export type HeroPose = {
  /** 0 with the image large, 1 at the thumbnail */
  t: number;
  image: HeroBox;
  /** fade's large title under the image (hidden in push) */
  largeTitleY: number;
  largeSubY: number;
  largeOpacity: number;
  /** The small titles in the header row: their leading edges, widths and opacity */
  titleX: number;
  titleW: number;
  subX: number;
  subW: number;
  smallOpacity: number;
  /** Height of the sheet-coloured band behind the header, so content scrolls under it */
  backdrop: number;
};

/** The header after `scroll` points of scrolling. Only the large detent shrinks: a sheet below it fits and never scrolls. */
export function heroPose(scroll: number, width: number, full: boolean, mode: HeroMode, text?: HeroText): HeroPose {
  const m = heroMetrics(mode);
  const s = full ? Math.max(0, scroll) : 0;
  const t = clamp01(s / m.range);
  const a = heroExpanded(width, full, mode);
  const l = heroLayout(width);
  const b = l.collapsed;
  const backdrop = Math.max(HERO_COLLAPSED_H, m.expandedH - s);

  if (mode !== "fade") {
    const shrink = clamp01(t / HERO_SHRINK_END);
    const slide = clamp01((t - HERO_SHRINK_END) / (HERO_SLIDE_END - HERO_SHRINK_END));
    const rise = clamp01((t - HERO_SLIDE_END) / (1 - HERO_SLIDE_END));
    // push starts at the sheet's inset; center starts each line centred, never past the inset when it is too wide
    const start = (w: number | undefined) => (mode === "center" && w !== undefined ? Math.max(16, (width - w) / 2) : 16);
    const titleX = lerp(start(text?.title), l.small.x, slide);
    const subX = lerp(start(text?.sub), l.small.x, slide);
    return {
      t,
      image: { x: lerp(a.x, b.x, shrink), y: lerp(a.y, b.y, rise), w: lerp(a.w, b.w, shrink), h: lerp(a.h, b.h, shrink), r: lerp(a.r, b.r, shrink) },
      largeTitleY: m.largeTitleY,
      largeSubY: m.largeSubY,
      largeOpacity: 0,
      titleX,
      titleW: Math.max(0, l.small.end - titleX),
      subX,
      subW: Math.max(0, l.small.end - subX),
      smallOpacity: 1,
      backdrop,
    };
  }

  return {
    t,
    image: { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), w: lerp(a.w, b.w, t), h: lerp(a.h, b.h, t), r: lerp(a.r, b.r, t) },
    largeTitleY: m.largeTitleY - s,
    largeSubY: m.largeSubY - s,
    largeOpacity: 1 - clamp01(t / HERO_FADE_OUT),
    titleX: l.small.x,
    titleW: Math.max(0, l.small.end - l.small.x),
    subX: l.small.x,
    subW: Math.max(0, l.small.end - l.small.x),
    smallOpacity: clamp01((t - HERO_FADE_IN) / (1 - HERO_FADE_IN)),
    backdrop,
  };
}

/** Where a header stopped halfway settles, like a large navigation title; null when it is already at an end. */
export function heroSettleTarget(scroll: number, mode: HeroMode): number | null {
  const range = heroMetrics(mode).range;
  if (scroll <= 0.5 || scroll >= range - 0.5) return null;
  return scroll < range / 2 ? 0 : range;
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

// The setting, saved on this device (a test setting while Frank compares the two)
export const HERO_MODE_KEY = "sheet_hero_mode";
const HERO_MODE_EVENT = "sheet-hero-mode";
/** The old motion stays the default until Frank picks one */
export const HERO_MODE_DEFAULT: HeroMode = "fade";

export function parseHeroMode(raw: string | null): HeroMode {
  return (HERO_MODES as ReadonlyArray<string>).includes(raw ?? "") ? (raw as HeroMode) : HERO_MODE_DEFAULT;
}

export function readHeroModeRaw(): string | null {
  try {
    return localStorage.getItem(HERO_MODE_KEY);
  } catch {
    return null;
  }
}

export function writeHeroMode(mode: HeroMode) {
  try {
    localStorage.setItem(HERO_MODE_KEY, mode);
  } catch {
    // private mode: the choice holds for this visit only through the event
  }
  window.dispatchEvent(new Event(HERO_MODE_EVENT));
}

export function subscribeHeroMode(cb: () => void) {
  window.addEventListener(HERO_MODE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(HERO_MODE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
