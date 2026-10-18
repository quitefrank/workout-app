/**
 * Frank's Notion muscle diagrams are three flat tones on a clear background: outline #454545, body #B1B1B1 and the
 * worked muscle in white. These helpers turn a diagram into tones, recolour whole regions (body areas enclosed by
 * outline), and build the black-on-white masks potrace traces.
 */

export const TONE = { none: 0, line: 1, body: 2, hit: 3 } as const;
export type Tone = (typeof TONE)[keyof typeof TONE];

const LEVELS: [Tone, number][] = [
  [TONE.line, 69],
  [TONE.body, 177],
  [TONE.hit, 255],
];

/** One tone per pixel of an RGBA buffer. Pixels under half alpha are clear; the rest snap to the nearest grey. */
export function classify(rgba: Uint8Array): Uint8Array {
  const out = new Uint8Array(rgba.length / 4);
  for (let i = 0; i < out.length; i++) {
    if (rgba[i * 4 + 3] < 128) continue;
    const g = (rgba[i * 4] + rgba[i * 4 + 1] + rgba[i * 4 + 2]) / 3;
    let best: Tone = TONE.line;
    let dist = Infinity;
    for (const [tone, level] of LEVELS) {
      const d = Math.abs(g - level);
      if (d < dist) [best, dist] = [tone, d];
    }
    out[i] = best;
  }
  return out;
}

/** Recolours every region a seed sits in (4-connected body or hit pixels) to `to`. Seeds on a line or outside are ignored. */
export function fillRegions(tones: Uint8Array, w: number, h: number, seeds: [number, number][], to: Tone): Uint8Array {
  const out = tones.slice();
  const fillable = (t: number) => t === TONE.body || t === TONE.hit;
  const seen = new Uint8Array(out.length);
  for (const [sx, sy] of seeds) {
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
    const start = sy * w + sx;
    if (!fillable(tones[start]) || seen[start]) continue;
    const stack = [start];
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      out[i] = to;
      const x = i % w;
      for (const n of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) {
        if (n < 0 || n >= out.length || seen[n] || !fillable(tones[n])) continue;
        seen[n] = 1;
        stack.push(n);
      }
    }
  }
  return out;
}

/** Every pixel of `from` becomes `to`. */
export function recolour(tones: Uint8Array, from: Tone, to: Tone): Uint8Array {
  return tones.map((t) => (t === from ? to : t));
}

/**
 * A greyscale mask, 0 where the layer is and 255 elsewhere. The silhouette is the whole drawing, so the body layer has
 * no seams where tones meet; hit and line are drawn over it.
 */
export function mask(tones: Uint8Array, layer: "silhouette" | "hit" | "line"): Uint8Array {
  const on = (t: number) => (layer === "silhouette" ? t !== TONE.none : layer === "hit" ? t === TONE.hit : t === TONE.line);
  return tones.map((t) => (on(t) ? 0 : 255));
}
