import { describe, expect, it } from "vitest";
import { LENS, lensGoal, lensSettled, lensShape, nearestIndex, restingLens, rubberBand, spring, stepLens, type LensInput, type LensState } from "../tab-lens";

const idle: LensInput = { pressed: false, dragX: null };
const run = (s: LensState, goal: number, input = idle, ms = 1000) => {
  let peak = -Infinity;
  for (let t = 0; t < ms; t += 16) { s = stepLens(s, goal, input, LENS, 16, false); peak = Math.max(peak, s.x ?? 0); }
  return { s, peak };
};

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

describe("stepLens", () => {
  it("starts on its goal at rest", () => {
    expect(stepLens(restingLens(), -40, idle, LENS, 16, false)).toEqual({ x: -40, vx: 0, lift: 0, vl: 0 });
  });
  it("lifts while pressed, even without moving", () => {
    let s = stepLens(restingLens(), 0, idle, LENS, 16, false);
    for (let t = 0; t < 300; t += 16) s = stepLens(s, 0, { pressed: true, dragX: null }, LENS, 16, false);
    expect(s.lift).toBeGreaterThan(0.95);
    expect(s.x).toBe(0);
  });
  it("lifts to travel, arrives with a small overshoot, and settles back into the capsule", () => {
    const start = stepLens(restingLens(), -120, idle, LENS, 16, false);
    const mid = run(start, 40, idle, 100).s;
    expect(mid.lift).toBeGreaterThan(0.5);
    const { s, peak } = run(start, 40, idle, 1500);
    expect(peak).toBeGreaterThan(40.5);
    expect(peak).toBeLessThan(60);
    expect(s.x).toBeCloseTo(40, 1);
    expect(lensSettled(s, 40, idle)).toBe(true);
  });
  it("follows a drag closely and stays lifted", () => {
    const drag = { pressed: true, dragX: 80 };
    const { s } = run(stepLens(restingLens(), -120, idle, LENS, 16, false), 80, drag, 400);
    expect(s.x).toBeCloseTo(80, 0);
    expect(s.lift).toBeGreaterThan(0.95);
    expect(lensSettled(s, 80, drag)).toBe(false);
  });
  it("jumps without lifting under reduced motion", () => {
    const s = stepLens({ x: -120, vx: 0, lift: 0, vl: 0 }, 40, { pressed: true, dragX: null }, LENS, 16, true);
    expect(s).toEqual({ x: 40, vx: 0, lift: 0, vl: 0 });
  });
});

describe("lensShape", () => {
  it("is the capsule at rest", () => {
    expect(lensShape({ x: 10, vx: 0, lift: 0, vl: 0 }, 90, 54, LENS)).toEqual({ x: 10, w: 90, h: 54, lift: 0, swell: 1 });
  });
  it("grows and swells the bar when lifted, and stretches with speed", () => {
    const lifted = lensShape({ x: 0, vx: 0, lift: 1, vl: 0 }, 90, 54, LENS);
    expect(lifted.w).toBeCloseTo(108);
    expect(lifted.h).toBeCloseTo(54 * 1.12);
    expect(lifted.swell).toBeCloseTo(1.035);
    const fast = lensShape({ x: 0, vx: 2000, lift: 1, vl: 0 }, 90, 54, LENS);
    expect(fast.w).toBeCloseTo(108 * 1.3);
    expect(fast.h).toBeLessThan(lifted.h);
  });
  it("clamps an overshooting lift for the optics but lets the size follow it", () => {
    const s = lensShape({ x: 0, vx: 0, lift: 1.1, vl: 0 }, 90, 54, LENS);
    expect(s.lift).toBe(1);
    expect(s.w).toBeGreaterThan(108);
  });
});
