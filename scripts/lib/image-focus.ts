/**
 * Where an exercise illustration's red highlight is, for row thumbnails that zoom toward the worked muscle (Frank's
 * call, 2026-11-14). Pure: takes RGBA pixels, returns the highlight's centre as fractions of the image and the zoom
 * at which the highlight with a margin fills `SMART_FILL` of the tile, capped at `SMART_MAX`.
 */

export type Focus = { fx: number; fy: number; fz: number };

/** A pixel is the highlight when it is opaque enough and clearly red (the illustrations' red on a gray figure) */
export const isHighlight = (r: number, g: number, b: number, a: number) => a > 40 && r > 150 && r - g > 60 && r - b > 60;

/** The highlight's larger side fills this share of the tile in Smart zoom */
export const SMART_FILL = 0.6;
export const SMART_MAX = 2.5;
/** Stray red pixels (an outline's antialiasing) are trimmed off each end before the box is taken */
const TRIM = 0.02;
/** Fewer highlight pixels than this share of the image means no highlight: the thumbnail stays centred and whole */
const MIN_SHARE = 0.0005;

const round = (v: number) => Math.round(v * 1000) / 1000;

/** The value `q` of the way through a sorted list */
const at = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.round(q * (sorted.length - 1))))];

export function findFocus(data: ArrayLike<number>, width: number, height: number): Focus {
  const xs: number[] = [], ys: number[] = [];
  for (let y = 0; y < height; y++)
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (isHighlight(data[i], data[i + 1], data[i + 2], data[i + 3])) { xs.push(x); ys.push(y); }
    }
  if (xs.length < MIN_SHARE * width * height) return { fx: 0.5, fy: 0.5, fz: 1 };
  xs.sort((a, b) => a - b);
  ys.sort((a, b) => a - b);
  // pixel centres as fractions, so a one-pixel highlight has a size
  const x0 = at(xs, TRIM) / width, x1 = (at(xs, 1 - TRIM) + 1) / width;
  const y0 = at(ys, TRIM) / height, y1 = (at(ys, 1 - TRIM) + 1) / height;
  const side = Math.max(x1 - x0, y1 - y0);
  const fz = Math.min(SMART_MAX, Math.max(1, SMART_FILL / side));
  return { fx: round((x0 + x1) / 2), fy: round((y0 + y1) / 2), fz: round(fz) };
}
