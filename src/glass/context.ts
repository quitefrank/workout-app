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
