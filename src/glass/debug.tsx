"use client";

import { useEffect, useState } from "react";
import { debugState } from "./debug-state";

/**
 * A readout of the glass renderer's state, for checking it on the phone where there is no console. Off unless the URL
 * carries `?glassdebug=1` (remembered in this browser; `?glassdebug=0` turns it off).
 */

const KEY = "glassdebug";

export function debugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get(KEY);
    if (q === "1") localStorage.setItem(KEY, "1");
    if (q === "0") localStorage.removeItem(KEY);
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function GlassDebug() {
  const [on, setOn] = useState(false);
  const [, setTick] = useState(0);
  useEffect(() => {
    const tick = () => { setOn(debugEnabled()); setTick((t) => t + 1); };
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 500);
    // the keyboard coming up or going changes what the readout shows; a short wait lets the viewport settle
    const soon = () => window.setTimeout(tick, 350);
    document.addEventListener("focusin", soon);
    document.addEventListener("focusout", soon);
    return () => {
      window.clearTimeout(first); window.clearInterval(id);
      document.removeEventListener("focusin", soon); document.removeEventListener("focusout", soon);
    };
  }, []);
  if (!on) return null;
  const s = debugState;
  const gpu = typeof document !== "undefined" && document.documentElement.classList.contains("gpu");
  const g = geometry();
  // iOS lifts a bottom-pinned element above the keyboard, so while a field has focus the readout shrinks to the viewport
  // lines, small enough to sit between the keyboard and the top bar
  const typing = !!document.activeElement?.matches("input, textarea, select");
  const lines = typing
    ? [`html.gpu ${gpu}  phase ${s.phase}`, g.inner, g.vv, g.canvas, g.window]
    : [
        `html.gpu ${gpu}  phase ${s.phase}  frames ${s.frames}`,
        `adapter ${s.adapter || "?"}  stage ${s.stage || "?"}`,
        g.inner, g.vv, g.canvas, g.window, g.bars,
        s.error ? `error ${s.error}` : "error none",
        ...s.entries.map((e) => `${e.family} ${e.laidOut ? "on" : "off"} ${e.compile}  ${e.label}`),
      ];
  return (
    <pre
      // fixed over the canvas already, so it takes no live lift (whose position: relative would pull it to the top)
      data-glass-debug
      // at the bottom, over the dock, so it never covers the top bar or the search field
      // while typing, just above the keyboard: the top of what is on screen plus its height (src/lib/scroller.ts)
      style={typing ? { top: "calc(var(--vv-h, 100vh) - 84px)" } : { bottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
      className={`pointer-events-none fixed inset-x-2 z-[100] overflow-hidden whitespace-pre-wrap rounded-xl bg-black/80 p-2 font-mono text-white ${typing ? "text-[9px] leading-[11px]" : "max-h-[45vh] text-[10px] leading-[13px]"}`}
    >
      {lines.join("\n")}
    </pre>
  );
}

const r = (el: Element | null) => {
  if (!el) return "none";
  const b = el.getBoundingClientRect();
  return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`;
};

const focused = () => {
  const el = document.activeElement;
  if (!el || el === document.body) return "none";
  return `${el.tagName.toLowerCase()}${el.getAttribute("aria-label") ? ` "${el.getAttribute("aria-label")}"` : ""} ${r(el)}`;
};

/** Where the browser puts the viewport, the canvas and the pinned bars, to line the glass up on the phone */
function geometry() {
  const vv = window.visualViewport;
  const canvas = document.querySelector<HTMLCanvasElement>("[data-glass-canvas]");
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
  document.documentElement.appendChild(probe);
  const cs = getComputedStyle(probe);
  const safe = `${cs.paddingTop} / ${cs.paddingBottom}`;
  probe.remove();
  return {
    inner: `inner ${window.innerWidth}x${window.innerHeight}  client ${document.documentElement.clientHeight}  screen ${window.screen.height}  gap ${getComputedStyle(document.documentElement).getPropertyValue("--screen-gap") || "0"}  scroll ${Math.round(document.querySelector("[data-app-scroller]")?.scrollTop ?? 0)}`,
    vv: `vv ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} off ${Math.round(vv.offsetTop)} page ${Math.round(vv.pageTop)} scale ${vv.scale}` : "none"}  safe ${safe}`,
    canvas: `canvas ${r(canvas)} buffer ${canvas?.width}x${canvas?.height}`,
    // the keyboard check: iOS may scroll the window or pan the visual viewport on focus though the window never scrolls
    window: `window scroll ${Math.round(window.scrollX)},${Math.round(window.scrollY)}  focus ${focused()}`,
    bars: `topbar ${r(document.querySelector("[data-glass-unit='top'] .glass"))}  dock ${r(document.querySelector("[data-glass-unit='dock'] .glass"))}`,
  };
}
