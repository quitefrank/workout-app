"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { releaseDismisses, sheetFit, sheetSlide, type SheetFit } from "@/lib/sheet-detent";
import { GlassCircleButton } from "./glass";
import { CheckIcon, XIcon } from "./icons";

/**
 * Apple's iOS 27 sheet (Figma kit 27.0.1, Sheet - iPhone), fitted to its content up to the large detent, as Frank chose
 * over the medium one (2026-11-04); taller content scrolls. Below large: 6pt from the edges, 34pt top and 58pt bottom
 * corners, the sheet material. Large: edge to edge under the 62pt status bar, 38pt top corners. A 58 by 4
 * grabber, a 44pt close button, the kit's Overlays/Default scrim (20% black, 48% in dark). It never shrinks while open, so
 * tabs stay under the finger. Drag the grabber or toolbar down to close it, or the content when it is scrolled to its
 * top. A text field takes it to large, clear of the keyboard. The shape runs on --sheet-height, --sheet-full and
 * --sheet-y (.sheet-panel in globals.css). Escape, the close button and a tap on the scrim close it.
 */
export function Sheet({
  open,
  onClose,
  title,
  trailing,
  thumbnail,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  trailing?: ReactNode;
  /** With a thumbnail the header is the kit's Activity View header (754:26934): thumbnail, title and subtitle in one
   *  row, the close button at the trailing edge. Without one it is the kit's toolbar (754:64541): close, centred title,
   *  confirm. */
  thumbnail?: ReactNode;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  /** The tallest the content has been since this sheet opened, and whether a text field needs the room */
  const fit = useRef({ tallest: 0, raised: false });
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

  const measure = useCallback((): SheetFit | null => {
    const el = panel.current;
    if (!el || !header.current || !content.current || !body.current) return null;
    const padding = parseFloat(getComputedStyle(body.current).paddingBottom) || 0;
    fit.current.tallest = Math.max(fit.current.tallest, header.current.offsetHeight + content.current.offsetHeight + padding);
    return writeFit(el, fit.current.raised ? Infinity : Math.ceil(fit.current.tallest));
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

  // Every open is fitted afresh, with the transition off, while it is still off screen
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (open) {
      fit.current = { tallest: 0, raised: false };
      el.setAttribute("data-dragging", "");
      measure();
      void el.offsetHeight;
      el.removeAttribute("data-dragging");
      if (body.current) body.current.scrollTop = 0;
      el.style.setProperty("--sheet-y", "0px");
    } else {
      // a closed sheet is hidden from VoiceOver, so it cannot keep the focus
      if (el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      el.removeAttribute("data-dragging");
      el.style.setProperty("--sheet-y", "calc(100% + 40px)");
    }
  }, [open, mounted, measure]);

  // Content that loads or grows while the sheet is up: the sheet grows with it, on the sheet's own curve
  useEffect(() => {
    const inner = content.current;
    if (!open || !inner) return;
    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(inner);
    return () => ro.disconnect();
  }, [open, measure]);

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

  // The drag down. Native listeners, since a touch that becomes a drag has to cancel the scroll, which React's passive
  // handlers cannot. On the content a drag moves the sheet only once the list is at its top; anything else scrolls.
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    type Drag = { startY: number; startX: number; height: number; header: boolean; mode: "?" | "drag" | "scroll"; lastY: number; lastT: number; v: number };
    let drag: Drag | null = null;

    const begin = (x: number, y: number, target: EventTarget | null) => {
      const t = target instanceof Element ? target : null;
      if (t?.closest('input[type="range"]')) return;
      const measured = measure();
      if (!measured) return;
      drag = { startY: y, startX: x, height: measured.height, header: !!t?.closest("[data-sheet-header]"), mode: "?", lastY: y, lastT: performance.now(), v: 0 };
    };
    const move = (x: number, y: number, cancel: () => void) => {
      const d = drag;
      if (!d) return;
      const dy = y - d.startY;
      if (d.mode === "?") {
        if (Math.abs(dy) < SLOP && Math.abs(x - d.startX) < SLOP) return;
        const vertical = Math.abs(dy) >= Math.abs(x - d.startX);
        const atTop = (body.current?.scrollTop ?? 0) <= 0;
        d.mode = vertical && (d.header || (dy > 0 && atTop)) ? "drag" : "scroll";
        if (d.mode === "drag") el.setAttribute("data-dragging", "");
      }
      if (d.mode !== "drag") return;
      cancel();
      const now = performance.now();
      const dt = Math.max(1, now - d.lastT);
      d.v = 0.7 * ((d.lastY - y) / dt) + 0.3 * d.v;
      d.lastY = y;
      d.lastT = now;
      el.style.setProperty("--sheet-y", `${sheetSlide(d.height - dy, d.height)}px`);
    };
    const end = () => {
      const d = drag;
      drag = null;
      if (d?.mode !== "drag") return;
      el.removeAttribute("data-dragging");
      if (releaseDismisses(d.height - currentSlide(el), d.v, d.height)) closeRef.current();
      else el.style.setProperty("--sheet-y", "0px");
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
  }, [mounted, measure]);

  if (!mounted) return null;
  return createPortal(
    <div className={open ? "" : "pointer-events-none"} aria-hidden={!open}>
      <div
        onClick={onClose}
        data-scrim={open ? "on" : "off"}
        className={`fixed inset-0 z-50 bg-[rgb(0_0_0/var(--scrim-alpha))] transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}
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
          if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) {
            fit.current.raised = true;
            measure();
          }
        }}
        className="glass-sheet sheet-panel fixed z-50 mx-auto flex max-w-[540px] flex-col outline-none"
      >
        <div ref={header} data-sheet-header className="shrink-0 touch-none select-none">
          <div className="flex h-4 w-full justify-center pt-[5px]">
            <span className="h-1 w-[58px] rounded-full bg-ink-3" />
          </div>
          {thumbnail ? (
            <div className="flex items-start gap-4 px-4 pb-3 pt-1">
              <div className="ml-1 size-16 shrink-0 overflow-hidden rounded-2xl bg-[var(--muscle-tile)] p-1 ring-[0.5px] ring-[var(--sep)]">{thumbnail}</div>
              <div className="min-w-0 flex-1 pt-3">
                <h2 id={titleId} className="truncate text-[15px] font-medium leading-5 tracking-[-0.23px]">
                  {title}
                </h2>
                {subtitle && <div className="truncate text-[13px] leading-[18px] tracking-[-0.08px] text-ink-2">{subtitle}</div>}
              </div>
              <GlassCircleButton label="Close" onClick={onClose}>
                <XIcon size={18} />
              </GlassCircleButton>
            </div>
          ) : (
            <div className="flex items-center gap-2 px-4 pb-2.5">
              <GlassCircleButton label="Close" onClick={onClose}>
                <XIcon size={18} />
              </GlassCircleButton>
              <h2 id={titleId} className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold tracking-[-0.43px]">
                {title}
              </h2>
              <div className="flex size-11 shrink-0 items-center justify-center">{trailing}</div>
            </div>
          )}
        </div>
        <div ref={body} className="sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <div ref={content} className="flow-root">
            {open && children}
          </div>
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

/** How far below its place the panel sits right now, read off the transform */
function currentSlide(el: HTMLElement): number {
  const t = getComputedStyle(el).transform;
  return t && t !== "none" ? new DOMMatrixReadOnly(t).m42 : 0;
}

/** Writes the sheet's height and whether that is the large detent. A home screen app's window flips height, so it uses
 *  the screen's, as the dock does (src/lib/scroller.ts). */
function writeFit(el: HTMLElement, contentHeight: number): SheetFit {
  const standalone = document.documentElement.classList.contains("standalone");
  const f = sheetFit(standalone ? window.screen.height : window.innerHeight, contentHeight);
  el.style.setProperty("--sheet-height", `${f.height}px`);
  el.style.setProperty("--sheet-full", f.full ? "1" : "0");
  return f;
}

/** Sheets open or still closing; `sheet-open` stays on <html> while any is */
let held = 0;
function holdSheetOpen(delta: number) {
  held = Math.max(0, held + delta);
  document.documentElement.classList.toggle("sheet-open", held > 0);
}
