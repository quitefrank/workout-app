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
 * writes the slide (`visualViewport.offsetTop`) to `--vv-top` and the visible height to `--vv-h` on <html>; the pinned
 * layer is moved back by `--vv-top` in globals.css. It also puts back any window scroll, since the window never scrolls.
 */
export function followVisualViewport(): () => void {
  const vv = window.visualViewport;
  if (!vv) return () => {};
  const root = document.documentElement.style;
  const update = () => {
    if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
    root.setProperty("--vv-top", `${Math.max(0, Math.round(vv.offsetTop))}px`);
    root.setProperty("--vv-h", `${Math.round(vv.height)}px`);
  };
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
    root.removeProperty("--vv-top");
    root.removeProperty("--vv-h");
  };
}
