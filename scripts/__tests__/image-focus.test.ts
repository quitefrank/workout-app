import { describe, expect, it } from "vitest";
import { findFocus, SMART_MAX } from "../lib/image-focus";

/** A gray 100 x 100 image with red filled in the given rectangle */
function image(red: [number, number, number, number] | null, size = 100) {
  const d = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const inRed = red && x >= red[0] && x < red[2] && y >= red[1] && y < red[3];
      d.set(inRed ? [230, 40, 40, 255] : [150, 150, 150, 255], i);
    }
  return d;
}

describe("findFocus", () => {
  it("centres on the highlight and zooms until it fills 60%", () => {
    // 40 wide, 20 tall at the lower left: centre 0.3, 0.8; 0.6 / 0.4 = 1.5x
    expect(findFocus(image([10, 70, 50, 90]), 100, 100)).toEqual({ fx: 0.3, fy: 0.8, fz: 1.5 });
  });

  it("caps the zoom for a small highlight", () => {
    expect(findFocus(image([45, 45, 55, 55]), 100, 100).fz).toBe(SMART_MAX);
  });

  it("never zooms out past the whole image", () => {
    expect(findFocus(image([0, 0, 100, 100]), 100, 100).fz).toBe(1);
  });

  it("stays centred and whole with no red", () => {
    expect(findFocus(image(null), 100, 100)).toEqual({ fx: 0.5, fy: 0.5, fz: 1 });
  });

  it("ignores a few stray red pixels far from the highlight", () => {
    const d = image([40, 40, 60, 60]);
    d.set([230, 40, 40, 255], (0 * 100 + 99) * 4); // one pixel at the top right
    const f = findFocus(d, 100, 100);
    expect(f.fx).toBe(0.5);
    expect(f.fy).toBe(0.5);
  });

  it("ignores transparent red", () => {
    const d = image([10, 10, 30, 30]);
    for (let i = 3; i < d.length; i += 4) d[i] = 0;
    expect(findFocus(d, 100, 100)).toEqual({ fx: 0.5, fy: 0.5, fz: 1 });
  });
});
