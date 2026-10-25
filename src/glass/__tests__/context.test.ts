import { describe, expect, it } from "vitest";
import { averageUnder, blendSides, decideDark, lerpRgb, stepSide, unpadRows } from "../context";

describe("context rule", () => {
  it("first reading splits at 0.45", () => {
    expect(decideDark(null, 0.44)).toBe(true);
    expect(decideDark(null, 0.46)).toBe(false);
  });

  it("hysteresis: dark until 0.50, light until 0.40", () => {
    expect(decideDark(true, 0.48)).toBe(true);
    expect(decideDark(true, 0.5)).toBe(false);
    expect(decideDark(false, 0.42)).toBe(false);
    expect(decideDark(false, 0.39)).toBe(true);
  });

  it("the side moves linearly over the fade, jumping on the first frame", () => {
    expect(stepSide(null, 1, 16, 250)).toBe(1);
    expect(stepSide(0, 1, 125, 250)).toBeCloseTo(0.5);
    expect(stepSide(0.9, 1, 125, 250)).toBe(1);
    expect(stepSide(0.5, 0, 50, 250)).toBeCloseTo(0.3);
  });

  it("colours mix per channel on the 0xRRGGBB integers", () => {
    expect(lerpRgb(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(lerpRgb(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });

  it("numbers mix, blends and lens mode switch at 0.5", () => {
    const o = blendSides({ light: 0.25, fillBlend: 1, fillColor: 0xf8f8f8 }, { light: 0.35, fillBlend: 0, fillColor: 0x999999 }, 0.4);
    expect(o.light).toBeCloseTo(0.29);
    expect(o.fillBlend).toBe(1);
    expect(o.fillColor).toBe(lerpRgb(0xf8f8f8, 0x999999, 0.4));
  });

  it("the first reading at exactly 0.45 is light", () => {
    expect(decideDark(null, 0.45)).toBe(false);
  });

  it("lens mode and sRGB flags switch at 0.5", () => {
    expect(blendSides({ lensMode: 0, pillSrgb: 1 }, { lensMode: 1, pillSrgb: 0 }, 0.5)).toEqual({ lensMode: 1, pillSrgb: 0 });
  });

  it("readback rows lose their 256-byte padding and flip when asked", () => {
    // 2 x 2 texels: 8 bytes a row, padded to 256
    const padded = new Uint8Array(256 + 8);
    padded.set([1, 1, 1, 1, 2, 2, 2, 2], 0);
    padded.set([3, 3, 3, 3, 4, 4, 4, 4], 256);
    expect(Array.from(unpadRows(padded, 2, 2, false))).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4]);
    expect(Array.from(unpadRows(padded, 2, 2, true))).toEqual([3, 3, 3, 3, 4, 4, 4, 4, 1, 1, 1, 1, 2, 2, 2, 2]);
    // exactly 256 bytes a row: no padding
    const tight = new Uint8Array(256 * 2).map((_, i) => (i < 256 ? 5 : 6));
    expect(unpadRows(tight, 64, 2, false)[256]).toBe(6);
  });

  it("averages the grid cells a rect covers, clamped to the grid", () => {
    // 2 x 1 cells of 8px: black, white
    const grid = new Uint8ClampedArray([0, 0, 0, 255, 255, 255, 255, 255]);
    expect(averageUnder(grid, 2, 1, 8, { x0: 0, x1: 16, y0: 0, y1: 8 })).toBeCloseTo(0.5);
    expect(averageUnder(grid, 2, 1, 8, { x0: 9, x1: 40, y0: -5, y1: 3 })).toBeCloseTo(1);
    expect(averageUnder(grid, 2, 1, 8, { x0: 100, x1: 120, y0: 0, y1: 8 })).toBe(0.5);
    expect(averageUnder(null, 2, 1, 8, { x0: 0, x1: 16, y0: 0, y1: 8 })).toBe(0.5);
  });

  it("a key on only one side is skipped when the other side is chosen", () => {
    const o = blendSides({ onlyA: 1, light: 0.25 }, { light: 0.35 }, 0.7);
    expect("onlyA" in o).toBe(false);
    expect(blendSides({ onlyA: 1 }, {}, 0.2).onlyA).toBe(1);
  });
});
