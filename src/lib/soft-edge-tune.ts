import type { CSSProperties } from "react";

/**
 * Live tuning for Start Workout's soft edge (Frank's call, 2026-11-12: the strong edge hid everything under the button,
 * and a value judged by eye is set with sliders on the phone, not by guessing). Saved per device in localStorage and read
 * by the edge as custom properties, so moving a slider in Settings changes the real page. Pure apart from the storage.
 * The defaults are the strong preset (SOFT_EDGE_STRONG with the kit's tint), so nothing changes until a slider moves.
 */

export type TuneKey = "blurFrom" | "gradFrom" | "gradFull" | "blur" | "tint" | "d1" | "d2" | "d3";
export type Tune = Record<TuneKey, number>;

/** Heights are pt up from the screen's bottom. The blur and the gradient each start at their own height and grow
 *  toward the bottom; the darkening reaches full at `gradFull` and holds it to the bottom (as the active workout's edges
 *  go solid at a point). Its 25% and 60% stops are of the way from where it starts to where it is full. */
export const TUNE_DIALS: ReadonlyArray<{ key: TuneKey; label: string; min: number; max: number; step: number; unit: "pt" | "%" }> = [
  { key: "blurFrom", label: "Blur starts at", min: 0, max: 320, step: 1, unit: "pt" },
  { key: "blur", label: "Blur at the bottom", min: 0, max: 40, step: 1, unit: "pt" },
  { key: "gradFrom", label: "Gradient starts at", min: 0, max: 320, step: 1, unit: "pt" },
  { key: "gradFull", label: "Gradient full at", min: 0, max: 320, step: 1, unit: "pt" },
  { key: "tint", label: "Tint at the bottom", min: 0, max: 100, step: 1, unit: "%" },
  { key: "d1", label: "Darkening at 25%", min: 0, max: 100, step: 1, unit: "%" },
  { key: "d2", label: "Darkening at 60%", min: 0, max: 100, step: 1, unit: "%" },
  { key: "d3", label: "Darkening when full", min: 0, max: 100, step: 1, unit: "%" },
];

/** 87pt: where the edge started before, 16pt above the 50pt button that sits 21pt off the bottom; full at 0 is the
 *  darkening ramping all the way to the bottom, as before */
export const TUNE_DEFAULTS: Tune = { blurFrom: 87, gradFrom: 87, gradFull: 0, blur: 20, tint: 81, d1: 35, d2: 70, d3: 90 };

/** The gradient is never full above where it starts */
export function fullAt(t: Tune) {
  return Math.min(t.gradFull, t.gradFrom);
}

export const TUNE_KEY = "start_edge_tune";
const EVENT = "start-edge-tune";

/** A stored value read back: anything missing or out of range falls back to its default */
export function parseTune(raw: string | null): Tune {
  let o: Record<string, unknown> = {};
  try {
    o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    o = {};
  }
  const t = { ...TUNE_DEFAULTS };
  for (const d of TUNE_DIALS) {
    const v = o[d.key];
    if (typeof v === "number" && Number.isFinite(v)) t[d.key] = Math.min(d.max, Math.max(d.min, v));
  }
  return t;
}

/** The custom properties the edge reads (`tuned` on SoftEdge) */
export function tuneVars(t: Tune): CSSProperties {
  return {
    "--se-blur-from": `${t.blurFrom}px`,
    "--se-grad-from": `${t.gradFrom}px`,
    "--se-grad-full": `${fullAt(t)}px`,
    "--se-blur": `${t.blur}px`,
    "--se-tint": t.tint / 100,
    "--se-d1": t.d1 / 100,
    "--se-d2": t.d2 / 100,
    "--se-d3": t.d3 / 100,
  } as CSSProperties;
}

/** The values in the shape of the source constants, for pasting back */
export function tuneSource(t: Tune): string {
  const a = (v: number) => +(v / 100).toFixed(2);
  return [
    `// Start Workout's soft edge, tuned on the phone`,
    `// heights in pt up from the screen's bottom`,
    `blurFrom: ${t.blurFrom},`,
    `blur: ${t.blur},`,
    `gradFrom: ${t.gradFrom},`,
    `gradFull: ${fullAt(t)},`,
    `tint: ${a(t.tint)},`,
    `darken: [[0, 0], [0.25, ${a(t.d1)}], [0.6, ${a(t.d2)}], [1, ${a(t.d3)}]], // of the way from gradFrom to gradFull`,
  ].join("\n");
}

// The stored string is the snapshot, so useSyncExternalStore sees a stable value between changes
export function readTuneRaw(): string | null {
  try {
    return localStorage.getItem(TUNE_KEY);
  } catch {
    return null;
  }
}

export function writeTune(t: Tune | null) {
  try {
    if (t) localStorage.setItem(TUNE_KEY, JSON.stringify(t));
    else localStorage.removeItem(TUNE_KEY);
  } catch {
    // private mode: the slider still moves for this visit
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeTune(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
