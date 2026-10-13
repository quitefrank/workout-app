import { describe, expect, it } from "vitest";
import { gradientLine, parseBoxShadows, parseColor, parseLinearGradients, splitTopLevel } from "../paint/css";

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
});
