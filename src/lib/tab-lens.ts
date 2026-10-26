/**
 * The tab bar's lens, iOS 26's selection: at rest a dark capsule under the selected tab; touched, it lifts into clear
 * glass, swells the bar, travels to the tab on a spring, stretching with speed, and settles back into the capsule. A
 * drag along the bar carries it under the finger, with a rubber band past the end tabs. This is the motion, pure; the
 * tab bar drives the DOM from it and the glass stage the shader (src/glass/engine/stage.ts).
 *
 * Positions are along the bar in its own px, unswelled, measured from its centre.
 */

/** The Glass Lab V3's Tab lens dials (docs/lab/glass-lab-v3.html, LENS_DEFAULTS), read off Frank's iOS 26 recording
 *  on 2026-10-25. Change them only by copying a newer lab row. */
export const LENS = {
  /** size when lifted (width; height takes 60% of the growth) */
  lensLift: 1.2,
  /** the bar's growth while lifted */
  lensSwell: 0.035,
  /** extra width at full speed (height gives up a quarter of it) */
  lensStretch: 0.3,
  /** the travel spring's period in seconds (SwiftUI's response) */
  lensResponse: 0.32,
  /** its damping ratio (1 = no overshoot) */
  lensDamping: 0.72,
  /** magnification inside the lifted lens */
  lensMag: 1.15,
  /** how far the rim bends the read outward, px */
  lensRefract: 5,
  /** the colour split at the rim */
  lensFringe: 0.6,
  /** how far the tabs beside the lens are pushed, px */
  lensPush: 3,
  /** how much of the bar's frost the lifted lens drops */
  lensClear: 0.7,
  /** how far the lifted lens's body is pulled away from the ink (to black under light ink, white under dark), so the
   *  tint stays legible over saturated content as the bar's own haze keeps its ink legible */
  lensVeil: 0.35,
};
export type LensParams = typeof LENS;

/** Speed, px/s, at which the stretch is full */
const FULL_SPEED = 900;
/** The finger's spring while dragging: tight and critically damped, so the lens trails the finger by a frame or two */
const DRAG = { response: 0.12, damping: 1 };
/** Lifting is quick and firm; settling has a little give */
const LIFT_UP = { response: 0.18, damping: 0.9 };
const LIFT_DOWN = { response: 0.3, damping: 0.72 };

export type LensState = { x: number | null; vx: number; lift: number; vl: number };
export type LensInput = { pressed: boolean; dragX: number | null };

export const restingLens = (): LensState => ({ x: null, vx: 0, lift: 0, vl: 0 });

/** One step of a damped spring by its period and damping ratio, integrated in steps of at most 4ms. */
export function spring(x: number, v: number, goal: number, response: number, damping: number, dtMs: number): [number, number] {
  const k = Math.pow((2 * Math.PI) / response, 2), c = (4 * Math.PI * damping) / response;
  const n = Math.max(1, Math.ceil(dtMs / 4)), h = dtMs / 1000 / n;
  for (let i = 0; i < n; i++) {
    v += (-k * (x - goal) - c * v) * h;
    x += v * h;
  }
  return [x, v];
}

/** Past the ends the lens follows the finger with the square root of the overshoot, as a scroll view's edge does. */
export function rubberBand(x: number, lo: number, hi: number): number {
  if (x < lo) return lo - Math.sqrt(lo - x) * 2;
  if (x > hi) return hi + Math.sqrt(x - hi) * 2;
  return x;
}

export function nearestIndex(centres: number[], x: number): number {
  let best = 0;
  centres.forEach((c, i) => { if (Math.abs(c - x) < Math.abs(centres[best] - x)) best = i; });
  return best;
}

/** Where the lens heads: the finger while it drags, else the selected tab's centre. */
export function lensGoal(centres: number[], selected: number, input: LensInput): number {
  if (input.dragX === null || !centres.length) return centres[selected] ?? 0;
  return rubberBand(input.dragX, Math.min(...centres), Math.max(...centres));
}

/** Advance the lens one frame. Lifted while touched or travelling; with reduced motion it jumps and never lifts. */
export function stepLens(s: LensState, goal: number, input: LensInput, P: LensParams, dtMs: number, reduced: boolean): LensState {
  if (s.x === null || reduced) return { x: goal, vx: 0, lift: 0, vl: 0 };
  const travel = input.dragX !== null ? DRAG : { response: P.lensResponse, damping: P.lensDamping };
  const [x, vx] = spring(s.x, s.vx, goal, travel.response, travel.damping, dtMs);
  const up = input.pressed || Math.abs(x - goal) > 1.5 || Math.abs(vx) > 30;
  const l = up ? LIFT_UP : LIFT_DOWN;
  const [lift, vl] = spring(s.lift, s.vl, up ? 1 : 0, l.response, l.damping, dtMs);
  return { x, vx, lift, vl };
}

/** Nothing left to animate: the loop driving the lens can stop. */
export function lensSettled(s: LensState, goal: number, input: LensInput): boolean {
  return !input.pressed && input.dragX === null && s.x !== null && Math.abs(s.x - goal) < 0.05 && Math.abs(s.vx) < 0.5
    && Math.abs(s.lift) < 0.002 && Math.abs(s.vl) < 0.01;
}

export type LensShape = { x: number; w: number; h: number; lift: number; swell: number };

/** The lens's size from its rest size (the selected tab's capsule), how lifted it is and how fast it moves. A lift
 *  overshooting 1 grows the lens a touch further; `lift` itself is clamped to 0..1 for the optics. */
export function lensShape(s: LensState, restW: number, restH: number, P: LensParams): LensShape {
  const lc = Math.max(0, s.lift), la = Math.min(1, lc), sp = Math.min(1, Math.abs(s.vx) / FULL_SPEED);
  return {
    x: s.x ?? 0,
    w: restW * (1 + (P.lensLift - 1) * lc) * (1 + P.lensStretch * sp),
    h: restH * (1 + (P.lensLift - 1) * 0.6 * lc) * (1 - P.lensStretch * 0.25 * sp),
    lift: la,
    swell: 1 + P.lensSwell * la,
  };
}
