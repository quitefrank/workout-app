/**
 * The app scrolls one element, never the window, as the Glass Lab's app mode does: `html` and `body` are locked and
 * the screens scroll inside `[data-app-scroller]` (src/components/app-scroller.tsx). The glass canvas and the pinned
 * bars sit over it as siblings, so iOS's rubber-band bounce and its handling of fixed elements during a window scroll
 * move the content and never the glass.
 */
export const SCROLLER = "[data-app-scroller]";

export function appScroller(): HTMLElement | null {
  return typeof document === "undefined" ? null : document.querySelector<HTMLElement>(SCROLLER);
}

/** How far the screen has scrolled, in px */
export function scrollTop(): number {
  return appScroller()?.scrollTop ?? 0;
}

/**
 * While the keyboard is up iOS keeps the layout viewport at full height and slides the visual viewport over it, and
 * fixed elements stay with the layout viewport, so the pinned bars and the glass canvas slide off the screen. This
 * writes the slide (`visualViewport.offsetTop`) to `--vv-top` and the visible height to `--vv-h` on <html>, and sets
 * `keyboard` while the visible height is well short of the layout's. globals.css moves the pinned layer back by the
 * slide and fits the scroller to what is visible, always scrollable, so a drag scrolls the list and never slides the
 * viewport; a drag that starts outside any scroller is held still. iOS's own slide to reveal the focused field is left
 * alone: undoing it fights iOS on every frame and shakes the screen.
 */
export function followVisualViewport(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const html = document.documentElement;
  const update = () => {
    html.style.setProperty("--vv-top", `${Math.max(0, Math.round(vv.offsetTop))}px`);
    html.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
    html.classList.toggle("keyboard", vv.height < html.clientHeight - 100);
  };
  const hold = (e: TouchEvent) => {
    if (!html.classList.contains("keyboard")) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t?.closest(`${SCROLLER}, .glass-sheet`)) e.preventDefault();
  };
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  document.addEventListener("touchmove", hold, { passive: false });
  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
    document.removeEventListener("touchmove", hold);
    html.style.removeProperty("--vv-top");
    html.style.removeProperty("--vv-h");
    html.classList.remove("keyboard");
  };
}
