import { describe, expect, it } from "vitest";
import { closesOnRelease, opensOnRelease, progressFor, travel, OPEN_HEADER, PILL } from "../journal-card";

describe("journal card", () => {
  it("travels from the pill's top to under the status bar", () => {
    // 852pt screen, dock 21pt up: the pill's top is at 852 - 21 - 70 = 761, open is 62
    expect(travel(852, 21)).toBe(761 - 62);
  });

  it("is the kit's notification row closed and its sheet toolbar open", () => {
    // a 38pt circle 16pt from every edge makes the 70pt pill
    expect(PILL.circle + 2 * PILL.padding).toBe(PILL.height);
    // the open header (16pt grabber band, 44pt buttons, 10pt under) is the pill's height, so the header never resizes
    expect(16 + OPEN_HEADER.button + 10).toBe(OPEN_HEADER.height);
    expect(OPEN_HEADER.height).toBe(PILL.height);
    // inside the card the check keeps a 16pt edge from pill to sheet; the card's own edge moves out by PILL.inset
    expect(PILL.padding).toBe(OPEN_HEADER.inset);
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
