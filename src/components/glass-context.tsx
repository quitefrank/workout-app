"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { decideDark } from "@/glass/context";
import { parseColor, type Rgba } from "@/glass/paint/css";
import { CTXV } from "@/glass/presets";

/**
 * The glass context rule (CLAUDE.md, "Glass context rule"; the lab's
 * `UNITS` and `stepContext`). Each unit reads the luminance of the page
 * behind it and takes the material's dark or light side: dark below
 * 0.40, light again above 0.50, 0.45 on the first read.
 *
 * Units: an element marked `data-glass-unit="top" | "dock" | "box"`, and
 * every `.glass` outside one (a lone control is its own unit). A top bar
 * reads the band from the screen edge to 34pt past the bar, the dock
 * from 20pt above its glass to the screen bottom, anything else the box
 * round its controls. A unit with `data-edge="dim"` sits on media and is
 * always dark.
 *
 * The lab averages page pixels. A page cannot read its own pixels, so
 * this samples the DOM on a grid: at each point, the first element
 * under the glass with a solid background colour, a solid gradient, or
 * a `data-lum` value gives the luminance. Luminance is sRGB, not
 * linearised, as in the lab.
 */

const CELL = 12;
/** Preset 1 dark side: Haze level = hazeL + avg x hazeAdapt, at Haze 0.5 with black lift 1 */
const HAZE = { amount: 0.5, level: 0.2, adapt: 0.7 };

type Band = { x0: number; x1: number; y0: number; y1: number };

const state = new WeakMap<Element, boolean>();

export function GlassContext() {
  const pathname = usePathname();

  useEffect(() => {
    let frame = 0;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(run);
    };
    const run = () => {
      frame = 0;
      // the WebGPU stage runs the context rule on the page's own pixels
      if (document.documentElement.classList.contains("gpu")) return;
      document.documentElement.style.setProperty("--scrolled", String(Math.min(1, Math.max(0, window.scrollY / 40))));
      for (const unit of units()) decide(unit);
    };

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const reset = () => {
      // Colours resolve differently per appearance: forget them
      bgCacheClear();
      schedule();
    };
    const observer = new MutationObserver((records) => {
      // The units' own class and haze writes are not page changes
      const own = records.every(
        (r) => r.type === "attributes" && r.target instanceof Element && r.target.matches(".glass, [data-glass-unit]"),
      );
      if (own) return;
      bgCacheClear();
      schedule();
    });
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "style"] });
    // `gpu` leaving <html> (the WebGPU stage stopped) hands the rule back to this sampler
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", reset);
    media.addEventListener("change", reset);
    // Horizontal scrollers (template rows) move content under the glass too
    document.addEventListener("scroll", schedule, { passive: true, capture: true });
    schedule();

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", reset);
      media.removeEventListener("change", reset);
      document.removeEventListener("scroll", schedule, { capture: true });
    };
  }, [pathname]);

  return null;
}

/** Computed colours per element, dropped whenever the DOM or the appearance changes */
const cache = new Map<Element, number | null>();
function bgCacheClear() {
  cache.clear();
}

function units(): HTMLElement[] {
  const marked = Array.from(document.querySelectorAll<HTMLElement>("[data-glass-unit]"));
  const lone = Array.from(document.querySelectorAll<HTMLElement>(".glass")).filter(
    (el) => !el.closest("[data-glass-unit]") && !el.closest("[data-glass-skip]"),
  );
  return [...marked, ...lone];
}

function bandOf(unit: HTMLElement): Band | null {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const kind = unit.dataset.glassUnit ?? "box";
  if (kind === "top") {
    const bar = unit.querySelector<HTMLElement>("[data-glass-bar]") ?? unit;
    return { x0: 0, x1: W, y0: 0, y1: bar.getBoundingClientRect().bottom + CTXV.reach };
  }
  if (kind === "dock") {
    const tops = Array.from(unit.querySelectorAll<HTMLElement>(".glass")).map((g) => g.getBoundingClientRect().top);
    if (!tops.length) return null;
    return { x0: 0, x1: W, y0: Math.min(...tops) - CTXV.dockAbove, y1: H };
  }
  const boxes = (unit.classList.contains("glass") ? [unit] : Array.from(unit.querySelectorAll<HTMLElement>(".glass")))
    .map((g) => g.getBoundingClientRect())
    .filter((r) => r.width > 0 && r.height > 0);
  if (!boxes.length) return null;
  return {
    x0: Math.min(...boxes.map((r) => r.left)),
    x1: Math.max(...boxes.map((r) => r.right)),
    y0: Math.min(...boxes.map((r) => r.top)),
    y1: Math.max(...boxes.map((r) => r.bottom)),
  };
}

function decide(unit: HTMLElement) {
  const band = bandOf(unit);
  if (!band || band.y1 < 0 || band.y0 > window.innerHeight) return;
  const avg = unit.dataset.edge === "dim" ? 0 : average(band);
  if (avg == null) return;

  const was = state.get(unit);
  const onDark = decideDark(was ?? null, avg);
  state.set(unit, onDark);

  // the class is checked as well as the state: the WebGPU stage clears its classes when it stops
  if (was !== onDark || !unit.classList.contains(onDark ? "ctx-dark" : "ctx-light")) {
    unit.classList.toggle("ctx-dark", onDark);
    unit.classList.toggle("ctx-light", !onDark);
  }
  const level = Math.min(1, HAZE.level + avg * HAZE.adapt);
  const lift = (HAZE.amount * level).toFixed(3);
  if (unit.style.getPropertyValue("--haze-lift") !== lift) {
    unit.style.setProperty("--haze-grey", grey(level));
    unit.style.setProperty("--haze-lift", lift);
  }
}

function average(b: Band): number | null {
  const W = window.innerWidth;
  const H = window.innerHeight;
  const x0 = Math.max(0, b.x0);
  const x1 = Math.min(W, b.x1);
  const y0 = Math.max(0, b.y0);
  const y1 = Math.min(H, b.y1);
  if (x1 <= x0 || y1 <= y0) return null;
  const nx = Math.max(2, Math.round((x1 - x0) / CELL));
  const ny = Math.max(2, Math.round((y1 - y0) / CELL));
  let sum = 0;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      sum += lumAt(x0 + ((i + 0.5) * (x1 - x0)) / nx, y0 + ((j + 0.5) * (y1 - y0)) / ny);
    }
  }
  return sum / (nx * ny);
}

function lumAt(x: number, y: number): number {
  for (const el of document.elementsFromPoint(x, y)) {
    if (el.closest(".glass, [data-glass-unit], [data-glass-skip]")) continue;
    const l = lumOf(el);
    if (l != null) return l;
  }
  return pageLum();
}

function lumOf(el: Element): number | null {
  if (cache.has(el)) return cache.get(el)!;
  let l: number | null = null;
  const own = (el as HTMLElement).dataset?.lum;
  if (own != null) l = Number(own);
  else if (el instanceof HTMLImageElement || el instanceof HTMLVideoElement) l = 0.3;
  else {
    const cs = getComputedStyle(el);
    const bg = parseColor(cs.backgroundColor);
    if (bg && bg[3] >= 0.5) l = lum(bg);
    else if (cs.backgroundImage.includes("gradient")) {
      const stops = Array.from(cs.backgroundImage.matchAll(/rgba?\([^)]+\)/g)).map((m) => parseColor(m[0]));
      // Only a solid gradient (the category tiles); a scrim with clear stops is skipped
      if (stops.length && stops.every((s) => s && s[3] >= 0.9)) {
        l = stops.reduce((a, s) => a + lum(s!), 0) / stops.length;
      }
    }
  }
  cache.set(el, l);
  return l;
}

function pageLum(): number {
  return lumOf(document.body) ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? 0 : 1);
}

function lum([r, g, b]: Rgba): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function grey(v: number): string {
  const n = Math.round(v * 255);
  return `rgb(${n} ${n} ${n})`;
}
