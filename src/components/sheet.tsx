"use client";

import { useCallback, useEffect, useId, useRef, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { releaseDismisses, sheetFit, sheetSlide, type SheetFit } from "@/lib/sheet-detent";
import { HERO_BACK, HERO_COLLAPSED_H, HERO_EXPANDED_H, HERO_SETTLE_DELAY, heroLayout, heroPose, heroSettleTarget, springSettled, springStep } from "@/lib/sheet-hero";
import { GlassCircleButton } from "./glass";
import { CheckIcon, ChevronLeft, XIcon } from "./icons";

/**
 * Apple's iOS 27 sheet (Figma kit 27.0.1, Sheet - iPhone), fitted to its content up to the large detent; taller content
 * scrolls. Below large: 6pt from the edges, 34pt top and 58pt bottom corners, a CSS blur with transparency. Large: edge to
 * edge under the 62pt status bar, 38pt top corners, opaque. CSS on both paths, as the menus are, by Frank's call
 * (2026-11-04): the shader reads the page, so its glass on or under a sheet showed the wrong thing. A 58 by 4 grabber, a
 * 44pt close button, the kit's Overlays/Default scrim (20% black, 48% in dark). It never shrinks while open, so tabs stay
 * under the finger. Drag the grabber or toolbar down to close it, or the content when it is scrolled to its top. A text
 * field takes it to large, clear of the keyboard. The shape runs on --sheet-height, --sheet-full and --sheet-y
 * (.sheet-panel in globals.css). Escape, the close button and a tap on the scrim close it.
 *
 * The close button takes the slot the header leaves free: leading in the toolbar, trailing beside a thumbnail. A step
 * inside the sheet (`onBack`) puts Back in the leading slot and the close button trailing, never with a confirm (Frank's
 * call, 2026-11-13, https://claude.ai/artifact/NhAD3QmuzrigseuXLTvxXR). Back fades and scales in and out.
 */
export function Sheet({
  open,
  onClose,
  title,
  trailing,
  thumbnail,
  subtitle,
  onBack,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** The toolbar's confirming action. Not shown while `onBack` is set: a step shows Back and Close only. */
  trailing?: ReactNode;
  /** With a thumbnail the sheet opens on it large, and scrolling shrinks it into the kit's Activity View header
   *  (754:26934): thumbnail, title and subtitle in one row, the close button at the trailing edge (src/lib/sheet-hero.ts).
   *  Without one the header is the kit's toolbar (754:64541): close, centred title, confirm. */
  thumbnail?: ReactNode;
  subtitle?: ReactNode;
  /** A step inside the sheet: Back takes the leading slot (the top left beside a thumbnail) and goes one step back */
  onBack?: () => void;
  children: ReactNode;
}) {
  const titleId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const header = useRef<HTMLDivElement>(null);
  const hero = !!thumbnail;
  const back = !!onBack;
  /** Read by the hero's paint on every scroll frame, so a step in or out never re-subscribes the scroll */
  const backRef = useRef(back);
  /** The hero header's moving parts, written straight to the DOM on every scroll frame */
  const heroEls = useRef<{ backdrop?: HTMLDivElement | null; edge?: HTMLDivElement | null; image?: HTMLDivElement | null; title?: HTMLElement | null; sub?: HTMLDivElement | null; smallTitle?: HTMLDivElement | null; smallSub?: HTMLDivElement | null; close?: HTMLDivElement | null; back?: HTMLDivElement | null }>({});
  /** Whether the sheet is at the large detent, from the last fit */
  const full = useRef(false);
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

  const paintHero = useCallback(() => {
    const el = panel.current;
    const e = heroEls.current;
    if (!hero || !el || !e.image) return;
    const width = el.clientWidth;
    const p = heroPose(body.current?.scrollTop ?? 0, width, full.current, backRef.current);
    const l = heroLayout(width, backRef.current);
    Object.assign(e.image.style, { left: `${p.image.x}px`, top: `${p.image.y}px`, width: `${p.image.w}px`, height: `${p.image.h}px`, borderRadius: `${p.image.r}px` });
    if (e.backdrop) e.backdrop.style.height = `${p.backdrop}px`;
    if (e.edge) Object.assign(e.edge.style, { top: `${p.backdrop}px`, opacity: String(p.t) });
    if (e.title) Object.assign(e.title.style, { top: `${p.largeTitleY}px`, width: `${l.large.w}px`, opacity: String(p.largeOpacity) });
    if (e.sub) Object.assign(e.sub.style, { top: `${p.largeSubY}px`, width: `${l.large.w}px`, opacity: String(p.largeOpacity) });
    if (e.smallTitle) Object.assign(e.smallTitle.style, { left: `${l.small.x}px`, width: `${l.small.w}px`, opacity: String(p.smallOpacity) });
    if (e.smallSub) Object.assign(e.smallSub.style, { left: `${l.small.x}px`, width: `${l.small.w}px`, opacity: String(p.smallOpacity) });
    if (e.close) e.close.style.left = `${l.close.x}px`;
    if (e.back) Object.assign(e.back.style, { left: `${HERO_BACK.x}px`, top: `${HERO_BACK.y}px` });
  }, [hero]);

  // Back coming or going moves the collapsed thumbnail and small title; they glide there rather than jump
  useEffect(() => {
    if (backRef.current === back) return;
    backRef.current = back;
    const head = header.current;
    if (!hero || !head) return;
    head.setAttribute("data-hero-shift", "");
    paintHero();
    const timer = window.setTimeout(() => head.removeAttribute("data-hero-shift"), BACK_SHIFT_MS);
    return () => {
      window.clearTimeout(timer);
      head.removeAttribute("data-hero-shift");
    };
  }, [back, hero, paintHero]);

  const measure = useCallback((): SheetFit | null => {
    const el = panel.current;
    if (!el || !header.current || !content.current || !body.current) return null;
    const padding = parseFloat(getComputedStyle(body.current).paddingBottom) || 0;
    // the hero's floor on the content is read without itself, then set again for the new fit
    if (hero) content.current.style.minHeight = "";
    const top = hero ? HERO_EXPANDED_H : header.current.offsetHeight;
    fit.current.tallest = Math.max(fit.current.tallest, top + content.current.offsetHeight + padding);
    const f = writeFit(el, fit.current.raised ? Infinity : Math.ceil(fit.current.tallest));
    full.current = f.full;
    // at the large detent the content is always tall enough for the image to finish shrinking
    if (hero && f.full) content.current.style.minHeight = `${f.height - HERO_COLLAPSED_H}px`;
    paintHero();
    return f;
  }, [hero, paintHero]);

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
      paintHero();
      el.style.setProperty("--sheet-y", "0px");
    } else {
      // a closed sheet is hidden from VoiceOver, so it cannot keep the focus
      if (el.contains(document.activeElement)) (document.activeElement as HTMLElement).blur();
      el.removeAttribute("data-dragging");
      el.style.setProperty("--sheet-y", "calc(100% + 40px)");
    }
  }, [open, mounted, measure, paintHero]);

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

  // The hero follows the scroll; stopped halfway, it settles to the nearer end on SwiftUI's smooth spring
  useEffect(() => {
    const scroller = body.current;
    const el = panel.current;
    if (!hero || !open || !scroller || !el) return;
    let timer = 0;
    let raf = 0;
    let touching = false;
    let settling = false;
    const stop = () => {
      cancelAnimationFrame(raf);
      settling = false;
    };
    const settle = () => {
      if (touching || settling || !full.current) return;
      const from = scroller.scrollTop;
      const to = heroSettleTarget(from);
      if (to === null) return;
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        scroller.scrollTop = to;
        return;
      }
      settling = true;
      let s = { x: from, v: 0 };
      let last = performance.now();
      const step = (now: number) => {
        s = springStep(s, to, (now - last) / 1000);
        last = now;
        const done = springSettled(s, from, to);
        scroller.scrollTop = done ? to : s.x;
        if (done) settling = false;
        else raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const later = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(settle, HERO_SETTLE_DELAY);
    };
    const onScroll = () => {
      paintHero();
      if (!settling) later();
    };
    const onTouchStart = () => {
      touching = true;
      stop();
    };
    const onTouchEnd = () => {
      touching = false;
      later();
    };
    const ro = new ResizeObserver(() => paintHero());
    ro.observe(el);
    scroller.addEventListener("scroll", onScroll, { passive: true });
    scroller.addEventListener("touchstart", onTouchStart, { passive: true });
    scroller.addEventListener("touchend", onTouchEnd);
    scroller.addEventListener("touchcancel", onTouchEnd);
    scroller.addEventListener("wheel", stop, { passive: true });
    return () => {
      stop();
      window.clearTimeout(timer);
      ro.disconnect();
      scroller.removeEventListener("scroll", onScroll);
      scroller.removeEventListener("touchstart", onTouchStart);
      scroller.removeEventListener("touchend", onTouchEnd);
      scroller.removeEventListener("touchcancel", onTouchEnd);
      scroller.removeEventListener("wheel", stop);
    };
  }, [hero, open, paintHero]);

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
        <div aria-hidden className="sheet-solid" />
        {hero ? (
          <>
            <div ref={body} className="sheet-body absolute inset-0 overflow-y-auto overscroll-contain rounded-[inherit] px-4" style={{ paddingTop: HERO_EXPANDED_H }}>
              <div ref={content} className="flow-root">
                {open && children}
              </div>
            </div>
            {/* Over the content and letting touches through to it, so the image scrolls like the page; the grabber row
                and the close button take touches */}
            <div ref={header} className="pointer-events-none absolute inset-x-0 top-0 select-none rounded-[inherit]">
              <div ref={(n) => void (heroEls.current.backdrop = n)} className="absolute inset-x-0 top-0 rounded-[inherit] bg-[var(--sheet-solid)]" style={{ height: HERO_EXPANDED_H, opacity: "var(--sheet-full)" }} />
              <div ref={(n) => void (heroEls.current.edge = n)} className="absolute inset-x-0 h-[22px] bg-gradient-to-b from-[var(--sheet-solid)] to-transparent opacity-0" style={{ top: HERO_EXPANDED_H }} />
              <h2 id={titleId} ref={(n) => void (heroEls.current.title = n)} className="absolute left-4 truncate text-[22px] font-bold leading-7 tracking-[-0.26px]">
                {title}
              </h2>
              {subtitle && (
                <div ref={(n) => void (heroEls.current.sub = n)} className="absolute left-4 truncate text-[15px] leading-5 tracking-[-0.23px] text-ink-2">
                  {subtitle}
                </div>
              )}
              <div aria-hidden ref={(n) => void (heroEls.current.smallTitle = n)} className="absolute left-[100px] top-8 truncate text-[15px] font-medium leading-5 tracking-[-0.23px] opacity-0">
                {title}
              </div>
              {subtitle && (
                <div aria-hidden ref={(n) => void (heroEls.current.smallSub = n)} className="absolute left-[100px] top-[52px] truncate text-[13px] leading-[18px] tracking-[-0.08px] text-ink-2 opacity-0">
                  {subtitle}
                </div>
              )}
              <div ref={(n) => void (heroEls.current.image = n)} className="absolute overflow-hidden bg-[var(--muscle-tile)] ring-[0.5px] ring-[var(--sep)]">
                {thumbnail}
              </div>
              <div data-sheet-header className="pointer-events-auto absolute inset-x-0 top-0 flex h-4 touch-none justify-center pt-[5px]">
                <span className="h-1 w-[58px] rounded-full bg-ink-3" />
              </div>
              <div ref={(n) => void (heroEls.current.back = n)} className={`absolute left-4 top-5 ${back ? "pointer-events-auto" : ""}`}>
                <BackSlot shown={back} onBack={onBack} />
              </div>
              <div ref={(n) => void (heroEls.current.close = n)} className="pointer-events-auto absolute top-5">
                <GlassCircleButton label="Close" onClick={onClose}>
                  <XIcon size={18} />
                </GlassCircleButton>
              </div>
            </div>
          </>
        ) : (
          <>
            <div ref={header} data-sheet-header className="shrink-0 touch-none select-none">
              <div className="flex h-4 w-full justify-center pt-[5px]">
                <span className="h-1 w-[58px] rounded-full bg-ink-3" />
              </div>
              <div className="flex items-center gap-2 px-4 pb-2.5">
                {/* leading: Close, or Back during a step; trailing: the confirm, or Close during a step */}
                <div className="relative size-11 shrink-0">
                  <SlotItem shown={!back}>
                    <GlassCircleButton label="Close" onClick={onClose}>
                      <XIcon size={18} />
                    </GlassCircleButton>
                  </SlotItem>
                  <BackSlot shown={back} onBack={onBack} />
                </div>
                <h2 id={titleId} className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold tracking-[-0.43px]">
                  {title}
                </h2>
                <div className="relative size-11 shrink-0">
                  <SlotItem shown={!back}>
                    <div className="flex size-11 items-center justify-center">{trailing}</div>
                  </SlotItem>
                  <SlotItem shown={back}>
                    <GlassCircleButton label="Close" onClick={onClose}>
                      <XIcon size={18} />
                    </GlassCircleButton>
                  </SlotItem>
                </div>
              </div>
            </div>
            <div ref={body} className="sheet-body min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
              <div ref={content} className="flow-root">
                {open && children}
              </div>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** One of the two controls sharing a header slot; the one not shown fades and shrinks away and takes no taps. */
function SlotItem({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div
      inert={!shown}
      aria-hidden={!shown}
      className={`absolute inset-0 transition-[opacity,scale] duration-200 ease-out motion-reduce:transition-none ${shown ? "scale-100 opacity-100" : "pointer-events-none scale-75 opacity-0"}`}
    >
      {children}
    </div>
  );
}

/** The Back button of a step inside a sheet: the close button's glass circle with a leading chevron */
function BackSlot({ shown, onBack }: { shown: boolean; onBack?: () => void }) {
  return (
    <SlotItem shown={shown}>
      <GlassCircleButton label="Back" onClick={() => onBack?.()}>
        <ChevronLeft size={20} />
      </GlassCircleButton>
    </SlotItem>
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
/** How long the collapsed thumbnail and small title glide when Back comes or goes (`[data-hero-shift]` in globals.css) */
const BACK_SHIFT_MS = 300;

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
