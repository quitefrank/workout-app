import { describe, expect, it } from "vitest";
import { PUSH, pushesFor, pushLayers, pushProgress } from "../page-push";

describe("pushProgress", () => {
  it("runs from 0 to 1 without overshoot", () => {
    let last = 0;
    for (let ms = 0; ms <= PUSH.durationMs; ms += 10) {
      const p = pushProgress(ms);
      expect(p).toBeGreaterThanOrEqual(last);
      expect(p).toBeLessThanOrEqual(1);
      last = p;
    }
    expect(pushProgress(0)).toBe(0);
    expect(pushProgress(PUSH.durationMs)).toBe(1);
  });

  it("has all but arrived by the end of its response", () => {
    expect(pushProgress(500)).toBeGreaterThan(0.98);
    expect(pushProgress(250)).toBeGreaterThan(0.8);
  });
});

describe("pushLayers", () => {
  const W = 400;

  it("going forward, the new page comes in from the right over the old, which drifts 30% left", () => {
    expect(pushLayers("forward", 0, W)).toEqual({ topX: W, underX: -0, topIsNew: true, dim: 0 });
    const end = pushLayers("forward", 1, W);
    expect(end.topX).toBe(0);
    expect(end.underX).toBeCloseTo(-120);
    expect(end.dim).toBeCloseTo(PUSH.dim);
  });

  it("going back, the page you leave slides out right and the one under comes back from 30% left", () => {
    const start = pushLayers("back", 0, W);
    expect(start.topX).toBe(0);
    expect(start.underX).toBeCloseTo(-120);
    expect(start.topIsNew).toBe(false);
    expect(start.dim).toBeCloseTo(PUSH.dim);
    expect(pushLayers("back", 1, W)).toEqual({ topX: W, underX: -0, topIsNew: false, dim: 0 });
  });

  it("back is forward played in reverse", () => {
    for (const p of [0, 0.25, 0.5, 0.9]) {
      const f = pushLayers("forward", p, W), b = pushLayers("back", 1 - p, W);
      expect(b.topX).toBeCloseTo(f.topX);
      expect(b.underX).toBeCloseTo(f.underX);
    }
  });
});

describe("pushesFor", () => {
  const here = { origin: "https://app.test", pathname: "/templates" };
  const click = { button: 0, metaKey: false, ctrlKey: false, shiftKey: false, altKey: false };
  const link = (href: string, extra: Partial<{ target: string; download: boolean }> = {}) => ({ href, target: "", download: false, ...extra });

  it("pushes for a plain tap on a link to another page of the app", () => {
    expect(pushesFor(link("/templates/abc"), click, here)).toBe(true);
    expect(pushesFor(link("https://app.test/programs/1"), click, here)).toBe(true);
  });

  it("does not push for the same page with another query, another site, a new tab or a modified click", () => {
    expect(pushesFor(link("/templates?d=2026-11-10"), click, here)).toBe(false);
    expect(pushesFor(link("https://youtube.com/x"), click, here)).toBe(false);
    expect(pushesFor(link("/programs/1", { target: "_blank" }), click, here)).toBe(false);
    expect(pushesFor(link("/programs/1", { download: true }), click, here)).toBe(false);
    expect(pushesFor(link("/programs/1"), { ...click, metaKey: true }, here)).toBe(false);
    expect(pushesFor(link("/programs/1"), { ...click, button: 1 }, here)).toBe(false);
  });
});
