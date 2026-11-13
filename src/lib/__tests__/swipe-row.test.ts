import { describe, expect, it } from "vitest";
import { buttonWidth, elasticReveal, expansionTarget, isElastic, release, responseFor, shouldExpand, snapSpring, SWIPE } from "../swipe-row";
import { spring } from "../tab-lens";

const W = 375; // a row as wide as the screen
const B = 74;

describe("buttonWidth", () => {
  it("is at least 74pt, else the title padded 8pt each side", () => {
    expect(buttonWidth(50)).toBe(74);
    expect(buttonWidth(70)).toBe(86);
  });
});

describe("elasticReveal", () => {
  it("follows the finger 1:1 up to 30pt short of the row's width", () => {
    expect(expansionTarget(W, B)).toBe(345);
    expect(elasticReveal(200, W, B)).toBe(200);
    expect(elasticReveal(345, W, B)).toBe(345);
  });
  it("moves at 20% past the target and when dragged the other way", () => {
    expect(elasticReveal(395, W, B)).toBe(355);
    expect(elasticReveal(-50, W, B)).toBe(-10);
    expect(isElastic(-1, W, B)).toBe(true);
    expect(isElastic(100, W, B)).toBe(false);
  });
  it("keeps the target at least 20pt past the button on a narrow row", () => {
    expect(expansionTarget(100, B)).toBe(94);
  });
});

describe("shouldExpand", () => {
  it("never arms before the button is fully out or within 8pt of travel", () => {
    expect(shouldExpand(74, 300, 360, W, B)).toBe(false);
    expect(shouldExpand(200, 8, 360, W, B)).toBe(false);
  });
  it("arms past the target", () => {
    expect(shouldExpand(346, 346, 100, W, B)).toBe(true);
  });
  it("arms with the finger past 80% of the row from its trailing edge", () => {
    expect(shouldExpand(200, 200, 0.81 * W, W, B)).toBe(true);
    expect(shouldExpand(200, 200, 0.79 * W, W, B)).toBe(false);
  });
});

describe("release", () => {
  it("deletes on a full swipe, closes when moving back, otherwise opens", () => {
    expect(release(true, -500)).toBe("delete");
    expect(release(false, -1)).toBe("close");
    expect(release(false, 0)).toBe("open");
    expect(release(false, 300)).toBe("open");
  });
});

describe("springs", () => {
  it("the release spring is UIKit's mass 1, stiffness 100, damping 18", () => {
    const s = snapSpring();
    expect(s.damping).toBeCloseTo(0.9, 6);
    expect(s.response).toBeCloseTo((2 * Math.PI) / 10, 6);
  });
  it("a critically damped spring sized to 0.7s is within 0.1% at 0.7s and not before 0.5s", () => {
    const r = responseFor(SWIPE.settleSeconds);
    let x = 0, v = 0, t = 0, firstClose = -1;
    for (; t <= 700; t += 1) {
      [x, v] = spring(x, v, 100, r, 1, 1);
      if (firstClose < 0 && Math.abs(100 - x) < 0.11) firstClose = t;
    }
    expect(Math.abs(100 - x)).toBeLessThan(0.11);
    expect(firstClose).toBeGreaterThan(500);
  });
});
