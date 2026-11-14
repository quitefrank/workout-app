/**
 * How row thumbnails crop their illustration (Frank's calls, 2026-11-14: the whole body at 48pt is too small to read,
 * then "try both" for zooming toward the red highlight). A test setting per device, to see the crop before the images
 * are edited and small thumbnails generated. Large art (the exercise sheet's hero, an exercise's page) never zooms.
 *
 * - Centred: scale about the image's centre.
 * - On the muscle: the same scale, panned so the highlight is centred, stopping at the image's edges.
 * - Smart zoom: each image zooms until its highlight with a margin fills 60% of the tile (capped at 2.5x), panned the same.
 *
 * Thumbnails are off by default (Frank's call, 2026-11-14, until the performance levers are settled): the row shows its
 * plain tile and the image, lazy and `display: none`, is never fetched. `thumbs_on` turns them on (`data-thumbs` on body).
 *
 * <body> carries `--thumb-zoom` and `data-thumb-mode`; each thumbnail carries its image's `--fx`, `--fy`, `--fz` from
 * src/lib/exercise-image-focus.ts (`thumbFocusStyle`). `.thumb-zoom` in globals.css turns them into a `transform`,
 * which the glass painter draws.
 */

import type { CSSProperties } from "react";
import { EXERCISE_IMAGE_FOCUS } from "@/lib/exercise-image-focus";

export type ThumbMode = "1" | "1.5" | "2" | "focus-1.5" | "focus-2" | "smart";

export const THUMB_ZOOMS: ReadonlyArray<readonly [ThumbMode, string]> = [
  ["1", "Full body"],
  ["1.5", "1.5x centred"],
  ["2", "2x centred"],
  ["focus-1.5", "1.5x on the muscle"],
  ["focus-2", "2x on the muscle"],
  ["smart", "Smart zoom"],
];

export const THUMB_ZOOM_KEY = "thumb_zoom";
export const THUMBS_ON_KEY = "thumbs_on";
const EVENT = "thumb-zoom";

export function parseThumbZoom(raw: string | null): ThumbMode {
  return THUMB_ZOOMS.find(([m]) => m === raw)?.[0] ?? "1";
}

/** The fixed scale and how it is placed, for a mode */
export function thumbModeParts(mode: ThumbMode): { scale: number; place: "centre" | "focus" | "smart" } {
  if (mode === "smart") return { scale: 1, place: "smart" };
  if (mode.startsWith("focus-")) return { scale: Number(mode.slice(6)), place: "focus" };
  return { scale: Number(mode), place: "centre" };
}

export const parseThumbsOn = (raw: string | null) => raw === "1";

export function thumbsOn(): boolean {
  try {
    return parseThumbsOn(localStorage.getItem(THUMBS_ON_KEY));
  } catch {
    return false;
  }
}

export function setThumbsOn(on: boolean) {
  try {
    if (on) localStorage.setItem(THUMBS_ON_KEY, "1");
    else localStorage.removeItem(THUMBS_ON_KEY);
  } catch {}
  applyThumbZoom();
  window.dispatchEvent(new Event(EVENT));
}

export function thumbZoom(): ThumbMode {
  try {
    return parseThumbZoom(localStorage.getItem(THUMB_ZOOM_KEY));
  } catch {
    return "1";
  }
}

/** Puts this device's mode on <body> (a body mutation also rebuilds the painted page) */
export function applyThumbZoom() {
  if (typeof document === "undefined") return;
  const { scale, place } = thumbModeParts(thumbZoom());
  const b = document.body;
  if (thumbsOn()) b.dataset.thumbs = "on";
  else delete b.dataset.thumbs;
  if (scale === 1) b.style.removeProperty("--thumb-zoom");
  else b.style.setProperty("--thumb-zoom", String(scale));
  if (place === "centre") delete b.dataset.thumbMode;
  else b.dataset.thumbMode = place;
}

export function setThumbZoom(mode: ThumbMode) {
  try {
    if (mode === "1") localStorage.removeItem(THUMB_ZOOM_KEY);
    else localStorage.setItem(THUMB_ZOOM_KEY, mode);
  } catch {}
  applyThumbZoom();
  window.dispatchEvent(new Event(EVENT));
}

export function onThumbZoomChange(fn: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** The image's highlight as custom properties for `.thumb-zoom`; none when the image has no focus (it stays centred) */
export function thumbFocusStyle(imageSlug: string | null): CSSProperties | undefined {
  const f = imageSlug ? EXERCISE_IMAGE_FOCUS[imageSlug] : undefined;
  if (!f) return undefined;
  return { "--fx": f[0], "--fy": f[1], "--fz": f[2] } as CSSProperties;
}
