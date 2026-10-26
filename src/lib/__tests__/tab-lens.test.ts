import { describe, expect, it } from "vitest";
import { LENS, lensGoal, lensSettled, lensShape, nearestIndex, restingLens, rubberBand, spring, stepLens, type LensInput, type LensState } from "../tab-lens";

const idle: LensInput = { pressed: false, dragX: null };

/** Replay a tap the way the recording has it: the finger down for `press` ms, the lens sent `distance` px, 1 ms steps. */
function tap(distance = 86, press = 106, ms = 900) {
  let s = stepLens(restingLens(), 0, idle, LENS, 1, false);
  const frames: { t: number; s: LensState; p: number; scale: number; clear: number; swell: number }[] = [];
  for (let t = 0; t < ms; t++) {
    const input = { pressed: t < press, dragX: null };
    s = stepLens(s, distance, input, LENS, 1, false);
    const shape = lensShape(s, 100, 54, LENS);
    frames.push({ t, s, p: (s.x ?? 0) / distance, scale: shape.w / 100, clear: shape.lift, swell: shape.swell - 1 });
  }
  return frames;
}
const first = (f: ReturnType<typeof tap>, ok: (x: ReturnType<typeof tap>[number]) => boolean) => f.find(ok)?.t ?? Infinity;
const last = (f: ReturnType<typeof tap>, ok: (x: ReturnType<typeof tap>[number]) => boolean) => [...f].reverse().find(ok)?.t ?? -Infinity;

describe("spring", () => {
  it("comes to rest on its goal", () => {
    let x = 0, v = 0;
    for (let t = 0; t < 2000; t += 16) [x, v] = spring(x, v, 100, 0.32, 0.72, 16);
    expect(x).toBeCloseTo(100, 3);
    expect(v).toBeCloseTo(0, 2);
  });
  it("overshoots below critical damping and never at 1", () => {
    const peak = (damping: number) => { let x = 0, v = 0, p = 0; for (let t = 0; t < 2000; t += 16) { [x, v] = spring(x, v, 100, 0.32, damping, 16); p = Math.max(p, x); } return p; };
    expect(peak(0.72)).toBeGreaterThan(100.5);
    expect(peak(1)).toBeLessThanOrEqual(100.0001);
  });
  it("does not depend on how the frame time is split", () => {
    const a = spring(0, 0, 50, 0.3, 0.8, 32);
    let b: [number, number] = [0, 0];
    b = spring(b[0], b[1], 50, 0.3, 0.8, 16); b = spring(b[0], b[1], 50, 0.3, 0.8, 16);
    expect(a[0]).toBeCloseTo(b[0], 6);
  });
});

describe("rubberBand and nearestIndex", () => {
  it("leaves the span alone and compresses past its ends", () => {
    expect(rubberBand(10, -100, 100)).toBe(10);
    expect(rubberBand(136, -100, 100)).toBe(112);
    expect(rubberBand(-136, -100, 100)).toBe(-112);
  });
  it("picks the closest centre", () => {
    expect(nearestIndex([-120, -40, 40, 120], -90)).toBe(0);
    expect(nearestIndex([-120, -40, 40, 120], -70)).toBe(1);
    expect(nearestIndex([-120, -40, 40, 120], 75)).toBe(2);
    expect(nearestIndex([-120, -40, 40, 120], 500)).toBe(3);
  });
  it("heads for the selected tab, or the finger while it drags", () => {
    expect(lensGoal([-120, -40, 40, 120], 1, idle)).toBe(-40);
    expect(lensGoal([-120, -40, 40, 120], 1, { pressed: true, dragX: 60 })).toBe(60);
    expect(lensGoal([-120, -40, 40, 120], 1, { pressed: true, dragX: 220 })).toBe(140);
  });
});

// The recording, measured frame by frame (30 fps, so about one frame of slack on every time): docs/lab/glass-presets.md
describe("a one-tab tap matches the iOS 26 recording", () => {
  const f = tap();
  it("travels 50% by about 65 ms and 90% by about 150 ms, without overshooting", () => {
    expect(first(f, (x) => x.p >= 0.5)).toBeGreaterThan(50);
    expect(first(f, (x) => x.p >= 0.5)).toBeLessThan(80);
    expect(first(f, (x) => x.p >= 0.9)).toBeGreaterThan(130);
    expect(first(f, (x) => x.p >= 0.9)).toBeLessThan(170);
    expect(Math.max(...f.map((x) => x.p))).toBeLessThanOrEqual(1.0001);
  });
  it("swells the bar about 4.3% at about 110 ms and lets it go by about 240 ms", () => {
    const peak = f.reduce((a, b) => (b.swell > a.swell ? b : a));
    expect(peak.swell).toBeGreaterThan(0.04);
    expect(peak.swell).toBeLessThan(0.048);
    expect(peak.t).toBeGreaterThan(90);
    expect(peak.t).toBeLessThan(135);
    expect(last(f, (x) => x.swell > 0.002)).toBeLessThan(265);
  });
  it("dips the bar about 0.9% while the lens drops back, from about 300 to 470 ms", () => {
    const low = f.reduce((a, b) => (b.swell < a.swell ? b : a));
    expect(low.swell).toBeLessThan(-0.006);
    expect(low.swell).toBeGreaterThan(-0.012);
    expect(first(f, (x) => x.swell < -0.004)).toBeGreaterThan(260);
    expect(first(f, (x) => x.swell < -0.004)).toBeLessThan(330);
    expect(last(f, (x) => x.swell < -0.004)).toBeGreaterThan(400);
    expect(last(f, (x) => x.swell < -0.004)).toBeLessThan(490);
  });
  it("grows the lens to about 1.3x at 150 to 180 ms and back to rest by about 410 ms", () => {
    const peak = f.reduce((a, b) => (b.scale > a.scale ? b : a));
    expect(peak.scale).toBeGreaterThan(1.27);
    expect(peak.scale).toBeLessThan(1.36);
    expect(peak.t).toBeGreaterThan(140);
    expect(peak.t).toBeLessThan(205);
    for (const [t, want] of [[80, 1.23], [144, 1.3], [244, 1.2], [312, 1.06]] as const) expect(f[t].scale).toBeCloseTo(want, 1);
    expect(last(f, (x) => x.scale > 1.01)).toBeLessThan(440);
  });
  it("is clear glass from about 60 ms to about 280 ms", () => {
    expect(first(f, (x) => x.clear > 0.5)).toBeLessThan(80);
    expect(last(f, (x) => x.clear > 0.5)).toBeGreaterThan(250);
    expect(last(f, (x) => x.clear > 0.5)).toBeLessThan(310);
  });
  it("shows nothing moving after about 500 ms, and lets the frame loop stop soon after", () => {
    expect(last(f, (x) => x.scale > 1.005 || Math.abs(x.swell) > 0.0005 || x.p < 0.998)).toBeLessThan(510);
    expect(lensSettled(f[f.length - 1].s, 86, idle)).toBe(true);
    expect(last(f, (x) => !lensSettled(x.s, 86, idle))).toBeLessThan(700);
  });
});

describe("stepLens", () => {
  it("starts on its goal at rest", () => {
    expect(stepLens(restingLens(), -40, idle, LENS, 16, false)).toEqual({ ...restingLens(), x: -40 });
  });
  it("lifts and swells while pressed, even without moving", () => {
    let s = stepLens(restingLens(), 0, idle, LENS, 16, false);
    for (let t = 0; t < 600; t += 16) s = stepLens(s, 0, { pressed: true, dragX: null }, LENS, 16, false);
    expect(s.lift).toBeGreaterThan(0.98);
    expect(s.swell).toBeCloseTo(LENS.lensSwell, 3);
    expect(s.x).toBe(0);
  });
  it("follows a drag closely and stays lifted", () => {
    const drag = { pressed: true, dragX: 80 };
    let s = stepLens(restingLens(), -120, idle, LENS, 16, false);
    for (let t = 0; t < 400; t += 16) s = stepLens(s, 80, drag, LENS, 16, false);
    expect(s.x).toBeCloseTo(80, 0);
    expect(s.lift).toBeGreaterThan(0.95);
    expect(lensSettled(s, 80, drag)).toBe(false);
  });
  it("jumps without lifting, swelling or dipping under reduced motion", () => {
    const s = stepLens({ ...restingLens(), x: -120 }, 40, { pressed: true, dragX: null }, LENS, 16, true);
    expect(s).toEqual({ ...restingLens(), x: 40 });
  });
});

describe("lensShape", () => {
  it("is the capsule at rest", () => {
    expect(lensShape({ ...restingLens(), x: 10 }, 90, 54, LENS)).toEqual({ x: 10, w: 90, h: 54, lift: 0, swell: 1 });
  });
  it("scales both ways with the lift and turns clear on a steep curve", () => {
    const lifted = lensShape({ ...restingLens(), x: 0, lift: 1 }, 90, 54, LENS);
    expect(lifted.w / 90).toBeCloseTo(LENS.lensLift);
    expect(lifted.h / 54).toBeCloseTo(LENS.lensLift);
    expect(lifted.lift).toBe(1);
    expect(lensShape({ ...restingLens(), x: 0, lift: 0.15 }, 90, 54, LENS).lift).toBe(0);
    expect(lensShape({ ...restingLens(), x: 0, lift: 0.45 }, 90, 54, LENS).lift).toBe(1);
  });
  it("does not stretch with speed at the measured setting", () => {
    const fast = lensShape({ ...restingLens(), x: 0, vx: 2000, lift: 1 }, 90, 54, LENS);
    expect(fast.w / 90).toBeCloseTo(LENS.lensLift);
  });
  it("carries the swell and the dip on the bar's scale", () => {
    expect(lensShape({ ...restingLens(), x: 0, swell: 0.04, dip: 1 }, 90, 54, LENS).swell).toBeCloseTo(1 + 0.04 - LENS.lensDip);
  });
});
