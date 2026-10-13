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
      className="pointer-events-none fixed inset-x-2 top-[calc(env(safe-area-inset-top,0px)+60px)] z-[100] max-h-[60vh] overflow-hidden whitespace-pre-wrap rounded-xl bg-black/80 p-2 font-mono text-[10px] leading-[13px] text-white"
    >
      {[
        `html.gpu ${gpu}  phase ${s.phase}  frames ${s.frames}`,
        `adapter ${s.adapter || "?"}`,
        s.error ? `error ${s.error}` : "error none",
        ...s.entries.map((e) => `${e.family} ${e.laidOut ? "on" : "off"} ${e.compile}  ${e.label}`),
      ].join("\n")}
    </pre>
  );
}
