"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { buildDisplayList, type DisplayList } from "./paint/display-list";
import { paintList } from "./paint/paint";
import { createFamily, PRESET1_BARS, PRESET1_LIGHT, SHEET_DARK, SHEET_LIGHT } from "./presets";

/** Nothing under these changes the painted page: the painter skips them (glass, the sheet, live inputs, toasts). */
const UNPAINTED = ".glass, .glass-sheet, [data-live], [data-sonner-toaster]";
const unpainted = (n: EventTarget | Node | null | undefined) => {
  const el = n instanceof Element ? n : n instanceof Node ? n.parentElement : null;
  return !!el?.closest(UNPAINTED);
};
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
    // the page signature's counters: DOM changes, inner scrollers moving, animation frames
    let dirty = 0, inner = 0, animTick = 0;
    let animating = false, rebuildFrame = false;
    const html = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const appearance = () => (media.matches ? "dark" : "light") as "dark" | "light";
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
    const onAppearance = () => { bars.setAppearance(appearance()); sheet.setAppearance(appearance()); bump(); };
    media.addEventListener("change", onAppearance);
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
      generation++;
      stop?.(); stop = null;
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
        if (!(await gpu.requestAdapter())) return;
        const [THREE, T, { startStage }] = await Promise.all([import("three/webgpu"), import("three/tsl"), import("./engine/stage")]);
        if (cancelled || gen !== generation) return;
        const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 3);
        canvas.style.width = W + "px"; canvas.style.height = H + "px";
        const s = await startStage({
          THREE, T, canvas, W, H, dpr, bars, sheet, appearance,
          draw: (c) => {
            const at = `${window.scrollX}|${window.scrollY}`;
            // a sticky element's place depends on the scroll; while the page animates, every other frame rebuilds
            if (list && list.sticky && builtAt !== at) list = null;
            if (list && animating && (rebuildFrame = !rebuildFrame)) list = null;
            if (!list) { list = buildDisplayList(document.body, bump); builtAt = at; }
            paintList(c, list, window.scrollX, window.scrollY, W, H);
            if (list.pending) list = null;
          },
          signature: () => {
            if (animating) {
              if (stillAnimating()) animTick++;
              else { animating = false; bump(); }
            }
            return `${window.scrollX}|${window.scrollY}|${dirty}|${inner}|${animTick}|${appearance()}`;
          },
          // the CSS material steps aside only once the shader has every glass element on screen built
          onReady: () => {
            if (cancelled || gen !== generation) return;
            retryAllowed = true;
            html.classList.add("gpu");
            bump();
          },
          onError: (err, deviceLost) => { if (gen === generation) fail(err, deviceLost); },
        });
        if (cancelled || gen !== generation) { s(); return; }
        stop = s;
      } catch (err) {
        if (gen === generation) fail(err);
      }
    };
    void start();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      // the CSS material holds the screen while the new stage builds its shaders; onReady hands it back
      resizeTimer = window.setTimeout(() => { generation++; stop?.(); stop = null; html.classList.remove("gpu"); bump(); void start(); }, 150);
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
      media.removeEventListener("change", onAppearance);
      fonts?.removeEventListener("loadingdone", bump);
      window.removeEventListener("resize", onResize);
      window.clearTimeout(resizeTimer);
      window.clearTimeout(retryTimer);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, []);

  return <canvas ref={canvasRef} data-glass-canvas aria-hidden className="glass-canvas" />;
}
