"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { detentsFor, settleSheet, sheetPose, type Detents, type SheetStop } from "@/lib/sheet-detent";
import { GlassCircleButton } from "./glass";
import { CheckIcon, XIcon } from "./icons";

/**
 * Apple's iOS 27 sheet (Figma kit 27.0.1, Sheet - iPhone). Medium: 6pt in from the edges, 459 of 874pt tall, 34pt top
 * and 58pt bottom corners, the sheet material. Large: edge to edge under the 62pt status bar, 38pt top corners, opaque.
 * A 58 by 4 grabber, a 44pt close button, a 20% scrim. Drag the grabber or toolbar, or the content when it has nothing
 * to scroll that way. The shape runs on --sheet-p and --sheet-y (.sheet-panel in globals.css). Escape, the close button
 * and a tap on the scrim close it.
 */
export function Sheet({
  open,
  onClose,
  title,
  trailing,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  trailing?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const stop = useRef<"medium" | "large">("medium");
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // The portal needs document.body, so the server and the first client render both draw nothing
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );

  const goTo = useCallback((to: SheetStop) => {
    const el = panel.current;
    if (!el) return;
    if (to === "dismiss") {
      closeRef.current();
      return;
    }
    stop.current = to;
    el.removeAttribute("data-dragging");
    setPose(el, to === "large" ? 1 : 0, "0px");
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Every open starts at medium: the shape is set with the transition off, while it is still off screen
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (open) {
      stop.current = "medium";
      writeDetents(el);
      el.setAttribute("data-dragging", "");
      el.style.setProperty("--sheet-p", "0");
      void el.offsetHeight;
      el.removeAttribute("data-dragging");
      if (body.current) body.current.scrollTop = 0;
      setPose(el, 0, "0px");
    } else {
      // a closed sheet is hidden from VoiceOver, so it cannot keep the focus
      if (el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      el.removeAttribute("data-dragging");
      el.style.setProperty("--sheet-y", "calc(100% + 40px)");
    }
  }, [open, mounted]);

  // The stage hides the dock and its capsule while a sheet is up, and keeps them hidden until the sheet has slid away
  useEffect(() => {
    if (!open) return;
    holdSheetOpen(1);
    const el = panel.current;
    return () => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        el?.removeEventListener("transitionend", onEnd);
        window.clearTimeout(timer);
        holdSheetOpen(-1);
      };
      const onEnd = (e: TransitionEvent) => {
        if (e.target === el && e.propertyName === "transform") finish();
      };
      el?.addEventListener("transitionend", onEnd);
      const timer = window.setTimeout(finish, CLOSE_MS + 150);
    };
  }, [open]);

  // The drag. Native listeners, since a touch that becomes a drag has to cancel the scroll, which React's passive
  // handlers cannot. On the content a drag up grows the sheet until it is large, and a drag down moves it only once the
  // list is at its top; anything else scrolls.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    type Drag = { startY: number; startX: number; from: number; detents: Detents; header: boolean; mode: "?" | "drag" | "scroll"; lastY: number; lastT: number; v: number };
    let drag: Drag | null = null;

    const begin = (x: number, y: number, target: EventTarget | null) => {
      const t = target instanceof Element ? target : null;
      if (t?.closest('input[type="range"]')) return;
      const detents = writeDetents(el);
      drag = { startY: y, startX: x, from: el.getBoundingClientRect().height, detents, header: !!t?.closest("[data-sheet-header]"), mode: "?", lastY: y, lastT: performance.now(), v: 0 };
    };
    const move = (x: number, y: number, cancel: () => void) => {
      const d = drag;
      if (!d) return;
      const dy = y - d.startY;
      if (d.mode === "?") {
        if (Math.abs(dy) < SLOP && Math.abs(x - d.startX) < SLOP) return;
        const vertical = Math.abs(dy) >= Math.abs(x - d.startX);
        const scrolled = (body.current?.scrollTop ?? 0) > 0;
        const canDrag = d.header || (dy < 0 ? stop.current !== "large" : !scrolled);
        d.mode = vertical && canDrag ? "drag" : "scroll";
        if (d.mode === "drag") el.setAttribute("data-dragging", "");
      }
      if (d.mode !== "drag") return;
      cancel();
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      d.v = 0.7 * ((d.lastY - y) / dt) + 0.3 * d.v;
      d.lastY = y;
      d.lastT = now;
      const pose = sheetPose(Math.min(d.detents.large, d.from - dy), d.detents);
      setPose(el, pose.p, `${pose.y}px`);
    };
    const end = () => {
      const d = drag;
      drag = null;
      if (d?.mode !== "drag") return;
      goTo(settleSheet(el.getBoundingClientRect().height - currentSlide(el), d.v, d.detents));
    };

    const touchStart = (e: TouchEvent) => e.touches.length === 1 && begin(e.touches[0].clientX, e.touches[0].clientY, e.target);
    const touchMove = (e: TouchEvent) => move(e.touches[0].clientX, e.touches[0].clientY, () => e.cancelable && e.preventDefault());
    const mouseDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0 || !(e.target instanceof Element) || !e.target.closest("[data-sheet-header]")) return;
      begin(e.clientX, e.clientY, e.target);
      const mouseMove = (m: PointerEvent) => move(m.clientX, m.clientY, () => m.preventDefault());
      const mouseUp = () => {
        window.removeEventListener("pointermove", mouseMove);
        window.removeEventListener("pointerup", mouseUp);
        end();
      };
      window.addEventListener("pointermove", mouseMove);
      window.addEventListener("pointerup", mouseUp);
    };
    el.addEventListener("touchstart", touchStart, { passive: true });
    el.addEventListener("touchmove", touchMove, { passive: false });
    el.addEventListener("touchend", end);
    el.addEventListener("touchcancel", end);
    el.addEventListener("pointerdown", mouseDown);
    return () => {
      el.removeEventListener("touchstart", touchStart);
      el.removeEventListener("touchmove", touchMove);
      el.removeEventListener("touchend", end);
      el.removeEventListener("touchcancel", end);
      el.removeEventListener("pointerdown", mouseDown);
    };
  }, [mounted, goTo]);

  if (!mounted) return null;
  return createPortal(
    <div className={open ? "" : "pointer-events-none"} aria-hidden={!open}>
      <div
        onClick={onClose}
        data-scrim={open ? "on" : "off"}
        className={`fixed inset-0 z-50 bg-black/20 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        data-glass-skip
        aria-labelledby={titleId}
        tabIndex={-1}
        // a text field raises the keyboard, which a medium sheet would sit behind, so it goes large as iOS's does
        onFocusCapture={(e) => {
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) goTo("large");
        }}
        className="glass-sheet sheet-panel fixed z-50 mx-auto flex max-w-[540px] flex-col outline-none"
      >
        <div aria-hidden className="sheet-solid" />
        <div data-sheet-header className="shrink-0 touch-none select-none">
          <button
            type="button"
            aria-label="Resize sheet"
            onClick={() => goTo(stop.current === "large" ? "medium" : "large")}
            className="flex h-4 w-full justify-center pt-[5px]"
          >
            <span className="h-1 w-[58px] rounded-full bg-ink-3" />
          </button>
          <div className="flex items-center gap-2 px-4 pb-2.5">
            <GlassCircleButton label="Close" onClick={onClose}>
              <XIcon size={18} />
            </GlassCircleButton>
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold tracking-[-0.43px]">
              {title}
            </h2>
            <div className="flex size-11 shrink-0 items-center justify-center">{trailing}</div>
          </div>
        </div>
        <div ref={body} className="sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          {open && children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** The kit's confirming action in a sheet's toolbar: a 44pt circle in the accent, its symbol in white. */
export function SheetConfirm({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-blue text-white disabled:opacity-40"
    >
      <CheckIcon size={20} strokeWidth={2.4} />
    </button>
  );
}

const noop = () => () => {};

/** A touch has to travel this far, in px, before it is a drag or a scroll */
const SLOP = 4;
/** The panel's slide, in ms (.sheet-panel in globals.css) */
const CLOSE_MS = 450;

function setPose(el: HTMLElement, p: number, y: string) {
  el.style.setProperty("--sheet-p", String(p));
  el.style.setProperty("--sheet-y", y);
}

/** How far below its place the panel sits right now, read off the transform */
function currentSlide(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  return t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0;
}

/** Measures the screen and writes the two heights the CSS grows between. A home screen app's window flips height, so it
 *  uses the screen's, as the dock does (src/lib/scroller.ts). */
function writeDetents(el: HTMLElement): Detents {
  const standalone = document.documentElement.classList.contains("standalone");
  const d = detentsFor(standalone ? window.screen.height : window.innerHeight);
  el.style.setProperty("--sheet-m", `${d.medium}px`);
  el.style.setProperty("--sheet-l", `${d.large}px`);
  return d;
}

/** Sheets open or still closing; `sheet-open` stays on <html> while any is */
let held = 0;
function holdSheetOpen(delta: number) {
  held = Math.max(0, held + delta);
  document.documentElement.classList.toggle("sheet-open", held > 0);
}
