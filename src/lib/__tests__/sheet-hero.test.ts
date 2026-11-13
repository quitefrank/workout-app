import { describe, expect, it } from "vitest";
import { HERO_BACK, HERO_COLLAPSED_H, HERO_EXPANDED_H, HERO_RANGE, heroLayout, heroPose, heroSettleTarget, springSettled, springStep } from "../sheet-hero";

describe("heroPose", () => {
  it("opens on the large image with the large title showing", () => {
    const p = heroPose(0, 402, true);
    expect(p.t).toBe(0);
    expect(p.image).toEqual({ x: 16, y: 70, w: 370, h: 232, r: 22 });
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

  it("opens with the image below the close button, where other sheets' content starts", () => {
    const close = heroLayout(402).close;
    expect(heroPose(0, 402, true).image.y).toBeGreaterThanOrEqual(close.y + 44);
    expect(heroPose(0, 390, false).image.y).toBe(70);
  });

  it("keeps the close button in one place", () => {
    expect(heroLayout(402).close).toEqual({ x: 342, y: 20 });
    expect(heroLayout(402, true).close).toEqual(heroLayout(402).close);
  });
});

describe("heroLayout with Back", () => {
  it("has no Back button at the exercise the sheet opened on", () => {
    expect(heroLayout(402).back).toBeNull();
  });

  it("puts Back at the top left, in the close button's row", () => {
    const l = heroLayout(402, true);
    expect(l.back).toEqual({ x: 16, y: l.close.y });
  });

  it("moves the collapsed thumbnail and small title right by the button and a 12pt gap", () => {
    const plain = heroLayout(402);
    const l = heroLayout(402, true);
    expect(l.collapsed.x).toBe(HERO_BACK.x + HERO_BACK.size + HERO_BACK.gap);
    expect(l.collapsed.x).toBe(72);
    expect(l.small.x - l.collapsed.x).toBe(plain.small.x - plain.collapsed.x);
    expect(l.small.x + l.small.w).toBe(plain.small.x + plain.small.w);
    expect(l.collapsed.y).toBe(plain.collapsed.y);
  });

  it("collapses onto the moved thumbnail and leaves the large image where it was", () => {
    expect(heroPose(HERO_RANGE, 402, true, true).image).toEqual(heroLayout(402, true).collapsed);
    expect(heroPose(0, 402, true, true).image).toEqual(heroPose(0, 402, true).image);
  });

  it("keeps the large image clear of Back", () => {
    expect(heroPose(0, 402, true, true).image.y).toBeGreaterThanOrEqual(HERO_BACK.y + HERO_BACK.size);
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
