/**
 * The tab bar's lens, iOS 26's selection: at rest a dark capsule under the selected tab; touched, it lifts into clear
 * glass and travels to the tab, then drops back into the capsule. A drag along the bar carries it under the finger,
 * with a rubber band past the end tabs. This is the motion, pure; the tab bar drives the DOM from it and the glass stage
 * the shader (src/glass/engine/stage.ts).
 *
 * Four things move, each on its own spring, as measured frame by frame off Frank's iOS 26 recording (2026-10-26, 30 fps,
 * two taps; docs/lab/glass-presets.md, Tab lens): the lens's place; its lift, which scales it and turns it from the dark
 * capsule into clear glass; the bar's swell, which follows the finger alone; and the bar's dip as the lens drops back in.
 *
 * Positions are along the bar in its own px, unswelled, measured from its centre.
 */

/** The Glass Lab V3's Tab lens dials (docs/lab/glass-lab-v3.html, LENS_DEFAULTS). Change them only by copying a newer
 *  lab row. */
export const LENS = {
  /** the lens's scale at full lift, both ways (it peaks near 1.3x on a one-tab tap, as the goal drops before it lands) */
  lensLift: 1.35,
  /** the bar's growth while the finger is down (it peaks near +4.3% on a tap) */
  lensSwell: 0.049,
  /** extra width at full speed; iOS shows none, so 0 */
  lensStretch: 0,
  /** the travel spring's period in seconds (SwiftUI's response), and its damping ratio: critically damped, no overshoot */
  lensResponse: 0.242,
  lensDamping: 1,
  /** the lens stays lifted while the finger is down or it is more than this many px from its tab */
  lensHold: 4,
  /** the lift spring's period (critically damped, both ways) */
  lensLiftResponse: 0.265,
  /** the swell spring's period and damping */
  lensSwellResponse: 0.272,
  lensSwellDamping: 0.68,
  /** how far the bar dips while the lens drops back into it */
  lensDip: 0.008,
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
/** The dip comes and goes within a frame on the phone */
const DIP = { response: 0.06, damping: 1 };
/** The lens turns clear as its lift passes these (a scale of about 1.06 to 1.14), and dark again on the way down */
const CLEAR_FROM = 0.18, CLEAR_TO = 0.4;

export type LensState = { x: number | null; vx: number; lift: number; vl: number; swell: number; vs: number; dip: number; vd: number };
export type LensInput = { pressed: boolean; dragX: number | null };

export const restingLens = (): LensState => ({ x: null, vx: 0, lift: 0, vl: 0, swell: 0, vs: 0, dip: 0, vd: 0 });

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

const smoothstep = (a: number, b: number, x: number) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

/** Advance one frame. With reduced motion the lens jumps and nothing lifts, swells or dips. */
export function stepLens(s: LensState, goal: number, input: LensInput, P: LensParams, dtMs: number, reduced: boolean): LensState {
  if (s.x === null || reduced) return { ...restingLens(), x: goal };
  const travel = input.dragX !== null ? DRAG : { response: P.lensResponse, damping: P.lensDamping };
  const [x, vx] = spring(s.x, s.vx, goal, travel.response, travel.damping, dtMs);
  // lifted while touched or still on its way; the bar swells for the finger alone, so on a tap it is already
  // deflating while the lens travels
  const up = input.pressed || Math.abs(x - goal) > P.lensHold;
  const [lift, vl] = spring(s.lift, s.vl, up ? 1 : 0, P.lensLiftResponse, 1, dtMs);
  const [swell, vs] = spring(s.swell, s.vs, input.pressed ? P.lensSwell : 0, P.lensSwellResponse, P.lensSwellDamping, dtMs);
  // the dip: from the lens turning dark until it has settled
  const settling = !up && lift > 0.02 && lift < CLEAR_TO * 0.75;
  const [dip, vd] = spring(s.dip, s.vd, settling ? 1 : 0, DIP.response, DIP.damping, dtMs);
  return { x, vx, lift, vl, swell, vs, dip, vd };
}

/** Nothing left to animate: the loop driving the lens can stop. */
export function lensSettled(s: LensState, goal: number, input: LensInput): boolean {
  return !input.pressed && input.dragX === null && s.x !== null && Math.abs(s.x - goal) < 0.05 && Math.abs(s.vx) < 0.5
    && Math.abs(s.lift) < 0.002 && Math.abs(s.vl) < 0.01 && Math.abs(s.swell) < 0.0002 && Math.abs(s.vs) < 0.002
    && Math.abs(s.dip) < 0.002 && Math.abs(s.vd) < 0.01;
}

/** `lift` is how clear the lens looks (0 the dark capsule, 1 clear glass); `swell` the bar's scale. */
export type LensShape = { x: number; w: number; h: number; lift: number; swell: number };

/** The lens's size from its rest size (the selected tab's capsule), how lifted it is and how fast it moves. */
export function lensShape(s: LensState, restW: number, restH: number, P: LensParams): LensShape {
  const scale = 1 + (P.lensLift - 1) * Math.max(0, s.lift), sp = Math.min(1, Math.abs(s.vx) / FULL_SPEED);
  return {
    x: s.x ?? 0,
    w: restW * scale * (1 + P.lensStretch * sp),
    h: restH * scale * (1 - P.lensStretch * 0.25 * sp),
    lift: smoothstep(CLEAR_FROM, CLEAR_TO, s.lift),
    swell: 1 + s.swell - P.lensDip * s.dip,
  };
}
