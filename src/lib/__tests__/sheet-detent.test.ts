import { describe, expect, it } from "vitest";
import { detentsFor, settleSheet, sheetPose } from "../sheet-detent";

const d = detentsFor(874);

describe("detentsFor", () => {
  it("gives the kit's heights on the kit's screen", () => {
    expect(d).toEqual({ medium: 459, large: 812, full: true });
  });
  it("hugs content shorter than medium, with nowhere higher to go", () => {
    expect(detentsFor(874, 240)).toEqual({ medium: 240, large: 240, full: false });
  });
  it("rests at medium and grows only as far as the content, staying inset", () => {
    expect(detentsFor(874, 600)).toEqual({ medium: 459, large: 600, full: false });
  });
  it("reaches the large detent when the content is at least that tall", () => {
    expect(detentsFor(874, 2000)).toEqual({ medium: 459, large: 812, full: true });
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
  it("returns a hugging sheet to its height or dismisses it", () => {
    const hug = detentsFor(874, 240);
    expect(sheetPose(240, hug)).toEqual({ p: 0, y: 0 });
    expect(settleSheet(200, 0, hug)).toBe("medium");
    expect(settleSheet(60, 0, hug)).toBe("dismiss");
  });
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
