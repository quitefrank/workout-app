/**
 * How far row thumbnails zoom into their illustration (Frank's call, 2026-11-14: the whole body at 48pt is too small to
 * read). A test setting per device, to see the crop before the images are edited and small thumbnails generated. The
 * zoom is `--thumb-zoom` on <body>, read by `.thumb-zoom` (globals.css) as `scale` about the image's centre; the
 * container clips it, and the glass painter draws `scale` and the clip, so both paths show the same crop. Large art (the
 * exercise sheet's hero, an exercise's page) is never zoomed.
 */

export const THUMB_ZOOMS: ReadonlyArray<readonly [number, string]> = [
  [1, "Full body"],
  [1.5, "1.5x"],
  [2, "2x"],
];

export const THUMB_ZOOM_KEY = "thumb_zoom";
const EVENT = "thumb-zoom";

export function parseThumbZoom(raw: string | null): number {
  const v = Number(raw);
  return THUMB_ZOOMS.some(([z]) => z === v) ? v : 1;
}

export function thumbZoom(): number {
  try {
    return parseThumbZoom(localStorage.getItem(THUMB_ZOOM_KEY));
  } catch {
    return 1;
  }
}

/** Puts this device's zoom on <body> (a body mutation also rebuilds the painted page) */
export function applyThumbZoom() {
  if (typeof document === "undefined") return;
  const z = thumbZoom();
  if (z === 1) document.body.style.removeProperty("--thumb-zoom");
  else document.body.style.setProperty("--thumb-zoom", String(z));
}

export function setThumbZoom(z: number) {
  try {
    if (z === 1) localStorage.removeItem(THUMB_ZOOM_KEY);
    else localStorage.setItem(THUMB_ZOOM_KEY, String(z));
  } catch {}
  applyThumbZoom();
  window.dispatchEvent(new Event(EVENT));
}

export function onThumbZoomChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}
