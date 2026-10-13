import { afterEach, describe, expect, it } from "vitest";
import { gradientLine, parseBoxShadows, parseColor, parseLinearGradients, parseLinearTransform, resolveStops, setColorResolver, splitTopLevel } from "../paint/css";

describe("computed CSS parsers", () => {
  it("splits on top-level commas only", () => {
    expect(splitTopLevel("linear-gradient(red, blue), linear-gradient(rgb(1, 2, 3), green)")).toEqual([
      "linear-gradient(red, blue)",
      "linear-gradient(rgb(1, 2, 3), green)",
    ]);
  });

  it("parses rgb and rgba", () => {
    expect(parseColor("rgb(255, 0, 10)")).toEqual([255, 0, 10, 1]);
    expect(parseColor("rgba(0, 0, 0, 0.3)")).toEqual([0, 0, 0, 0.3]);
    expect(parseColor("rgb(0 0 0 / 55%)")).toEqual([0, 0, 0, 0.55]);
    expect(parseColor("transparent")).toEqual([0, 0, 0, 0]);
  });

  it("parses a gradient with an angle and plain stops", () => {
    const [g] = parseLinearGradients("linear-gradient(160deg, rgb(201, 89, 50), rgb(81, 18, 9))");
    expect(g.angle).toBe(160);
    expect(g.stops).toEqual([
      { color: "rgb(201, 89, 50)", pos: 0 },
      { color: "rgb(81, 18, 9)", pos: 1 },
    ]);
  });

  it("defaults to bottom, reads side keywords and percentage stops, fills missing positions", () => {
    const [g] = parseLinearGradients("linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.6))");
    expect(g.angle).toBe(180);
    expect(g.stops.map((s) => s.pos)).toEqual([0, 0.25, 0.45, 1]);
    const [h] = parseLinearGradients("linear-gradient(to right, rgb(0, 0, 0), rgb(1, 1, 1))");
    expect(h.angle).toBe(90);
  });

  it("ignores non-gradient layers", () => {
    expect(parseLinearGradients("none")).toEqual([]);
    expect(parseLinearGradients('url("a.png")')).toEqual([]);
  });

  it("gradient line follows the CSS spec", () => {
    const l = gradientLine(180, 100, 50);
    expect(l).toEqual({ x0: 50, y0: 0, x1: 50, y1: 50 });
    const d = gradientLine(90, 100, 50);
    expect(d.x0).toBeCloseTo(0);
    expect(d.x1).toBeCloseTo(100);
  });

  it("parses box shadows, inset and outer", () => {
    expect(parseBoxShadows("rgba(60, 60, 67, 0.29) 0px 0.5px 0px 0px inset")).toEqual([
      { color: "rgba(60, 60, 67, 0.29)", x: 0, y: 0.5, blur: 0, spread: 0, inset: true },
    ]);
    expect(parseBoxShadows("rgba(0, 0, 0, 0.12) 0px 3px 8px 0px, rgba(0, 0, 0, 0.04) 0px 3px 1px 0px")).toHaveLength(2);
    expect(parseBoxShadows("none")).toEqual([]);
  });

  describe("real-world computed values", () => {
    afterEach(() => setColorResolver(null));

    it("parses color(srgb) directly, without a canvas", () => {
      expect(parseColor("color(srgb 0 0 0 / 0.5)")).toEqual([0, 0, 0, 0.5]);
      expect(parseColor("color(srgb 1 0 1)")).toEqual([255, 0, 255, 1]);
    });

    it("resolves other colour spaces through the injected resolver and caches them", () => {
      let calls = 0;
      setColorResolver((c) => { calls++; return c.startsWith("oklab(") ? [0, 0, 0, 0.2] : null; });
      expect(parseColor("oklab(0 0 0 / 0.2)")).toEqual([0, 0, 0, 0.2]);
      expect(parseColor("oklab(0 0 0 / 0.2)")).toEqual([0, 0, 0, 0.2]);
      expect(calls).toBe(1);
      expect(parseColor("nonsense")).toBeNull();
    });

    it("returns null for unknown colours when no canvas exists (jsdom)", () => {
      expect(parseColor("oklch(0.7 0.1 30)")).toBeNull();
    });

    it("keeps the rgb space-separated alpha form as a stop colour", () => {
      const [g] = parseLinearGradients("linear-gradient(rgb(0 0 0 / 0.889), rgb(0 0 0 / 0) 50%)");
      expect(g.stops).toEqual([
        { color: "rgb(0 0 0 / 0.889)", pos: 0 },
        { color: "rgb(0 0 0 / 0)", pos: 0.5 },
      ]);
    });

    it("reads px stops and resolves them against the line length", () => {
      const [g] = parseLinearGradients("linear-gradient(rgb(0, 0, 0) 10px, rgb(1, 1, 1))");
      expect(g.stops[0].posPx).toBe(10);
      expect(resolveStops(g.stops, 200)).toEqual([
        { color: "rgb(0, 0, 0)", pos: 0.05 },
        { color: "rgb(1, 1, 1)", pos: 1 },
      ]);
    });

    it("resolves a px stop between percentage stops and fills the gap", () => {
      const [g] = parseLinearGradients("linear-gradient(red 0%, blue, green 50px, black 100%)");
      expect(resolveStops(g.stops, 100).map((s) => s.pos)).toEqual([0, 0.25, 0.5, 1]);
    });

    it("clamps stops non-decreasing", () => {
      const [g] = parseLinearGradients("linear-gradient(red 60%, blue 30%)");
      expect(resolveStops(g.stops, 100).map((s) => s.pos)).toEqual([0.6, 0.6]);
    });

    it("makes known positions non-decreasing before filling gaps", () => {
      const [g] = parseLinearGradients("linear-gradient(red 50%, blue 20%, green, black 100%)");
      expect(resolveStops(g.stops, 100).map((s) => s.pos)).toEqual([0.5, 0.5, 0.75, 1]);
    });

    it("treats a non-finite position (calc) as unpositioned", () => {
      const [g] = parseLinearGradients("linear-gradient(red, blue calc(10% + 5px), green)");
      expect(resolveStops(g.stops, 100).map((s) => s.pos)).toEqual([0, 0.5, 1]);
      expect(resolveStops([{ color: "red", pos: 0 }, { color: "blue", pos: 0, posPx: NaN }, { color: "green", pos: 1 }], 100).map((s) => s.pos)).toEqual([0, 0.5, 1]);
    });

    it("clears the colour cache once it passes 1000 entries", () => {
      let calls = 0;
      setColorResolver(() => { calls++; return [0, 0, 0, 1]; });
      for (let i = 0; i <= 1000; i++) parseColor(`oklab(0 0 ${i})`);
      expect(calls).toBe(1001);
      parseColor("oklab(0 0 1000)");
      expect(calls).toBe(1001);
      parseColor("oklab(0 0 0)");
      expect(calls).toBe(1002);
    });

    it("strips interpolation clauses", () => {
      expect(parseLinearGradients("linear-gradient(to right in oklab, rgb(0, 0, 0), rgb(1, 1, 1))")[0].angle).toBe(90);
      expect(parseLinearGradients("linear-gradient(160deg in oklab, rgb(0, 0, 0), rgb(1, 1, 1))")[0].angle).toBe(160);
      const [g] = parseLinearGradients("linear-gradient(in oklab, rgb(0, 0, 0), rgb(1, 1, 1))");
      expect(g.angle).toBe(180);
      expect(g.stops).toHaveLength(2);
      expect(parseLinearGradients("linear-gradient(in oklch longer hue, red, blue)")[0].stops).toHaveLength(2);
    });

    it("expands a two-position stop and skips a bare hint", () => {
      const [g] = parseLinearGradients("linear-gradient(red, rgba(0, 0, 0, 0) 25% 45%, 70%, blue)");
      expect(g.stops.map((s) => s.pos)).toEqual([0, 0.25, 0.45, 1]);
      expect(g.stops.map((s) => s.color)).toEqual(["red", "rgba(0, 0, 0, 0)", "rgba(0, 0, 0, 0)", "blue"]);
    });

    it("keeps an oklab shadow colour", () => {
      expect(parseBoxShadows("oklab(0 0 0 / 0.2) 0px 4px 8px 0px")).toEqual([
        { color: "oklab(0 0 0 / 0.2)", x: 0, y: 4, blur: 8, spread: 0, inset: false },
      ]);
      expect(parseBoxShadows("0px 4px 8px 0px inset color(srgb 0 0 0 / 0.5)")[0]).toMatchObject({ color: "color(srgb 0 0 0 / 0.5)", inset: true, blur: 8 });
    });
  });

  it("combines rotate, scale and transform into one 2x2 matrix", () => {
    const close = (m: number[] | null) => m && m.map((v) => Math.round(v * 1e6) / 1e6 + 0);
    expect(parseLinearTransform("none", "none", "none")).toBeNull();
    expect(close(parseLinearTransform("180deg", "none", "none"))).toEqual([-1, 0, 0, -1]);
    expect(close(parseLinearTransform("z 0.25turn", "none", "none"))).toEqual([0, 1, -1, 0]);
    expect(close(parseLinearTransform("none", "2 0.5", "none"))).toEqual([2, 0, 0, 0.5]);
    expect(close(parseLinearTransform("none", "150%", "none"))).toEqual([1.5, 0, 0, 1.5]);
    expect(close(parseLinearTransform("none", "none", "matrix(0, 1, -1, 0, 5, 5)"))).toEqual([0, 1, -1, 0]);
    expect(close(parseLinearTransform("none", "none", "matrix3d(2, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1)"))).toEqual([2, 0, 0, 3]);
    // a point is stretched 2x horizontally first, then turned 90deg: (1, 0) goes to (0, 2)
    expect(close(parseLinearTransform("90deg", "2 1", "none"))).toEqual([0, 2, -1, 0]);
    // a pure translate leaves the linear part alone; a turn about the x axis is ignored
    expect(parseLinearTransform("none", "none", "matrix(1, 0, 0, 1, 10, 0)")).toBeNull();
    expect(parseLinearTransform("x 45deg", "none", "none")).toBeNull();
  });
});
