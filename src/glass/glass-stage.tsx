"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { appearance as currentAppearance, onAppearanceChange } from "@/lib/appearance";
import { scrollTop } from "@/lib/scroller";
import { debugState } from "./debug-state";
import { buildDisplayList, UNPAINTED, type DisplayList } from "./paint/display-list";
import { paintList } from "./paint/paint";
import { createFamily, PRESET1_BARS, PRESET1_LIGHT, SHEET_DARK, SHEET_LIGHT } from "./presets";

const unpainted = (n: EventTarget | Node | null | undefined) => {
  const el = n instanceof Element ? n : n instanceof Node ? n.parentElement : null;
  return !!el?.closest(UNPAINTED);
};
/**
 * The stage's height: the large viewport (Safari's toolbar collapsed), measured once per start, so the canvas still
 * covers the page when the toolbar collapses and the viewport grows. The canvas is fixed at the top; on a screen whose
 * toolbar is showing, the extra height simply sits below the viewport.
 */
function largeViewportHeight() {
  let lvh = 0;
  if (typeof CSS !== "undefined" && CSS.supports?.("height", "100lvh")) {
    const probe = document.createElement("div");
    probe.style.cssText = "position:fixed;top:0;left:0;width:0;height:100lvh;visibility:hidden;pointer-events:none";
    document.documentElement.appendChild(probe);
    lvh = probe.getBoundingClientRect().height;
    probe.remove();
  }
  return Math.ceil(Math.max(window.innerHeight, lvh || Math.max(window.innerHeight, window.screen?.height || 0)));
}
const stageDpr = () => Math.min(window.devicePixelRatio || 1, 3);

const ANIM_EVENTS = ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend", "animationcancel"];

/**
 * The Glass Lab's renderer over the app. The page's HTML stays where it is (layout, taps, VoiceOver); this canvas sits
 * over it, opaque, with pointer-events off, and shows the page painted from that HTML with every glass element drawn by
 * the lab's shader. The glass elements' own labels and the live inputs sit above the canvas. Without WebGPU nothing
 * happens and the CSS material stays.
 */
export function GlassStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const bumpRef = useRef<() => void>(() => {});

  useEffect(() => {
    bumpRef.current();
  }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const gpu = (navigator as Navigator & { gpu?: { requestAdapter: () => Promise<unknown> } }).gpu;
    if (!canvas || !gpu) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let generation = 0;
    let list: DisplayList | null = null;
    let builtAt = "";
    // the size the current stage was built at; a resize within it (Safari's toolbar) only repaints
    let size: { W: number; H: number; dpr: number } | null = null;
    // the page signature's counters: DOM changes, inner scrollers moving, animation frames
    let dirty = 0, inner = 0, animTick = 0;
    let animating = false, rebuildFrame = false;
    const html = document.documentElement;
    const appearance = currentAppearance;
    const bars = createFamily(PRESET1_BARS, PRESET1_LIGHT, appearance());
    const sheet = createFamily(SHEET_DARK, SHEET_LIGHT, appearance());
    const bump = () => { dirty++; list = null; };
    bumpRef.current = bump;

    const observer = new MutationObserver((records) => {
      const ignorable = (r: MutationRecord) =>
        // the stage's own class writes on units are not page changes, nor is anything inside unpainted elements
        (r.type === "attributes" && r.attributeName === "class" && (r.target as Element).matches?.("[data-glass-unit]")) ||
        (r.type !== "childList" && unpainted(r.target));
      if (records.every(ignorable)) return;
      bump();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });

    // Transitions and animations on the page repaint it every frame and rebuild the list every other frame, until
    // none is running; the sheet sliding and glass press states never touch the painted page, so they are ignored
    const onAnim = (e: Event) => { if (!unpainted(e.target)) animating = true; };
    ANIM_EVENTS.forEach((t) => document.addEventListener(t, onAnim, true));
    const stillAnimating = () =>
      document.getAnimations().some((a) => a.playState === "running" && !unpainted((a.effect as KeyframeEffect | null)?.target));
    // a horizontal rail scrolling moves content under the glass: the painter follows it without a rebuild
    const onInnerScroll = (e: Event) => { if (e.target !== document && !unpainted(e.target)) inner++; };
    document.addEventListener("scroll", onInnerScroll, true);
    // Inputs are painted at rest. Focus moving in or out changes which one is painted; a value set by script (React
    // clearing Reps after a set is logged) fires no event and no mutation, so the painted inputs' values are part of the
    // signature. The focused one is left out, so typing does not rebuild the page on every key.
    let painted: HTMLInputElement[] = [], paintedValues = "";
    const PAINTED_INPUTS = "input[data-live]";
    const onFocusMove = (e: Event) => { if ((e.target as Element | null)?.matches?.(PAINTED_INPUTS)) bump(); };
    document.addEventListener("focusin", onFocusMove, true);
    document.addEventListener("focusout", onFocusMove, true);
    const onAppearance = () => { bars.setAppearance(appearance()); sheet.setAppearance(appearance()); bump(); };
    const stopAppearance = onAppearanceChange(onAppearance);
    const fonts = document.fonts;
    fonts?.ready.then(() => { if (!cancelled) bump(); });
    fonts?.addEventListener("loadingdone", bump);

    // a lost device gets one fresh start (once the tab is visible again), and another only after that start succeeded
    let retryAllowed = true, retryTimer = 0;
    const retryWhenVisible = () => {
      if (document.visibilityState !== "visible" || cancelled) return;
      document.removeEventListener("visibilitychange", retryWhenVisible);
      retryTimer = window.setTimeout(() => { if (!cancelled) { bump(); void start(); } }, 500);
    };
    const fail = (err: unknown, deviceLost = false) => {
      if (cancelled) return;
      console.warn("No WebGPU glass here, keeping the CSS material:", err);
      debugState.phase = deviceLost ? "device lost" : "failed";
      debugState.error = String((err as Error)?.stack ?? (err as Error)?.message ?? err).slice(0, 400);
      generation++;
      stop?.(); stop = null; size = null;
      html.classList.remove("gpu");
      if (deviceLost && retryAllowed) {
        retryAllowed = false;
        document.addEventListener("visibilitychange", retryWhenVisible);
        retryWhenVisible();
      }
    };

    const start = async () => {
      const gen = ++generation;
      try {
        // without an adapter three would fall back to WebGL; the CSS material stays instead, quietly
        debugState.phase = "adapter";
        const adapter = (await gpu.requestAdapter()) as { info?: { vendor?: string; architecture?: string } } | null;
        if (!adapter) { debugState.phase = "no adapter"; return; }
        debugState.adapter = `${adapter.info?.vendor ?? ""} ${adapter.info?.architecture ?? ""}`.trim() || "yes";
        debugState.phase = "loading three";
        const [THREE, T, { startStage }] = await Promise.all([import("three/webgpu"), import("three/tsl"), import("./engine/stage")]);
        if (cancelled || gen !== generation) return;
        const W = window.innerWidth, H = largeViewportHeight(), dpr = stageDpr();
        size = { W, H, dpr };
        debugState.phase = "init";
        debugState.stage = `${W}x${H}@${dpr}`;
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        const s = await startStage({
          THREE, T, canvas, W, H, dpr, bars, sheet, appearance,
          draw: (c, origin) => {
            const at = String(scrollTop());
            // a sticky element's place depends on the scroll; while the page animates, every other frame rebuilds
            if (list && list.sticky && builtAt !== at) list = null;
            if (list && animating && (rebuildFrame = !rebuildFrame)) list = null;
            if (!list) {
              list = buildDisplayList(document.body, bump); builtAt = at;
              painted = Array.from(document.querySelectorAll<HTMLInputElement>(PAINTED_INPUTS)).filter((el) => !unpainted(el.parentElement));
            }
            paintList(c, list, window.scrollX, window.scrollY, W, H, origin);
            if (list.pending) list = null;
          },
          signature: () => {
            if (animating) {
              if (stillAnimating()) animTick++;
              else { animating = false; bump(); }
            }
            const values = painted.map((el) => (el === document.activeElement ? "" : el.value)).join("\u0000");
            if (values !== paintedValues) { paintedValues = values; bump(); }
            // the keyboard's slide moves every rect on screen without a scroll (src/lib/scroller.ts)
            const vv = window.visualViewport;
            return `${window.scrollX}|${window.scrollY}|${scrollTop()}|${vv?.offsetTop}|${vv?.height}|${dirty}|${inner}|${animTick}|${appearance()}`;
          },
          // the CSS material steps aside only once the shader has every glass element on screen built
          onReady: () => {
            if (cancelled || gen !== generation) return;
            retryAllowed = true;
            debugState.phase = "ready";
            html.classList.add("gpu");
            bump();
          },
          onError: (err, deviceLost) => { if (gen === generation) fail(err, deviceLost); },
        });
        if (cancelled || gen !== generation) { s(); return; }
        stop = s;
        if (debugState.phase === "init") debugState.phase = "waiting for shaders";
      } catch (err) {
        if (gen === generation) fail(err);
      }
    };
    void start();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => {
        // Safari's toolbar collapsing changes only the height, and the stage was built to the large viewport: repaint
        if (size && window.innerWidth === size.W && stageDpr() === size.dpr && window.innerHeight <= size.H) { bump(); return; }
        // the CSS material holds the screen while the new stage builds its shaders; onReady hands it back
        generation++; stop?.(); stop = null; size = null; html.classList.remove("gpu"); bump(); void start();
      }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      generation++;
      stop?.();
      html.classList.remove("gpu");
      bumpRef.current = () => {};
      observer.disconnect();
      ANIM_EVENTS.forEach((t) => document.removeEventListener(t, onAnim, true));
      document.removeEventListener("scroll", onInnerScroll, true);
      document.removeEventListener("focusin", onFocusMove, true);
      document.removeEventListener("focusout", onFocusMove, true);
      stopAppearance();
      fonts?.removeEventListener("loadingdone", bump);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, []);

  return <canvas ref={canvasRef} data-glass-canvas aria-hidden className="glass-canvas" />;
}
