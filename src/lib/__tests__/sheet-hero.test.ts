import { describe, expect, it } from "vitest";
import {
  HERO_COLLAPSED_H,
  HERO_SHRINK_END,
  HERO_SLIDE_END,
  heroLayout,
  heroMetrics,
  heroPose,
  heroSettleTarget,
  parseHeroMode,
  springSettled,
  springStep,
  type HeroMode,
} from "../sheet-hero";

const W = 402;

describe("heroPose: fade (the old motion)", () => {
  const m = heroMetrics("fade");

  it("opens on the large image at 70pt with the large title showing", () => {
    const p = heroPose(0, W, true, "fade");
    expect(p.t).toBe(0);
    expect(p.image).toEqual({ x: 16, y: 70, w: 370, h: 232, r: 22 });
    expect(p.largeOpacity).toBe(1);
    expect(p.smallOpacity).toBe(0);
    expect(p.backdrop).toBe(m.expandedH);
  });

  it("ends on the Activity View thumbnail, the header 96pt tall", () => {
    const p = heroPose(m.range + 200, W, true, "fade");
    expect(p.t).toBe(1);
    expect(p.image).toEqual(heroLayout(W).collapsed);
    expect(p.largeOpacity).toBe(0);
    expect(p.smallOpacity).toBe(1);
    expect(p.titleX).toBe(100);
    expect(p.backdrop).toBe(HERO_COLLAPSED_H);
  });

  it("fades the large title out by 35% and the small one in from 60%", () => {
    expect(heroPose(m.range * 0.35, W, true, "fade").largeOpacity).toBeCloseTo(0);
    expect(heroPose(m.range * 0.6, W, true, "fade").smallOpacity).toBeCloseTo(0);
    expect(heroPose(m.range * 0.8, W, true, "fade").smallOpacity).toBeCloseTo(0.5);
  });

  it("moves the large title up with the content", () => {
    expect(heroPose(0, W, true, "fade").largeTitleY - heroPose(50, W, true, "fade").largeTitleY).toBe(50);
  });
});

describe("heroPose: push and center", () => {
  const text = { title: 130, sub: 80 };

  it("open with the image 8pt under the subtitle line and the small titles showing", () => {
    for (const mode of ["push", "center"] as const) {
      const p = heroPose(0, W, true, mode, text);
      expect(p.image).toEqual({ x: 16, y: 52 + 18 + 8, w: 370, h: 232, r: 22 });
      expect(p.largeOpacity).toBe(0);
      expect(p.smallOpacity).toBe(1);
    }
  });

  it("push starts the titles at the sheet's inset; center centres each line on its own width", () => {
    const push = heroPose(0, W, true, "push", text);
    expect(push.titleX).toBe(16);
    expect(push.subX).toBe(16);
    const center = heroPose(0, W, true, "center", text);
    expect(center.titleX).toBe((W - 130) / 2);
    expect(center.subX).toBe((W - 80) / 2);
  });

  it("center never starts a line past the inset when it is too wide", () => {
    expect(heroPose(0, W, true, "center", { title: 500, sub: 80 }).titleX).toBe(16);
  });

  it("shrink under the row, slide the titles to 100, then raise the thumbnail", () => {
    for (const mode of ["push", "center"] as const) {
      const range = heroMetrics(mode).range;
      const shrunk = heroPose(range * HERO_SHRINK_END, W, true, mode, text);
      expect(shrunk.image).toEqual({ ...heroLayout(W).collapsed, y: 78 });
      const slid = heroPose(range * HERO_SLIDE_END, W, true, mode, text);
      expect(slid.titleX).toBeCloseTo(100);
      expect(slid.subX).toBeCloseTo(100);
      expect(slid.image.y).toBeCloseTo(78);
      const end = heroPose(range, W, true, mode, text);
      expect(end.image).toEqual(heroLayout(W).collapsed);
      expect(end.backdrop).toBe(HERO_COLLAPSED_H);
    }
  });

  it("never let the image overlap the titles", () => {
    for (const mode of ["push", "center"] as const) {
      const range = heroMetrics(mode).range;
      for (let i = 0; i <= 200; i++) {
        const p = heroPose((range * i) / 200, W, true, mode, text);
        if (p.image.y < 52 + 18) expect(p.image.x + p.image.w).toBeLessThanOrEqual(Math.min(p.titleX, p.subX));
      }
    }
  });

  it("keep the titles' trailing edge 12pt before the close button", () => {
    const p = heroPose(heroMetrics("push").range * 0.78, W, true, "push", text);
    expect(p.titleX + p.titleW).toBe(W - 16 - 44 - 12);
  });
});

describe("heroPose: every mode", () => {
  it("opens with the image below the close button and never shrinks below the large detent", () => {
    const close = heroLayout(W).close;
    for (const mode of ["fade", "push", "center"] as HeroMode[]) {
      expect(heroPose(0, W, true, mode).image.y).toBeGreaterThanOrEqual(close.y + 44);
      const p = heroPose(120, 390, false, mode);
      expect(p.t).toBe(0);
      expect(p.image.r).toBe(18);
    }
  });

  it("keeps the close button in one place", () => {
    expect(heroLayout(W).close).toEqual({ x: 342, y: 20 });
  });
});

describe("heroSettleTarget", () => {
  it("settles to the nearer end and leaves an end alone", () => {
    for (const mode of ["fade", "push"] as HeroMode[]) {
      const range = heroMetrics(mode).range;
      expect(heroSettleTarget(0, mode)).toBeNull();
      expect(heroSettleTarget(range, mode)).toBeNull();
      expect(heroSettleTarget(range + 40, mode)).toBeNull();
      expect(heroSettleTarget(range * 0.3, mode)).toBe(0);
      expect(heroSettleTarget(range * 0.7, mode)).toBe(range);
    }
  });
});

describe("parseHeroMode", () => {
  it("reads a saved mode and falls back to fade", () => {
    expect(parseHeroMode("push")).toBe("push");
    expect(parseHeroMode("center")).toBe("center");
    expect(parseHeroMode(null)).toBe("fade");
    expect(parseHeroMode("nonsense")).toBe("fade");
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
