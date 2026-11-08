import { describe, expect, it } from "vitest";
import { HERO_COLLAPSED_H, HERO_EXPANDED_H, HERO_RANGE, heroLayout, heroPose, heroSettleTarget, springSettled, springStep } from "../sheet-hero";

describe("heroPose", () => {
  it("opens on the large image with the large title showing", () => {
    const p = heroPose(0, 402, true);
    expect(p.t).toBe(0);
    expect(p.image).toEqual({ x: 16, y: 20, w: 370, h: 232, r: 22 });
    expect(p.largeOpacity).toBe(1);
    expect(p.smallOpacity).toBe(0);
    expect(p.backdrop).toBe(HERO_EXPANDED_H);
  });

  it("ends on the Activity View thumbnail, the header 96pt tall", () => {
    const p = heroPose(HERO_RANGE + 200, 402, true);
    expect(p.t).toBe(1);
    expect(p.image).toEqual(heroLayout(402).collapsed);
    expect(p.largeOpacity).toBe(0);
    expect(p.smallOpacity).toBe(1);
    expect(p.backdrop).toBe(HERO_COLLAPSED_H);
  });

  it("fades the large title out by 35% and the small one in from 60%", () => {
    expect(heroPose(HERO_RANGE * 0.35, 402, true).largeOpacity).toBeCloseTo(0);
    expect(heroPose(HERO_RANGE * 0.6, 402, true).smallOpacity).toBeCloseTo(0);
    expect(heroPose(HERO_RANGE * 0.8, 402, true).smallOpacity).toBeCloseTo(0.5);
  });

  it("moves the large title up with the content", () => {
    expect(heroPose(0, 402, true).largeTitleY - heroPose(50, 402, true).largeTitleY).toBe(50);
  });

  it("never shrinks a sheet below the large detent", () => {
    const p = heroPose(120, 390, false);
    expect(p.t).toBe(0);
    expect(p.image.r).toBe(18);
  });

  it("keeps the close button in one place", () => {
    expect(heroLayout(402).close).toEqual({ x: 342, y: 20 });
  });
});

describe("heroSettleTarget", () => {
  it("settles to the nearer end and leaves an end alone", () => {
    expect(heroSettleTarget(0)).toBeNull();
    expect(heroSettleTarget(HERO_RANGE)).toBeNull();
    expect(heroSettleTarget(HERO_RANGE + 40)).toBeNull();
    expect(heroSettleTarget(HERO_RANGE * 0.3)).toBe(0);
    expect(heroSettleTarget(HERO_RANGE * 0.7)).toBe(HERO_RANGE);
  });
});

describe("springStep", () => {
  it("comes to rest within a second without overshoot at bounce 0", () => {
    let s = { x: 100, v: 0 };
    let t = 0;
    let lowest = Infinity;
    while (!springSettled(s, 100, 0) && t < 2) {
      s = springStep(s, 0, 1 / 60);
      lowest = Math.min(lowest, s.x);
      t += 1 / 60;
    }
    expect(t).toBeLessThan(1);
    expect(lowest).toBeGreaterThan(-0.5);
  });
});
