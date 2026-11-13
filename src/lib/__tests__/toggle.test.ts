import { describe, expect, it } from "vitest";
import { knobBox, TOGGLE } from "../toggle";

// expected boxes are the kit's own variants (Toggle - Switch, 29:56814)
describe("knobBox", () => {
  it("rests 2pt in from the leading edge when off", () => {
    expect(knobBox(false, false)).toEqual({ left: 2, top: 2, width: 38, height: 24 });
  });

  it("rests 2pt in from the trailing edge when on", () => {
    expect(knobBox(true, false)).toEqual({ left: 24, top: 2, width: 38, height: 24 });
  });

  it("grows to the kit's pressed glass, off: x -8, y -5, 58 x 38", () => {
    expect(knobBox(false, true)).toEqual({ left: -8, top: -5, width: 58, height: 38 });
  });

  it("grows to the kit's pressed glass, on: x 14, y -5, 58 x 38", () => {
    expect(knobBox(true, true)).toEqual({ left: 14, top: -5, width: 58, height: 38 });
  });

  it("keeps the track at 64 x 28", () => {
    expect([TOGGLE.width, TOGGLE.height]).toEqual([64, 28]);
  });
});
