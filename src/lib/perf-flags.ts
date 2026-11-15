/**
 * Performance levers (2026-11-14, from the three-agent performance review): each cost the review found can be switched
 * on this device, so its effect can be A/B'd on the phone. Set from Settings > Performance, or with `?perf=` on any page
 * load: `?perf=-idle,msaa` turns idle off and msaa on, `?perf=reset` goes back to the defaults. Saved in localStorage,
 * so a home screen app (no address bar) keeps what a link set. Pure apart from the storage and the change event.
 *
 * Levers marked `restart` are read when the glass stage starts, so they take effect on the next page load.
 */

import { useSyncExternalStore } from "react";

export type PerfLever =
  | "gpu"
  | "idle"
  | "msaa"
  | "dpr2"
  | "cull"
  | "blurchain"
  | "mip"
  | "edge"
  | "avg"
  | "push"
  | "ctx"
  | "tick"
  | "clipruns"
  | "edgefrost"
  | "pushidle"
  | "ring";

export type PerfDef = { key: PerfLever; label: string; on: boolean; restart?: boolean; help: string };

/** The levers in the order Settings lists them; `on` is the default */
export const PERF_LEVERS: ReadonlyArray<PerfDef> = [
  { key: "gpu", label: "WebGPU glass", on: true, restart: true, help: "Off keeps the CSS material everywhere." },
  { key: "idle", label: "Skip unchanged frames", on: true, help: "The stage draws nothing when nothing on screen moved." },
  { key: "msaa", label: "Antialiasing", on: false, restart: true, help: "4x multisampling on the glass pass. The shaders already smooth their edges." },
  { key: "dpr2", label: "2x canvas", on: false, restart: true, help: "Paints the page at 2x instead of 3x. Slightly softer text." },
  { key: "cull", label: "No rebuild while images load", on: true, help: "An image still loading no longer rebuilds the painted page every frame." },
  { key: "blurchain", label: "Shared blur chain", on: true, help: "Soft edges blur once per level instead of once per band (iPhone path)." },
  { key: "mip", label: "Force iPhone blur path", on: false, help: "Desktop only, for measuring: blurs soft edges the way iPhone Safari must." },
  { key: "edge", label: "Painted soft edges", on: true, help: "Off drops the soft edges from the painted page (diagnostic)." },
  { key: "avg", label: "Throttle brightness reads", on: true, help: "Reads the page's brightness every 4th frame while scrolling, every frame at rest." },
  { key: "push", label: "Page push", on: true, help: "Off shows a new page as soon as it arrives, with no slide." },
  { key: "ctx", label: "Coarse CSS sampler", on: true, help: "The CSS path samples the page on a 32pt grid at most 20 times a second." },
  { key: "tick", label: "Live workout clocks", on: true, help: "The workout's timer and rest ring update outside the painted page." },
  // the scroll review (2026-11-14, tmp/agent-scratch/scroll-verdict.md)
  { key: "clipruns", label: "Clip once per run", on: true, help: "A clip is applied once for a run of items that share it, and a clip that cuts nothing is skipped." },
  { key: "edgefrost", label: "Skip idle edge blur", on: true, help: "The top edge's blur is not rendered while the edge is off." },
  { key: "pushidle", label: "Light page pass", on: true, help: "Without a page push running, the page pass samples the page once and never the push's copy." },
  { key: "ring", label: "Scroll by moving", on: true, restart: true, help: "Scrolling moves a painted copy of the page on the GPU and paints only the rows that come into view." },
];

const DEFAULTS = Object.fromEntries(PERF_LEVERS.map((d) => [d.key, d.on])) as Record<PerfLever, boolean>;
const KNOWN = new Set<string>(PERF_LEVERS.map((d) => d.key));

export type PerfOverrides = Partial<Record<PerfLever, boolean>>;

export const PERF_KEY = "perf_flags";
const EVENT = "perf-flags";

/** What localStorage held, read back; anything unknown or not a boolean is dropped */
export function parseStored(raw: string | null): PerfOverrides {
  let o: Record<string, unknown> = {};
  try {
    o = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    o = {};
  }
  const out: PerfOverrides = {};
  for (const [k, v] of Object.entries(o ?? {})) if (KNOWN.has(k) && typeof v === "boolean") out[k as PerfLever] = v;
  return out;
}

/**
 * A `?perf=` value applied over what was stored: `a` turns a lever on, `-a` off, `reset` clears everything before the
 * rest is applied. Unknown names are ignored. An override equal to the default is dropped, so the store stays minimal.
 */
export function applyParam(param: string, stored: PerfOverrides): PerfOverrides {
  let out: PerfOverrides = { ...stored };
  for (const raw of param.split(",")) {
    const t = raw.trim();
    if (!t) continue;
    if (t === "reset") { out = {}; continue; }
    const off = t.startsWith("-");
    const k = off ? t.slice(1) : t;
    if (!KNOWN.has(k)) continue;
    out[k as PerfLever] = !off;
  }
  return minimal(out);
}

/** Drop overrides that equal the default */
export function minimal(o: PerfOverrides): PerfOverrides {
  const out: PerfOverrides = {};
  for (const [k, v] of Object.entries(o) as [PerfLever, boolean][]) if (v !== DEFAULTS[k]) out[k] = v;
  return out;
}

/** Every lever's value: the override, else the default */
export function resolve(o: PerfOverrides): Record<PerfLever, boolean> {
  return { ...DEFAULTS, ...o };
}

/** The changed levers as a `?perf=` value, for the readout and for sharing a setup */
export function describe(o: PerfOverrides): string {
  return (Object.entries(minimal(o)) as [PerfLever, boolean][]).map(([k, v]) => (v ? k : `-${k}`)).join(",");
}

// ---- storage, read once per load and kept in memory, so the stage can ask every frame for free ----

let current: Record<PerfLever, boolean> | null = null;
let rawCache: string | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(PERF_KEY);
  } catch {
    return null;
  }
}

function load(): Record<PerfLever, boolean> {
  if (current) return current;
  if (typeof window === "undefined") return DEFAULTS;
  let o = parseStored(readRaw());
  try {
    const param = new URLSearchParams(window.location.search).get("perf");
    if (param != null) {
      o = applyParam(param, o);
      try {
        if (Object.keys(o).length) localStorage.setItem(PERF_KEY, JSON.stringify(o));
        else localStorage.removeItem(PERF_KEY);
      } catch {}
    }
  } catch {}
  rawCache = JSON.stringify(minimal(o));
  current = resolve(o);
  return current;
}

/** Whether a lever is on on this device */
export function perf(key: PerfLever): boolean {
  return load()[key];
}

/** The overrides as a stable string snapshot (for useSyncExternalStore) */
export function perfSnapshot(): string {
  load();
  return rawCache ?? "{}";
}

export function setPerf(key: PerfLever, on: boolean) {
  const o = minimal({ ...parseStored(perfSnapshot()), [key]: on });
  write(o);
}

export function resetPerf() {
  write({});
}

function write(o: PerfOverrides) {
  try {
    if (Object.keys(o).length) localStorage.setItem(PERF_KEY, JSON.stringify(o));
    else localStorage.removeItem(PERF_KEY);
  } catch {}
  rawCache = JSON.stringify(o);
  current = resolve(o);
  try { window.dispatchEvent(new Event(EVENT)); } catch {}
}

/** A lever in a component: the default on the server and through hydration, this device's value after, so the markup
 *  the server sent always matches the first client render */
export function usePerf(key: PerfLever): boolean {
  const raw = useSyncExternalStore(onPerfChange, perfSnapshot, () => "{}");
  return resolve(parseStored(raw))[key];
}

export function onPerfChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
