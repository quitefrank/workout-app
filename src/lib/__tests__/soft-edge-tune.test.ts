import { describe, expect, it } from "vitest";
import { parseTune, TUNE_DEFAULTS, tuneSource, tuneVars } from "../soft-edge-tune";

describe("Start Workout edge tuning", () => {
  it("defaults to Frank's spec: 40pt above the button, a 10pt blur, and a gradient from 25% at the bottom", () => {
    expect(TUNE_DEFAULTS).toEqual({ reach: 40, blur: 10, grad: 25 });
  });

  it("reads back stored values, clamped, with junk and old keys falling back to the defaults", () => {
    expect(parseTune(null)).toEqual(TUNE_DEFAULTS);
    expect(parseTune("not json")).toEqual(TUNE_DEFAULTS);
    expect(parseTune(JSON.stringify({ grad: 140, blur: "x", gradFrom: 60 }))).toEqual({ reach: 40, blur: 10, grad: 100 });
  });

  it("turns values into the edge's custom properties and the source's shape", () => {
    expect(tuneVars({ reach: 60, blur: 12, grad: 35 })).toEqual({ "--se-reach": "60px", "--se-blur": "12px", "--se-grad": 0.35 });
    expect(tuneSource({ reach: 60, blur: 12, grad: 35 })).toBe("// Start Workout's soft edge, tuned on the phone\nreach: 60, // pt above the button\nblur: 12,\ngradient: 0.35,");
  });
});
