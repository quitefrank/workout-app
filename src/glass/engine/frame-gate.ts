/**
 * The idle gate (perf lever `idle`, 2026-11-14): the stage skips its final composite when nothing it would draw has
 * changed. A WebGPU canvas keeps showing the last frame it presented, so a skipped frame looks the same. Everything the
 * composite reads goes into one key: every uniform's value, each mesh's visibility and transform, and anything the
 * stage marks as re-rendered this frame (the page, its frosts, the tabs layer's mask). Pure.
 */

type Vecish = { x: number; y: number; z?: number; w?: number };
type Colorish = { r: number; g: number; b: number };

/** One value as text: a number, a vector, a colour, or anything else as its string */
export function valueKey(v: unknown): string {
  if (typeof v === "number") return Number.isFinite(v) ? String(Math.round(v * 1e4) / 1e4) : String(v);
  if (typeof v === "boolean") return v ? "1" : "0";
  if (v && typeof v === "object") {
    const o = v as Partial<Vecish & Colorish>;
    if (typeof o.x === "number" && typeof o.y === "number") return [o.x, o.y, o.z, o.w].filter((n) => n !== undefined).map(valueKey).join(",");
    if (typeof o.r === "number" && typeof o.g === "number" && typeof o.b === "number") return [o.r, o.g, o.b].map(valueKey).join(",");
  }
  return String(v);
}

/** A record of uniform nodes (each with a `value`) as text, keys in insertion order; plain fields are skipped */
export function uniformsKey(U: Record<string, unknown>): string {
  let s = "";
  for (const k in U) {
    const u = U[k] as { value?: unknown } | null;
    if (u && typeof u === "object" && "value" in u) s += valueKey(u.value) + ";";
  }
  return s;
}

/** A mesh's part of the key: visible, then position and scale */
export function meshKey(m: { visible: boolean; position: Vecish; scale: Vecish }): string {
  return m.visible ? `1:${valueKey(m.position)}:${valueKey(m.scale)}` : "0";
}

/** Holds the last key; `render` says whether this frame must draw */
export function makeFrameGate() {
  let last: string | null = null;
  return {
    render(key: string, forced: boolean): boolean {
      if (!forced && key === last) return false;
      last = key;
      return true;
    },
    reset() { last = null; },
  };
}
