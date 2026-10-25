import { CTXV, type Material } from "./presets";

/**
 * The context rule (lab lines 4395 to 4420). Each small control reads the page under it and takes the side of its preset
 * that suits it: the dark side over dark content, the light side over light, whatever the appearance. Dark below 0.40,
 * light again above 0.50, so a control on a boundary does not flicker; the move is a 0.25s crossfade of every value.
 */

export function decideDark(onDark: boolean | null, avgL: number): boolean {
  if (onDark === null) return avgL < (CTXV.dark + CTXV.light) / 2;
  return onDark ? avgL < CTXV.light : avgL < CTXV.dark;
}

/** s: 0 = light, 1 = dark, moving linearly at dt / fade; the first frame jumps straight to the goal */
export function stepSide(s: number | null, goal: number, dt: number, fadeMs: number): number {
  if (s === null) return goal;
  const span = Math.max(1, fadeMs);
  return goal > s ? Math.min(goal, s + dt / span) : Math.max(goal, s - dt / span);
}

export function lerpRgb(a: number, b: number, t: number): number {
  const c = (x: number, sh: number) => (x >> sh) & 255;
  let o = 0;
  for (const sh of [16, 8, 0]) o |= Math.round(c(a, sh) + (c(b, sh) - c(a, sh)) * t) << sh;
  return o;
}

/** A GPU readback of a w x h RGBA8 target as tight rows: WebGPU pads each row to 256 bytes, and a render target can come
 *  back bottom row first (`flipY`) */
export function unpadRows(bytes: ArrayLike<number>, w: number, h: number, flipY: boolean): Uint8ClampedArray {
  const row = w * 4, stride = Math.ceil(row / 256) * 256;
  const out = new Uint8ClampedArray(row * h);
  for (let y = 0; y < h; y++) {
    const from = (flipY ? h - 1 - y : y) * stride;
    for (let i = 0; i < row; i++) out[y * row + i] = bytes[from + i];
  }
  return out;
}

/** The average sRGB luminance (0 to 1) of a page rect from the grid of `cell`-px averages, `aw` cells wide; 0.5 with no
 *  grid yet or no cell under the rect */
export function averageUnder(grid: Uint8ClampedArray | null, aw: number, ah: number, cell: number, r: { x0: number; x1: number; y0: number; y1: number }): number {
  if (!grid) return 0.5;
  const x0 = Math.max(0, Math.floor(r.x0 / cell)), x1 = Math.min(aw, Math.ceil(r.x1 / cell)), y0 = Math.max(0, Math.floor(r.y0 / cell)), y1 = Math.min(ah, Math.ceil(r.y1 / cell));
  let sum = 0, n = 0;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * aw + x) * 4; sum += grid[i] * 0.2126 + grid[i + 1] * 0.7152 + grid[i + 2] * 0.0722; n++; }
  return n ? sum / n / 255 : 0.5;
}

/** Light side A to dark side B at t */
export function blendSides(A: Material, B: Material, t: number): Material {
  const o: Material = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k];
    const b = B[k];
    if (typeof a !== "number" || typeof b !== "number") {
      const v = t < 0.5 ? a : b;
      if (v !== undefined) o[k] = v;
    } else if (/Color$/.test(k)) o[k] = lerpRgb(a, b, t);
    else if (/Blend$|Srgb$|^lensMode$/.test(k)) o[k] = t < 0.5 ? a : b;
    else o[k] = a + (b - a) * t;
  }
  return o;
}
