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

/**
 * Scroll just enough that an element sits clear of the floating bottom layer (the dock, or the active workout's
 * Finish bar), without pushing its top under the pinned top bar. Called after something opens, so what opened is
 * never under the bar.
 */
export function revealAboveDock(el: HTMLElement | null, topClearance = 110): void {
  const scroller = appScroller();
  // only what scrolls with the page; a sheet has its own scroll and covers the dock
  if (!el || !scroller || !scroller.contains(el)) return;
  const dock = document.querySelector<HTMLElement>('[data-glass-unit="dock"]');
  const limit = (dock?.getBoundingClientRect().top ?? window.innerHeight) - 12;
  const r = el.getBoundingClientRect();
  const shift = Math.min(r.bottom - limit, r.top - topClearance);
  if (shift > 0) scroller.scrollBy({ top: shift, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
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
  // A home screen app (iOS 26) flips its window between the full screen and 50pt short of it with nothing touched, so
  // the pinned layer is placed from the top with the screen's height, which never changes (the app is portrait only).
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) {
    html.classList.add("standalone");
    html.style.setProperty("--screen-h", `${window.screen.height}px`);
  }
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
  // The window never scrolls, but iOS ignores overflow: hidden when it reveals a focused field, and a home screen
  // app's 50pt-short window leaves the 812pt scroller 50pt of overhang to scroll. The caret stays where it was drawn
  // before that scroll, 50pt off. So the window goes back to 0 once a frame (never a loop with iOS's own animation),
  // and the caret is redrawn once per focus by setting the same selection again. vv.offsetTop is left alone (above).
  let resetFrame = 0;
  let reasserted: Element | null = null;
  const resetWindow = () => {
    resetFrame = 0;
    if (window.scrollY === 0 && window.scrollX === 0) return;
    window.scrollTo(0, 0);
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el !== reasserted) {
      reasserted = el;
      requestAnimationFrame(() => {
        const { selectionStart: start, selectionEnd: end } = el;
        if (document.activeElement === el && start !== null && end !== null) el.setSelectionRange(start, end);
      });
    }
  };
  const onWindowScroll = () => {
    if (!resetFrame) resetFrame = requestAnimationFrame(resetWindow);
  };
  const onFocusOut = () => {
    reasserted = null;
  };
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  window.addEventListener("scroll", onWindowScroll, { passive: true });
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("touchmove", hold, { passive: false });
  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
    window.removeEventListener("scroll", onWindowScroll);
    document.removeEventListener("focusout", onFocusOut);
    cancelAnimationFrame(resetFrame);
    document.removeEventListener("touchmove", hold);
    html.style.removeProperty("--vv-top");
    html.style.removeProperty("--vv-h");
    html.style.removeProperty("--screen-h");
    html.classList.remove("standalone");
    html.classList.remove("keyboard");
  };
}
