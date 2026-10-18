import { describe, expect, it } from "vitest";
import { classify, fillRegions, mask, TONE } from "../muscle-tones";

/** RGBA from a picture: "." clear, "#" line, "o" body, "w" hit. */
function rgba(rows: string[]): { data: Uint8Array; w: number; h: number } {
  const px = { ".": [0, 0, 0, 0], "#": [69, 69, 69, 255], o: [177, 177, 177, 255], w: [255, 255, 255, 255] } as const;
  const data = new Uint8Array(rows.length * rows[0].length * 4);
  rows.join("").split("").forEach((c, i) => data.set(px[c as keyof typeof px], i * 4));
  return { data, w: rows[0].length, h: rows.length };
}

describe("muscle tones", () => {
  const pic = rgba(["#####", "#oo#w", "#oo#w", "#####", "....."]);

  it("classifies each pixel to the nearest tone, clear below half alpha", () => {
    const t = classify(pic.data);
    expect(t[0]).toBe(TONE.line);
    expect(t[6]).toBe(TONE.body);
    expect(t[9]).toBe(TONE.hit);
    expect(t[20]).toBe(TONE.none);
  });

  it("snaps anti-aliased greys to the nearest tone", () => {
    expect(classify(new Uint8Array([130, 130, 130, 255]))[0]).toBe(TONE.body);
    expect(classify(new Uint8Array([90, 90, 90, 255]))[0]).toBe(TONE.line);
    expect(classify(new Uint8Array([230, 230, 230, 200]))[0]).toBe(TONE.hit);
    expect(classify(new Uint8Array([255, 255, 255, 100]))[0]).toBe(TONE.none);
  });

  it("fills only the region a seed sits in, stopping at lines", () => {
    const before = classify(pic.data);
    const t = fillRegions(before, pic.w, pic.h, [[1, 1]], TONE.hit);
    expect([t[6], t[7], t[11], t[12]]).toEqual([TONE.hit, TONE.hit, TONE.hit, TONE.hit]);
    expect(t[0]).toBe(TONE.line);
    expect(t[8]).toBe(TONE.line);
  });

  it("does not leak into a region on the other side of a line", () => {
    const t = fillRegions(classify(pic.data), pic.w, pic.h, [[4, 1]], TONE.body);
    expect([t[9], t[14]]).toEqual([TONE.body, TONE.body]);
    expect(t[6]).toBe(TONE.body);
    expect(t[7]).toBe(TONE.body);
  });

  it("ignores a seed on a line or outside the drawing", () => {
    const before = classify(pic.data);
    expect(fillRegions(before, pic.w, pic.h, [[0, 0], [2, 4]], TONE.hit)).toEqual(before);
  });

  it("builds black-on-white masks for tracing", () => {
    const t = classify(pic.data);
    expect(mask(t, "silhouette")[0]).toBe(0);
    expect(mask(t, "silhouette")[20]).toBe(255);
    expect(mask(t, "hit")[9]).toBe(0);
    expect(mask(t, "hit")[6]).toBe(255);
    expect(mask(t, "line")[0]).toBe(0);
  });
});
