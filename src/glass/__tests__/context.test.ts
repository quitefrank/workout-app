import { describe, expect, it } from "vitest";
import { blendSides, decideDark, lerpRgb, stepSide } from "../context";

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

  it("a key on only one side is skipped when the other side is chosen", () => {
    const o = blendSides({ onlyA: 1, light: 0.25 }, { light: 0.35 }, 0.7);
    expect("onlyA" in o).toBe(false);
    expect(blendSides({ onlyA: 1 }, {}, 0.2).onlyA).toBe(1);
  });
});
