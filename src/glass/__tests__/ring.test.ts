import { describe, expect, it } from "vitest";
import { clipRows, cover, extend, margin, ringRow, ringRows, splitWrap, visibleRows } from "../paint/ring";

describe("ring arithmetic", () => {
  it("is two screens tall within the texture limit", () => {
    expect(ringRows(2622)).toBe(5244);
    expect(ringRows(5000)).toBe(8192);
    expect(ringRows(9000, 8192)).toBe(9000);
  });

  it("wraps rows, negatives included", () => {
    expect(ringRow(0, 100)).toBe(0);
    expect(ringRow(250, 100)).toBe(50);
    expect(ringRow(-1, 100)).toBe(99);
  });

  it("splits a run where it wraps, and the parts add up", () => {
    expect(splitWrap(10, 20, 100)).toEqual([{ dst: 10, src: 0, n: 20 }]);
    const parts = splitWrap(190, 30, 100);
    expect(parts).toEqual([{ dst: 90, src: 0, n: 10 }, { dst: 0, src: 10, n: 20 }]);
    expect(parts.reduce((a, p) => a + p.n, 0)).toBe(30);
    expect(splitWrap(5, 0, 100)).toEqual([]);
  });

  it("finds the content rows on screen", () => {
    expect(visibleRows(301, 0, 2622)).toEqual({ r0: 301, r1: 2923 });
  });

  it("starts again with nothing valid or a jump", () => {
    expect(cover(null, { r0: 0, r1: 100 }, 300)).toEqual({ paint: [{ r0: 0, r1: 100 }], valid: { r0: 0, r1: 100 } });
    expect(cover({ r0: 0, r1: 100 }, { r0: 500, r1: 600 }, 300)).toEqual({ paint: [{ r0: 500, r1: 600 }], valid: { r0: 500, r1: 600 } });
  });

  it("paints only the rows a scroll exposes", () => {
    // down 12pt at 3x: 36 rows below
    expect(cover({ r0: 0, r1: 2622 }, { r0: 36, r1: 2658 }, 5244)).toEqual({ paint: [{ r0: 2622, r1: 2658 }], valid: { r0: 0, r1: 2658 } });
    // up into rows above
    expect(cover({ r0: 100, r1: 200 }, { r0: 90, r1: 190 }, 300)).toEqual({ paint: [{ r0: 90, r1: 100 }], valid: { r0: 90, r1: 200 } });
    // nothing new
    expect(cover({ r0: 0, r1: 300 }, { r0: 50, r1: 150 }, 300).paint).toEqual([]);
  });

  it("gives up the rows furthest from what was added", () => {
    expect(extend({ r0: 0, r1: 300 }, { r0: 300, r1: 340 }, 300)).toEqual({ r0: 40, r1: 340 });
    expect(extend({ r0: 100, r1: 400 }, { r0: 60, r1: 100 }, 300)).toEqual({ r0: 60, r1: 360 });
  });

  it("fills a margin at rest, below first, within the content and the budget", () => {
    const want = { r0: 1000, r1: 1100 }, content = { r0: 0, r1: 5000 };
    expect(margin(want, want, 300, content, 40)).toEqual({ r0: 1100, r1: 1140 });
    expect(margin({ r0: 1000, r1: 1200 }, want, 300, content, 40)).toEqual({ r0: 960, r1: 1000 });
    expect(margin({ r0: 900, r1: 1200 }, want, 300, content, 40)).toBeNull();
    // the content's end stops it
    expect(margin({ r0: 0, r1: 100 }, { r0: 0, r1: 100 }, 300, { r0: 0, r1: 120 }, 400)).toEqual({ r0: 100, r1: 120 });
    expect(margin({ r0: 0, r1: 120 }, { r0: 0, r1: 100 }, 300, { r0: 0, r1: 120 }, 400)).toBeNull();
  });

  it("never gives up rows on screen while filling the margin", () => {
    const want = { r0: 1000, r1: 1100 }, content = { r0: 0, r1: 5000 };
    let valid = { r0: 1000, r1: 1100 };
    for (let i = 0; i < 50; i++) {
      const m = margin(valid, want, 300, content, 37);
      if (!m) break;
      valid = extend(valid, m, 300);
      expect(valid.r0 <= want.r0 && valid.r1 >= want.r1).toBe(true);
    }
    expect(valid.r1 - valid.r0).toBe(300);
  });

  it("clips rows", () => {
    expect(clipRows({ r0: 0, r1: 50 }, { r0: 40, r1: 100 })).toEqual({ r0: 40, r1: 50 });
    expect(clipRows({ r0: 0, r1: 40 }, { r0: 40, r1: 100 })).toBeNull();
  });
});
