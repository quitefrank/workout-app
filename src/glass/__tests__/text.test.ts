import { describe, expect, it } from "vitest";
import { baselineOf, splitLines, textUnits, transformText } from "../paint/text";

describe("text helpers", () => {
  it("puts the baseline at the content area's ascent, centred in the box", () => {
    // a range rect whose height is the content area: baseline = top + ascent
    expect(baselineOf(100, 20, { ascent: 15.6, descent: 4.4 }, 17)).toBe(116);
    // a 22px line box around a 20px content area: 1px of half-leading above
    expect(baselineOf(100, 22, { ascent: 15.6, descent: 4.4 }, 17)).toBe(117);
    // no canvas: the 0.3 em estimate from the line box centre
    expect(baselineOf(100, 20, null, 10)).toBe(113);
  });

  it("splits text into graphemes by UTF-16 offset, skipping whitespace", () => {
    expect(textUnits("a\u{1F4AA}b c", 0, 6)).toEqual([{ i: 0, len: 1 }, { i: 1, len: 2 }, { i: 3, len: 1 }, { i: 5, len: 1 }]);
    expect(textUnits("  ab", 2, 4)).toEqual([{ i: 2, len: 1 }, { i: 3, len: 1 }]);
  });

  it("finds line breaks by binary search on the units' tops", () => {
    const tops = [0, 0, 0, 22, 22, 44];
    expect(splitLines(tops.length, (k) => ({ top: tops[k], height: 20 }))).toEqual([[0, 3], [3, 5], [5, 6]]);
    // a glyph sitting a pixel higher (a fallback font) stays on its line
    expect(splitLines(3, (k) => ({ top: k === 1 ? -1 : 0, height: 20 }))).toEqual([[0, 3]]);
    // a unit without a box joins the line after it
    expect(splitLines(3, (k) => (k === 0 ? null : { top: 0, height: 20 }))).toEqual([[0, 3]]);
    expect(splitLines(2, () => null)).toEqual([]);
    let calls = 0;
    expect(splitLines(200, (k) => { calls++; return { top: k < 120 ? 0 : 22, height: 20 }; })).toEqual([[0, 120], [120, 200]]);
    expect(calls).toBeLessThan(20);
  });

  it("applies text-transform", () => {
    expect(transformText("bench press", "uppercase")).toBe("BENCH PRESS");
    expect(transformText("Bench", "lowercase")).toBe("bench");
    expect(transformText("bench press day", "capitalize")).toBe("Bench Press Day");
    expect(transformText("as is", "none")).toBe("as is");
  });
});
