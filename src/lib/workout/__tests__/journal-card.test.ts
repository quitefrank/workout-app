import { describe, expect, it } from "vitest";
import { closesOnRelease, opensOnRelease, progressFor, travel, PILL } from "../journal-card";

describe("journal card", () => {
  it("travels from the pill's top to under the status bar", () => {
    // 852pt screen, dock 21pt up: the pill's top is at 852 - 21 - 67 = 764, open is 62
    expect(travel(852, 21)).toBe(764 - 62);
    expect(PILL.height).toBe(67);
  });

  it("follows the finger and stays between the pill and open", () => {
    expect(progressFor(0, 700)).toBe(0);
    expect(progressFor(350, 700)).toBe(0.5);
    expect(progressFor(-40, 700)).toBe(0);
    expect(progressFor(900, 700)).toBe(1);
  });

  it("opens past 90pt or on a flick up, and sinks back otherwise", () => {
    expect(opensOnRelease(120, 0)).toBe(true);
    expect(opensOnRelease(40, 0)).toBe(false);
    expect(opensOnRelease(20, 0.8)).toBe(true);
    // far enough but heading back down: stays closed
    expect(opensOnRelease(120, -0.6)).toBe(false);
  });

  it("closes from the header when pulled a quarter down or flicked", () => {
    expect(closesOnRelease(0.6, 0)).toBe(true);
    expect(closesOnRelease(0.9, 0)).toBe(false);
    expect(closesOnRelease(0.95, 0.7)).toBe(true);
    expect(closesOnRelease(0.6, -0.5)).toBe(false);
  });
});
