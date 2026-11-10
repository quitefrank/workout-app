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

/** Room left between the focused stepper's card and the top of the keyboard's accessory bar, in pt */
export const LIFT_CLEARANCE = 16;

/** How long the keyboard must stay down before the focus screen drops back, in ms (a field switch is shorter) */
export const LIFT_HOLD_MS = 180;

/**
 * How far to lift the focus screen so a card whose bottom sits at `restingBottom` (unlifted, on screen) clears the
 * visible area's bottom edge by LIFT_CLEARANCE; never down, whole points.
 */
export function focusLift(restingBottom: number, visibleBottom: number): number {
  return Math.max(0, Math.ceil(restingBottom + LIFT_CLEARANCE - visibleBottom));
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
  // The focus screen never scrolls, so iOS has nothing to scroll to reveal a stepper and the keyboard covers it. As
  // the keyboard layout guide does, the screen is lifted (--focus-lift, globals.css) just enough to keep the focused
  // stepper's card above the keyboard, and the caret, which iOS does not move with the field, is redrawn after.
  // Moving between fields (a tap or the keyboard's arrows) blurs one before focusing the next, and iOS can report the
  // keyboard gone for a moment in between, so the lift is held: it only grows while the keyboard is up (a card already
  // in view moves nothing, focus and caret just switch), and drops back only once the keyboard has stayed down.
  let lift = 0;
  let dropTimer = 0;
  const setLift = (next: number, el: Element | null) => {
    if (next === lift) return;
    lift = next;
    html.style.setProperty("--focus-lift", `${lift}px`);
    if (el instanceof HTMLInputElement) requestAnimationFrame(() => redrawCaret(el));
  };
  const liftFocusScreen = () => {
    if (!html.classList.contains("keyboard")) {
      if (lift && !dropTimer)
        dropTimer = window.setTimeout(() => {
          dropTimer = 0;
          if (!html.classList.contains("keyboard")) setLift(0, null);
        }, LIFT_HOLD_MS);
      return;
    }
    clearTimeout(dropTimer);
    dropTimer = 0;
    const el = document.activeElement;
    const card = el instanceof HTMLInputElement && el.closest("[data-focus-screen]") ? el.parentElement : null;
    if (!card) return;
    setLift(Math.max(lift, focusLift(card.getBoundingClientRect().bottom + lift, vv.height)), el);
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
      requestAnimationFrame(() => redrawCaret(el));
    }
  };
  const onWindowScroll = () => {
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
  return () => {
    vv.removeEventListener("resize", update);
    vv.removeEventListener("scroll", update);
    window.removeEventListener("scroll", onWindowScroll);
    document.removeEventListener("focusout", onFocusOut);
    document.removeEventListener("focusin", onFocusIn);
    cancelAnimationFrame(resetFrame);
    clearTimeout(dropTimer);
    document.removeEventListener("touchmove", hold);
    html.style.removeProperty("--focus-lift");
    html.style.removeProperty("--vv-top");
    html.style.removeProperty("--vv-h");
    html.style.removeProperty("--screen-h");
    html.classList.remove("standalone");
    html.classList.remove("keyboard");
  };
}
