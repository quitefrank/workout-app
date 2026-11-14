/**
 * How every soft edge is drawn (Frank's call, 2026-11-14, after the tab bar's edge halved Home's scroll frame rate): a
 * per-device choice to compare on the phone. `blur` is the edge as built (a six-band progressive blur at full
 * resolution under the gradient); `fast` blurs a quarter-resolution copy in three bands, about a sixteenth of the pixels;
 * `gradient` drops the blur and keeps only the gradient of the screen's colour. It applies to the tab bar's edge, Start
 * Workout's and the active workout's. On the CSS path `gradient` hides the blur layers and `fast` draws as `blur`.
 * Saved in localStorage. Pure apart from the storage, the change event and the attribute on <html>.
 */

export type EdgeStyle = "blur" | "fast" | "gradient";

export const EDGE_STYLES: ReadonlyArray<readonly [EdgeStyle, string]> = [
  ["blur", "Blur and gradient"],
  ["fast", "Fast blur"],
  ["gradient", "Gradient only"],
];

export const EDGE_STYLE_KEY = "soft_edge_style";
const EVENT = "soft-edge-style";

export function parseEdgeStyle(raw: string | null): EdgeStyle {
  return raw === "fast" || raw === "gradient" ? raw : "blur";
}

let current: EdgeStyle | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(EDGE_STYLE_KEY);
  } catch {
    return null;
  }
}

/** This device's style, read once and kept, so the painter can ask for every edge it draws */
export function edgeStyle(): EdgeStyle {
  if (current) return current;
  if (typeof window === "undefined") return "blur";
  current = parseEdgeStyle(readRaw());
  return current;
}

/** The raw stored value, for useSyncExternalStore */
export function edgeStyleSnapshot(): EdgeStyle {
  return edgeStyle();
}

/** Puts the style on <html> for the CSS path (globals.css hides the blur layers for `gradient`) */
export function applyEdgeStyle() {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.edgeStyle = edgeStyle();
}

export function setEdgeStyle(style: EdgeStyle) {
  try {
    if (style === "blur") localStorage.removeItem(EDGE_STYLE_KEY);
    else localStorage.setItem(EDGE_STYLE_KEY, style);
  } catch {}
  current = style;
  applyEdgeStyle();
  // the painted page rebuilds on a body mutation, so the new style shows without a scroll
  document.body.dataset.edgeStyle = style;
  window.dispatchEvent(new Event(EVENT));
}

export function onEdgeStyleChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
