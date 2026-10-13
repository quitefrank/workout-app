/** Parsers for computed CSS values (the browser has already resolved colours to rgb() and lengths to px). */

export type Rgba = [number, number, number, number];
export type Stop = { color: string; pos: number };
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

export function parseColor(c: string): Rgba | null {
  if (c === "transparent") return [0, 0, 0, 0];
  const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] == null ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith("%")) a /= 100;
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

const SIDES: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };

export function parseLinearGradients(value: string): Gradient[] {
  if (!value || value === "none") return [];
  const out: Gradient[] = [];
  for (const layer of splitTopLevel(value)) {
    const m = layer.match(/^linear-gradient\(([\s\S]*)\)$/);
    if (!m) continue;
    const parts = splitTopLevel(m[1]);
    let angle = 180;
    if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift()!);
    else if (parts[0] in SIDES) angle = SIDES[parts.shift()!];
    else if (/^to /.test(parts[0])) parts.shift(); // corners: rare in this app, drawn top to bottom
    const raw = parts.map((p) => {
      const pm = p.match(/^(rgba?\([^)]*\)|transparent)\s*([\d.]+%)?$/);
      return { color: pm ? pm[1] : p, pos: pm && pm[2] ? parseFloat(pm[2]) / 100 : null };
    });
    out.push({ angle, stops: fillPositions(raw) });
  }
  return out;
}

function fillPositions(raw: { color: string; pos: number | null }[]): Stop[] {
  const n = raw.length;
  const pos = raw.map((s) => s.pos);
  if (pos[0] == null) pos[0] = 0;
  if (pos[n - 1] == null) pos[n - 1] = 1;
  for (let i = 1; i < n; i++) {
    if (pos[i] != null) continue;
    let j = i;
    while (pos[j] == null) j++;
    const a = pos[i - 1]!, b = pos[j]!;
    for (let k = i; k < j; k++) pos[k] = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  return raw.map((s, i) => ({ color: s.color, pos: pos[i]! }));
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
    const color = s.match(/rgba?\([^)]*\)/)?.[0] ?? "rgb(0, 0, 0)";
    const nums = s.replace(color, "").match(/-?[\d.]+px/g)?.map(parseFloat) ?? [];
    return { color, x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, spread: nums[3] ?? 0, inset: /\binset\b/.test(s) };
  });
}
