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
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, []);
  if (!on) return null;
  const s = debugState;
  const gpu = typeof document !== "undefined" && document.documentElement.classList.contains("gpu");
  return (
    <pre
      data-live
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 60px)" }}
      className="pointer-events-none fixed inset-x-2 z-[100] max-h-[60vh] overflow-hidden whitespace-pre-wrap rounded-xl bg-black/80 p-2 font-mono text-[10px] leading-[13px] text-white"
    >
      {[
        `html.gpu ${gpu}  phase ${s.phase}  frames ${s.frames}`,
        `adapter ${s.adapter || "?"}  stage ${s.stage || "?"}`,
        ...geometry(),
        s.error ? `error ${s.error}` : "error none",
        ...s.entries.map((e) => `${e.family} ${e.laidOut ? "on" : "off"} ${e.compile}  ${e.label}`),
      ].join("\n")}
    </pre>
  );
}

const r = (el: Element | null) => {
  if (!el) return "none";
  const b = el.getBoundingClientRect();
  return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)}`;
};

/** Where the browser puts the viewport, the canvas and the pinned bars, to line the glass up on the phone */
function geometry(): string[] {
  const vv = window.visualViewport;
  const canvas = document.querySelector<HTMLCanvasElement>("[data-glass-canvas]");
  const probe = document.createElement("div");
  probe.style.cssText = "position:fixed;top:0;left:0;width:0;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom);visibility:hidden";
  document.documentElement.appendChild(probe);
  const cs = getComputedStyle(probe);
  const safe = `${cs.paddingTop} / ${cs.paddingBottom}`;
  probe.remove();
  return [
    `inner ${window.innerWidth}x${window.innerHeight}  client ${document.documentElement.clientHeight}  screen ${window.screen.height}  scroll ${Math.round(document.querySelector("[data-app-scroller]")?.scrollTop ?? 0)}`,
    `vv ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} off ${Math.round(vv.offsetTop)} page ${Math.round(vv.pageTop)} scale ${vv.scale}` : "none"}  safe ${safe}`,
    `canvas ${r(canvas)} buffer ${canvas?.width}x${canvas?.height}`,
    `topbar ${r(document.querySelector("[data-glass-unit='top'] .glass"))}  dock ${r(document.querySelector("[data-glass-unit='dock'] .glass"))}`,
  ];
}
