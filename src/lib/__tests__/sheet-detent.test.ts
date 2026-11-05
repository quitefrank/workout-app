import { describe, expect, it } from "vitest";
import { detentsFor, settleSheet, sheetPose } from "../sheet-detent";

const d = detentsFor(874);

describe("detentsFor", () => {
  it("gives the kit's heights on the kit's screen", () => {
    expect(d).toEqual({ medium: 459, large: 812 });
  });
});

describe("sheetPose", () => {
  it("rests at medium with no growth or slide", () => {
    expect(sheetPose(459, d)).toEqual({ p: 0, y: 0 });
  });
  it("is fully large at the large height and never past it", () => {
    expect(sheetPose(812, d).p).toBe(1);
    expect(sheetPose(900, d).p).toBe(1);
  });
  it("slides down whole below medium", () => {
    expect(sheetPose(359, d)).toEqual({ p: 0, y: 100 });
    expect(sheetPose(-20, d)).toEqual({ p: 0, y: 459 });
  });
});

describe("settleSheet", () => {
  it("goes to the nearest stop on a slow release", () => {
    expect(settleSheet(500, 0, d)).toBe("medium");
    expect(settleSheet(700, 0, d)).toBe("large");
    expect(settleSheet(200, 0, d)).toBe("dismiss");
  });
  it("lets a flick carry past the nearest stop", () => {
    expect(settleSheet(470, 1.5, d)).toBe("large");
    expect(settleSheet(440, -2, d)).toBe("dismiss");
    expect(settleSheet(790, -1.5, d)).toBe("medium");
  });
});
