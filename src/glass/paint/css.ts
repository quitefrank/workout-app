/**
 * Parsers for computed CSS values. Lengths are px. Colours are NOT always rgb(): Tailwind 4 computes `bg-black/20` to
 * `oklab(0 0 0 / 0.2)`, `color-mix(in srgb, ...)` to `color(srgb r g b / a)` and palette classes to `oklch(...)`.
 * rgb/rgba/transparent and color(srgb) parse directly; anything else is resolved through a 1x1 canvas.
 */

export type Rgba = [number, number, number, number];
/** `pos` is a fraction of the gradient line. A px stop carries `posPx` (and a provisional `pos`); `auto` marks a stop
 *  whose position is interpolated once the px stops are known. Call `resolveStops` before painting. */
export type Stop = { color: string; pos: number; posPx?: number; auto?: boolean };
export type Gradient = { angle: number; stops: Stop[] };
export type Shadow = { color: string; x: number; y: number; blur: number; spread: number; inset: boolean };

export function splitTopLevel(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === sep && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  const last = s.slice(start).trim();
  if (last) out.push(last);
  return out;
}

/** Top-level whitespace tokens ("rgb(0 0 0 / 0.2) 0px 4px" is three tokens) */
function tokens(s: string): string[] {
  return splitTopLevel(s, " ").filter(Boolean);
}

const LENGTH = /^-?[\d.]+(px|%)?$/;

type Resolver = (c: string) => Rgba | null;
const colorCache = new Map<string, Rgba | null>();
let resolver: Resolver | undefined; // undefined: default canvas resolver

/** Test seam: inject a resolver for colours that are not rgb()/color(srgb), or null to restore the canvas default. */
export function setColorResolver(fn: Resolver | null) {
  resolver = fn ?? undefined;
  colorCache.clear();
}

let probe: CanvasRenderingContext2D | null | undefined;

function canvasResolve(c: string): Rgba | null {
  if (probe === undefined) {
    try {
      probe = typeof document === "undefined" ? null : document.createElement("canvas").getContext("2d", { willReadFrequently: true });
    } catch {
      probe = null;
    }
    if (probe) { probe.canvas.width = 1; probe.canvas.height = 1; }
  }
  if (!probe) return null;
  // An invalid colour leaves fillStyle untouched, so two different sentinels read back differently.
  probe.fillStyle = "#000000"; probe.fillStyle = c; const a = String(probe.fillStyle);
  probe.fillStyle = "#ffffff"; probe.fillStyle = c; const b = String(probe.fillStyle);
  if (a !== b) return null;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = c;
  probe.fillRect(0, 0, 1, 1);
  const d = probe.getImageData(0, 0, 1, 1).data;
  return [d[0], d[1], d[2], d[3] / 255];
}

export function parseColor(c: string): Rgba | null {
  if (c === "transparent") return [0, 0, 0, 0];
  const m = c.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (m) {
    let a = m[4] == null ? 1 : parseFloat(m[4]);
    if (m[4]?.endsWith("%")) a /= 100;
    return [Number(m[1]), Number(m[2]), Number(m[3]), a];
  }
  const s = c.match(/^color\(\s*srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+%?))?\s*\)$/);
  if (s) {
    let a = s[4] == null ? 1 : parseFloat(s[4]);
    if (s[4]?.endsWith("%")) a /= 100;
    return [Number(s[1]) * 255, Number(s[2]) * 255, Number(s[3]) * 255, a];
  }
  if (colorCache.has(c)) {
    const hit = colorCache.get(c)!;
    return hit && [...hit] as Rgba;
  }
  let out: Rgba | null = null;
  try {
    out = (resolver === undefined ? canvasResolve : resolver)(c);
  } catch {
    out = null;
  }
  if (colorCache.size >= 1000) colorCache.clear();
  colorCache.set(c, out);
  return out && ([...out] as Rgba);
}

const SIDES: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };
const INTERP = /(^|\s)in\s+\S+(\s+(?:shorter|longer|increasing|decreasing)\s+hue)?\s*$/;

export function parseLinearGradients(value: string): Gradient[] {
  if (!value || value === "none") return [];
  const out: Gradient[] = [];
  for (const layer of splitTopLevel(value)) {
    const m = layer.match(/^linear-gradient\(([\s\S]*)\)$/);
    if (!m) continue;
    const parts = splitTopLevel(m[1]);
    if (parts.length && INTERP.test(parts[0])) {
      const rest = parts[0].replace(INTERP, "").trim();
      if (rest) parts[0] = rest;
      else parts.shift();
    }
    let angle = 180;
    if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift()!);
    else if (parts[0] in SIDES) angle = SIDES[parts.shift()!];
    else if (/^to /.test(parts[0])) parts.shift(); // corners: rare in this app, drawn top to bottom
    const raw: { color: string; frac: number | null; px: number | null }[] = [];
    for (const p of parts) {
      const t = tokens(p);
      if (!t.length || LENGTH.test(t[0])) continue; // a bare interpolation hint carries no colour
      const pos = t.slice(1).map((x) => {
        const n = parseFloat(x);
        if (!Number.isFinite(n)) return { frac: null, px: null }; // calc() and friends: placed as unpositioned
        return x.endsWith("%") ? { frac: n / 100, px: null } : { frac: null, px: n };
      });
      if (!pos.length) raw.push({ color: t[0], frac: null, px: null });
      for (const q of pos.slice(0, 2)) raw.push({ color: t[0], ...q });
    }
    const stops: Stop[] = raw.map((r) =>
      r.px != null ? { color: r.color, pos: 0, posPx: r.px } : r.frac != null ? { color: r.color, pos: r.frac } : { color: r.color, pos: 0, auto: true },
    );
    out.push({ angle, stops: stops.some((s) => s.posPx != null) ? stops : resolveStops(stops, 0) });
  }
  return out;
}

/** Turn px stops into fractions of `lineLength`, then in spec order: default the ends, make the known positions
 *  non-decreasing, and fill unpositioned stops evenly between their neighbours. A non-finite position is unpositioned. */
export function resolveStops(stops: Stop[], lineLength: number): Stop[] {
  const n = stops.length;
  const pos: (number | null)[] = stops.map((s) => {
    const p = s.posPx != null ? (lineLength > 0 ? s.posPx / lineLength : 0) : s.auto ? null : s.pos;
    return p != null && Number.isFinite(p) ? p : null;
  });
  if (n && pos[0] == null) pos[0] = 0;
  if (n && pos[n - 1] == null) pos[n - 1] = 1;
  let prev = -Infinity;
  for (let i = 0; i < n; i++) if (pos[i] != null) pos[i] = prev = Math.max(prev, pos[i]!);
  for (let i = 1; i < n; i++) {
    if (pos[i] != null) continue;
    let j = i;
    while (pos[j] == null) j++;
    const a = pos[i - 1]!, b = pos[j]!;
    for (let k = i; k < j; k++) pos[k] = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  return stops.map((s, i) => ({ color: s.color, pos: pos[i]! }));
}

/** The CSS gradient line for an angle over a w x h box (CSS Images 3, linear-gradient) */
export function gradientLine(angle: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180;
  const L = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const dx = (Math.sin(a) * L) / 2, dy = (-Math.cos(a) * L) / 2;
  const round = (v: number) => Math.round(v * 1e6) / 1e6 + 0; // + 0 turns -0 into 0
  return { x0: round(w / 2 - dx), y0: round(h / 2 - dy), x1: round(w / 2 + dx), y1: round(h / 2 + dy) };
}

export function parseBoxShadows(value: string): Shadow[] {
  if (!value || value === "none") return [];
  return splitTopLevel(value).map((s) => {
    const t = tokens(s);
    const color = t.find((x) => x !== "inset" && !LENGTH.test(x)) ?? "rgb(0, 0, 0)";
    const nums = t.filter((x) => LENGTH.test(x)).map(parseFloat);
    return { color, x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, spread: nums[3] ?? 0, inset: t.includes("inset") };
  });
}

export type Linear = [number, number, number, number];

const ANGLE: Record<string, number> = { deg: Math.PI / 180, rad: 1, turn: 2 * Math.PI, grad: Math.PI / 200 };

/** a then b, as canvas `transform(a, b, c, d)` coefficients */
function then(first: Linear, next: Linear): Linear {
  const [a, b, c, d] = next, [e, f, g, h] = first;
  return [a * e + c * f, b * e + d * f, a * g + c * h, b * g + d * h];
}

/** The 2x2 linear part of an element's computed `rotate`, `scale` and `transform`, or null for none. As in CSS
 *  Transforms 2, a point goes through `transform` first, then `scale`, then `rotate`. A turn about the x or y axis and any translation are ignored. */
export function parseLinearTransform(rotate: string, scale: string, transform: string): Linear | null {
  let m: Linear = [1, 0, 0, 1];
  const t = transform.match(/^matrix(3d)?\(([^)]*)\)$/);
  if (t) {
    const v = t[2].split(",").map(parseFloat);
    m = t[1] ? [v[0], v[1], v[4], v[5]] : [v[0], v[1], v[2], v[3]];
  }
  if (scale && scale !== "none") {
    const v = scale.trim().split(/\s+/).map((x) => (x.endsWith("%") ? parseFloat(x) / 100 : parseFloat(x)));
    m = then(m, [v[0], 0, 0, v[1] ?? v[0]]);
  }
  const r = rotate.trim().split(/\s+/);
  const z = r.length === 1 || r[0] === "z" || (r.length === 4 && parseFloat(r[0]) === 0 && parseFloat(r[1]) === 0);
  const ang = r[r.length - 1].match(/^(-?[\d.]+)(deg|rad|turn|grad)$/);
  if (rotate !== "none" && z && ang) {
    const a = parseFloat(ang[1]) * ANGLE[ang[2]];
    m = then(m, [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a)]);
  }
  if (m.some((v) => !Number.isFinite(v))) return null;
  return m.every((v, i) => Math.abs(v - [1, 0, 0, 1][i]) < 1e-9) ? null : m;
}
