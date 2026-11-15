"use client";

import { useEffect, useState } from "react";
import { debugState, p50p95 } from "./debug-state";
import { startTrace } from "@/lib/trace";
import { describe as describePerf, parseStored, perfSnapshot } from "@/lib/perf-flags";

/**
 * A readout of the glass renderer's state, for checking it on the phone where there is no console. Off unless the URL
 * carries `?glassdebug=1` when the page loads (it stays on across screens until the next load), or while Settings >
 * Developer has it on for this device.
 */

const KEY = "glassdebug";

// The Developer switch in Settings, kept on this device (the home screen app has no address bar to type the link in)
const SETTING = "glass-debug-setting";

export function debugSetting(): boolean {
  try { return localStorage.getItem(SETTING) === "1"; } catch { return false; }
}

export function setDebugSetting(on: boolean) {
  try { if (on) localStorage.setItem(SETTING, "1"); else localStorage.removeItem(SETTING); } catch {}
}

// The link decides once per page load and holds while moving between screens (they change the URL without reloading)
let fromLink: boolean | null = null;

export function debugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  if (fromLink === null) {
    fromLink = new URLSearchParams(window.location.search).get(KEY) === "1";
    // the link's setting once lived in localStorage and outlived the link
    try { localStorage.removeItem(KEY); } catch {}
  }
  return fromLink || debugSetting();
}

// Per-second rates of what the stage did, from the counters between two readout ticks (the performance levers): frames
// the loop ran, composites drawn, page paints and display-list rebuilds. At rest with `idle` on, all but frames read 0.
let lastRates = { t: 0, frames: 0, renders: 0, paints: 0, rebuilds: 0, uploaded: 0, plan: { full: 0, strip: 0, move: 0 } };
const fmt = (q: [number, number] | null) => (q ? `${q[0]}/${q[1]}ms` : "-");
let rates = "";
function rateLine(): string {
  const now = performance.now(), s = debugState;
  if (lastRates.t && now - lastRates.t >= 400) {
    const k = 1000 / (now - lastRates.t);
    const r = (a: number, b: number) => Math.round((a - b) * k);
    const mb = ((s.uploaded - lastRates.uploaded) * k) / 1e6;
    const p = s.plan, lp = lastRates.plan;
    rates = `per s  frames ${r(s.frames, lastRates.frames)}  renders ${r(s.renders, lastRates.renders)}  paints ${r(s.paints, lastRates.paints)}  rebuilds ${r(s.rebuilds, lastRates.rebuilds)}  up ${mb.toFixed(1)}MB` +
      `\nplan full ${r(p.full, lp.full)} strip ${r(p.strip, lp.strip)} move ${r(p.move, lp.move)}  draw ${fmt(p50p95(s.drawMs))}  gpu lag ${fmt(p50p95(s.gpuLagMs))}`;
  }
  if (!lastRates.t || now - lastRates.t >= 400) lastRates = { t: now, frames: s.frames, renders: s.renders, paints: s.paints, rebuilds: s.rebuilds, uploaded: s.uploaded, plan: { ...s.plan } };
  const changed = describePerf(parseStored(perfSnapshot()));
  return `${rates || "per s  measuring\n"}\nperf ${changed || "defaults"}`;
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
  // the temporary frame recorder for the stepper keyboard bug runs while the readout is on
  useEffect(() => (on ? startTrace() : undefined), [on]);
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
        // only what fits in the status bar's band: the rates, the stage's state and any error
        rateLine(),
        `gpu ${gpu}  phase ${s.phase}  stage ${s.stage || "?"}  ${s.error ? `error ${s.error}` : "no error"}`,
      ];
  return (
    <pre
      // fixed over the canvas already, so it takes no live lift (whose position: relative would pull it to the top)
      data-glass-debug
      // In the status bar's band at the top, over no control, and never takes a tap (Frank's call, 2026-11-14: above the
      // tab bar it still blocked what was behind it). Five 11pt lines end at the band's bottom.
      // while typing, just above the keyboard: the top of what is on screen plus its height (src/lib/scroller.ts)
      style={
        typing
          ? { top: "calc(var(--vv-h, 100vh) - 84px)" }
          : { top: 0, height: "max(env(safe-area-inset-top), 55px)", paddingTop: "max(env(safe-area-inset-top) - 55px, 0px)" }
      }
      className={`pointer-events-none fixed inset-x-0 z-[100] overflow-hidden whitespace-pre bg-black/75 font-mono text-white ${typing ? "mx-2 rounded-xl p-2 text-[9px] leading-[11px]" : "px-2 text-[9px] leading-[11px]"}`}
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
    inner: `inner ${window.innerWidth}x${window.innerHeight}  client ${document.documentElement.clientHeight}  screen ${window.screen.height}  screen-h ${getComputedStyle(document.documentElement).getPropertyValue("--screen-h") || "none"}  scroll ${Math.round(document.querySelector("[data-app-scroller]")?.scrollTop ?? 0)}`,
    vv: `vv ${vv ? `${Math.round(vv.width)}x${Math.round(vv.height)} off ${Math.round(vv.offsetTop)} page ${Math.round(vv.pageTop)} scale ${vv.scale}` : "none"}  safe ${safe}`,
    canvas: `canvas ${r(canvas)} buffer ${canvas?.width}x${canvas?.height}`,
    // the keyboard check: iOS may scroll the window or pan the visual viewport on focus though the window never scrolls
    window: `window scroll ${Math.round(window.scrollX)},${Math.round(window.scrollY)}  focus ${focused()}`,
    bars: `topbar ${r(document.querySelector("[data-glass-unit='top'] .glass"))}  dock ${r(document.querySelector("[data-glass-unit='dock'] .glass"))}`,
  };
}
