import type { CSSProperties } from "react";

/**
 * Start Workout's soft edge (Frank's calls, 2026-11-13): the blur and one gradient both run from the screen's bottom up
 * a reach above the button (40pt), strongest at the bottom; the gradient is the screen's colour from 25% at the bottom to 0% at
 * the top, with no kit tint or darkening layer under it. The reach and both strengths stay tunable by eye from Settings, saved per
 * device in localStorage and read by the edge as custom properties. Pure apart from the storage.
 */

export type TuneKey = "reach" | "blur" | "grad";
export type Tune = Record<TuneKey, number>;

export const TUNE_DIALS: ReadonlyArray<{ key: TuneKey; label: string; min: number; max: number; step: number; unit: "pt" | "%" }> = [
  { key: "reach", label: "Reach above button", min: 0, max: 120, step: 1, unit: "pt" },
  { key: "blur", label: "Blur at the bottom", min: 0, max: 40, step: 1, unit: "pt" },
  { key: "grad", label: "Gradient at the bottom", min: 0, max: 100, step: 1, unit: "%" },
];

/** Frank's values, 2026-11-13: 40pt above the button, 10pt blur, 25% gradient */
export const TUNE_DEFAULTS: Tune = { reach: 40, blur: 10, grad: 25 };

// renamed with each new set of defaults, so a value saved under the old ones never overrides them
export const TUNE_KEY = "start_edge_tune_2";
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
  return { "--se-reach": `${t.reach}px`, "--se-blur": `${t.blur}px`, "--se-grad": t.grad / 100 } as CSSProperties;
}

/** The values in the shape of the source constants, for pasting back */
export function tuneSource(t: Tune): string {
  return [`// Start Workout's soft edge, tuned on the phone`, `reach: ${t.reach}, // pt above the button`, `blur: ${t.blur},`, `gradient: ${+(t.grad / 100).toFixed(2)},`].join("\n");
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
