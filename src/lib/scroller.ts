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
 * How far to lift the focus screen so the focused field sits centred in what the keyboard leaves visible, which is
 * where iOS itself scrolls a field it reveals (measured on the phone, 2026-11-10: a switch between steppers scrolled
 * the field to exactly 196pt above and below it in a 433pt viewport). With the field already there, iOS has nothing
 * to scroll. `restingCenter` is the field's centre with no lift; never down, whole points.
 */
export function focusLift(restingCenter: number, visibleHeight: number): number {
  return Math.max(0, Math.round(restingCenter - visibleHeight / 2));
}

/**
 * iOS draws a field's caret on focus and does not move it when the field moves without an edit; setting the same
 * selection again redraws it where the field now is.
 */
export function redrawCaret(el: HTMLInputElement): void {
  if (document.activeElement !== el) return;
  const { selectionStart: start, selectionEnd: end } = el;
  if (start !== null && end !== null) el.setSelectionRange(start, end);
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
  // The focus screen never scrolls, so the keyboard would cover its steppers. As the keyboard layout guide does, the
  // screen is lifted (--focus-lift, globals.css) until the focused field sits where iOS reveals a field, centred in
  // what is visible, so switching fields moves nothing. A lift glides (a transition on top) and the caret, which iOS
  // does not move with the field, is redrawn when it settles; a scroll iOS makes anyway is absorbed at once (below).
  let lift = 0;
  const focusedField = (): HTMLInputElement | null => {
    const el = document.activeElement;
    return el instanceof HTMLInputElement && el.closest("[data-focus-screen]") ? el : null;
  };
  const setLift = (next: number, snap: boolean) => {
    if (next === lift) return;
    lift = next;
    if (snap) html.classList.add("lift-snap");
    html.style.setProperty("--focus-lift", `${lift}px`);
    if (snap) {
      void getComputedStyle(document.querySelector("[data-focus-screen]") ?? html).top;
      html.classList.remove("lift-snap");
      const el = focusedField();
      if (el) requestAnimationFrame(() => redrawCaret(el));
    }
  };
  const liftFocusScreen = () => {
    if (!html.classList.contains("keyboard")) return setLift(0, false);
    const el = focusedField();
    const screen = el?.closest<HTMLElement>("[data-focus-screen]");
    if (!el || !screen) return;
    const r = el.getBoundingClientRect();
    // measured from the screen's own top, so a lift still gliding does not count
    setLift(focusLift(r.top - screen.getBoundingClientRect().top + r.height / 2, vv.height), false);
  };
  const onLiftSettled = (e: TransitionEvent) => {
    const el = focusedField();
    if (el && e.propertyName === "top" && (e.target as Element).matches?.("[data-focus-screen]")) redrawCaret(el);
  };
  const update = () => {
    html.style.setProperty("--vv-top", `${Math.max(0, Math.round(vv.offsetTop))}px`);
    html.style.setProperty("--vv-h", `${Math.round(vv.height)}px`);
    html.classList.toggle("keyboard", vv.height < html.clientHeight - 100);
    liftFocusScreen();
  };
  const hold = (e: TouchEvent) => {
    if (!html.classList.contains("keyboard")) return;
    const t = e.target instanceof Element ? e.target : null;
    if (!t?.closest(`${SCROLLER}, .glass-sheet`)) e.preventDefault();
  };
  // The window never scrolls, but iOS ignores overflow: hidden when it reveals a focused field (as the keyboard opens
  // it scrolled 379pt in one frame). On the focus screen the scroll is absorbed in the same event: the window goes back
  // to 0 and the lift takes the same amount, so nothing on screen moves, then the lift glides on to its target.
  // Elsewhere the window goes back to 0 once a frame, and the caret is redrawn once per focus.
  let resetFrame = 0;
  let reasserted: Element | null = null;
  const resetWindow = () => {
    resetFrame = 0;
    if (window.scrollY === 0 && window.scrollX === 0) return;
    window.scrollTo(0, 0);
    const el = document.activeElement;
    if (el instanceof HTMLInputElement && el !== reasserted) {
      reasserted = el;
      requestAnimationFrame(() => redrawCaret(el));
    }
  };
  const onWindowScroll = () => {
    const y = Math.round(window.scrollY);
    const screen = focusedField()?.closest<HTMLElement>("[data-focus-screen]");
    if (y > 0 && screen) {
      // where the screen shows now, with iOS's scroll and any glide in progress, held while the window goes back
      const shown = Math.max(0, Math.round(-screen.getBoundingClientRect().top));
      window.scrollTo(0, 0);
      lift = -1;
      setLift(shown, true);
      requestAnimationFrame(liftFocusScreen);
      return;
    }
    if (!resetFrame) resetFrame = requestAnimationFrame(resetWindow);
  };
  const onFocusOut = () => {
    reasserted = null;
  };
  // the keyboard's up and down arrows move focus with the keyboard already up, so no viewport event follows
  const onFocusIn = () => requestAnimationFrame(liftFocusScreen);
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);
  window.addEventListener("scroll", onWindowScroll, { passive: true });
  document.addEventListener("focusout", onFocusOut);
  document.addEventListener("focusin", onFocusIn);
  document.addEventListener("touchmove", hold, { passive: false });
  document.addEventListener("transitionend", onLiftSettled);
  return () => {
    document.removeEventListener("transitionend", onLiftSettled);
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
    window.removeEventListener("scroll", onWindowScroll);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("focusin", onFocusIn);
    cancelAnimationFrame(resetFrame);
    document.removeEventListener("touchmove", hold);
    html.style.removeProperty("--focus-lift");
    html.style.removeProperty("--vv-top");
    html.style.removeProperty("--vv-h");
    html.style.removeProperty("--screen-h");
    html.classList.remove("standalone");
    html.classList.remove("keyboard");
  };
}
