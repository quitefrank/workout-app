"use client";

import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { GlassCircleButton } from "@/components/glass";
import { CheckIcon, PlayIcon, SfXmarkIcon, SkipIcon, StopIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { JournalGlass } from "@/lib/workout-layout";
import { closesOnRelease, progressFor, travel } from "@/lib/workout/journal-card";

/**
 * The pill layout's Journal (Frank's call, 2026-11-08, aligned in the teardown prototype): the pill grows into it and
 * back. One card whose shape follows `--jp`, a registered property from 0 (exactly the pill) to 1 (open under the status
 * bar): its sides and bottom move out to the edges, its top follows the finger, and the content is in it the whole time,
 * the current exercise pinned under the header, as Ladder does (Supercut hW8oIanK6sdvLXdtmNSqaH). The header is the pill's
 * content (circle, set dots over the title, leading), grown into the iOS 27 sheet toolbar: the circle goes from 38pt to
 * 44pt on its 16pt edge, the grabber and a close button come in (Frank's calls, 2026-11-12, from the Journal Pill Lab,
 * https://claude.ai/artifact/LoiDBexQCNYGfaauP8uTQ2). Geometry in `.jcard` (globals.css), decisions in
 * src/lib/workout/journal-card.ts.
 *
 * The parent drives it: `controlRef` sets the progress while a finger drags the pill and settles it open or closed. The card
 * is CSS on both glass paths (`data-unpainted`), as sheets are, and above the canvas.
 *
 * How the glass is drawn is a test setting (`glass`, src/lib/workout-layout.ts):
 * - `css`: the pill is CSS glass (`glass-css`) and hidden whole while the card is up; the card's first layer is the same
 *   CSS glass, crossfading to the opaque fill over the first fifth of the travel.
 * - `match`: the pill stays shader glass, hidden by the stage (`data-glass-hidden`) while the card is up; the card starts
 *   with the same CSS glass layer.
 * - `shader`: the pill element itself follows the card's geometry (`.pill-grow`, the same calc() on a mirrored `--jp`), so
 *   the stage draws one growing shader shape; the card over it has no glass and its fill comes in late. The shader glass
 *   is hidden once the card has settled open, and the unit keeps its side while it grows (`data-glass-hold`).
 */

export type CardControl = { setP: (p: number) => void; settle: (to: 0 | 1) => void; scrollTop: () => number };

/** How long a settle runs, in ms (the `--jp` transition in globals.css) */
const SETTLE_MS = 440;

export function JournalCard({
  controlRef,
  startRef,
  openOnMount,
  onClosed,
  glass,
  pillRef,
  check,
  title,
  dots,
  current,
  initialScroll,
  children,
}: {
  controlRef: MutableRefObject<CardControl | null>;
  /** how the pill and the card's glass are drawn (the Journal glass setting) */
  glass: JournalGlass;
  /** the pill in the dock: its unit's side is copied onto the card's glass layer, and in `shader` mode it grows */
  pillRef: RefObject<HTMLDivElement | null>;
  /** where the card starts: the finger's progress if a drag opened it, else 0 */
  startRef: MutableRefObject<number>;
  /** a tap or a swipe opened it: grow to open on mount */
  openOnMount: boolean;
  onClosed: () => void;
  check: ReactNode;
  title: string;
  /** the set dots, above the title as the pill shows them */
  dots?: ReactNode;
  /** the exercise to pin under the header */
  current: string | null;
  /** where the content was scrolled, when the Journal comes back after a sheet opened from it was cancelled */
  initialScroll?: number | null;
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const glassLayer = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closedRef = useRef(onClosed);
  useEffect(() => {
    closedRef.current = onClosed;
  }, [onClosed]);

  // The card's glass layer takes the pill's side (its unit's ctx-dark / ctx-light and, on the CSS path, its haze), so it
  // is the pill's material exactly, and follows the unit if it flips while the card is up
  useLayoutEffect(() => {
    const layer = glassLayer.current;
    const pill = pillRef.current;
    if (!layer || !pill) return;
    const unit = pill.closest<HTMLElement>("[data-glass-unit]") ?? pill;
    const copy = () => {
      layer.classList.toggle("ctx-dark", unit.classList.contains("ctx-dark"));
      layer.classList.toggle("ctx-light", unit.classList.contains("ctx-light"));
      const haze = unit.style.getPropertyValue("--haze-grey");
      if (haze) layer.style.setProperty("--haze-grey", haze);
      else layer.style.removeProperty("--haze-grey");
    };
    copy();
    const observer = new MutationObserver(copy);
    observer.observe(unit, { attributes: true, attributeFilter: ["class", "style"] });
    return () => observer.disconnect();
  }, [pillRef]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    const pill = pillRef.current;
    // shader mode: the pill grows with the card (its .pill-grow class is set by the parent while the card is mounted)
    const grow = glass === "shader" ? pill : null;
    // where the pill's containing block (the dock) sits against the card's stage, so .pill-grow can run .jcard's calc()
    const place = () => {
      const dock = grow?.parentElement;
      if (!grow || !dock) return;
      const s = el.getBoundingClientRect(), d = dock.getBoundingClientRect();
      grow.style.setProperty("--jc-dt", `${s.top - d.top}px`);
      grow.style.setProperty("--jc-dl", `${s.left - d.left}px`);
      grow.style.setProperty("--jc-dr", `${d.right - s.right}px`);
      grow.style.setProperty("--jc-db", `${d.bottom - s.bottom}px`);
      grow.style.setProperty("--jc-sh", `${s.height}px`);
    };
    place();
    if (grow) grow.setAttribute("data-glass-hold", "");
    // match mode: the stage stops drawing the pill's shader glass while the card's CSS glass stands in for it
    if (glass === "match" && pill) pill.setAttribute("data-glass-hidden", "");
    window.addEventListener("resize", place);
    let timer = 0;
    const setP = (p: number) => {
      el.classList.remove("settling");
      el.style.setProperty("--jp", String(p));
      if (grow) {
        grow.removeAttribute("data-settling");
        grow.removeAttribute("data-glass-hidden");
        grow.style.setProperty("--jp", String(p));
      }
    };
    const settle = (to: 0 | 1) => {
      el.classList.add("settling");
      el.style.setProperty("--jp", String(to));
      if (grow) {
        grow.setAttribute("data-settling", "");
        grow.removeAttribute("data-glass-hidden");
        grow.style.setProperty("--jp", String(to));
      }
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.classList.remove("settling");
        grow?.removeAttribute("data-settling");
        // open and opaque: the growing shader glass is covered, so stop drawing it
        if (to === 1) grow?.setAttribute("data-glass-hidden", "");
        if (to === 0) closedRef.current();
      }, SETTLE_MS);
    };
    controlRef.current = { setP, settle, scrollTop: () => body.current?.scrollTop ?? 0 };
    setP(startRef.current);
    // the current exercise sits right under the header from the first frame, or the content is back where it was left
    const cur = current ? body.current?.querySelector<HTMLElement>(`[data-we="${current}"]`) : null;
    const b = body.current;
    if (b && initialScroll != null) b.scrollTop = initialScroll;
    else if (cur && b) b.scrollTop = Math.max(0, cur.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 4);
    if (openOnMount) {
      void el.offsetWidth;
      settle(1);
    }
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("resize", place);
      controlRef.current = null;
      pill?.removeAttribute("data-glass-hidden");
      if (grow) {
        grow.removeAttribute("data-glass-hold");
        grow.removeAttribute("data-settling");
        for (const v of ["--jp", "--jc-dt", "--jc-dl", "--jc-dr", "--jc-db", "--jc-sh"]) grow.style.removeProperty(v);
      }
    };
    // mount only: the parent keys the card per opening
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && controlRef.current?.settle(0);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controlRef]);

  // Pull the header down to close, following the finger
  const drag = useRef<{ y: number; t: number; last: number; v: number; p: number; d: number; moved: boolean } | null>(null);
  const onDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    const el = stage.current;
    if (!el) return;
    const dockBottom = parseFloat(getComputedStyle(el).getPropertyValue("--dock-bottom")) || 21;
    drag.current = { y: e.clientY, t: e.timeStamp, last: 0, v: 0, p: 1, d: travel(el.clientHeight, dockBottom), moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onMove = (e: React.PointerEvent) => {
    const g = drag.current;
    if (!g) return;
    const down = e.clientY - g.y;
    if (!g.moved && down < 6) return;
    g.moved = true;
    g.v = (down - g.last) / Math.max(1, e.timeStamp - g.t);
    g.last = down;
    g.t = e.timeStamp;
    g.p = 1 - progressFor(down, g.d);
    controlRef.current?.setP(g.p);
  };
  const onUp = () => {
    const g = drag.current;
    drag.current = null;
    if (!g?.moved) return;
    controlRef.current?.settle(closesOnRelease(g.p, g.v) ? 0 : 1);
  };

  return createPortal(
    <div
      ref={stage}
      data-unpainted
      data-glass-mode={glass}
      className="jcard-stage"
      role="dialog"
      aria-modal="true"
      aria-label="Journal"
    >
      <div className="jcard-scrim" onClick={() => controlRef.current?.settle(0)} />
      {/* the pill's CSS glass, exactly, as the card's first layer; it hands over to the opaque fill early in the travel.
          None in shader mode, where the pill itself grows under the card. */}
      {/* data-glass-skip: never its own unit for the CSS path's context sampler; it takes the pill's side (above) */}
      {glass !== "shader" && <div ref={glassLayer} aria-hidden data-glass-skip className="glass glass-css jcard-glass" />}
      <div className="jcard">
        <div
          className="jcard-head touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          <span aria-hidden className="jcard-grabber" />
          {check}
          {/* the pill's own content, dots over the title, so the header reads as the pill grown (Frank's call, 2026-11-10) */}
          <span className="jcard-title flex min-w-0 flex-1 flex-col justify-center gap-1">
            {dots}
            <span className="w-full truncate text-[17px] font-semibold leading-[22px] tracking-[-0.43px]">{title}</span>
          </span>
          <GlassCircleButton label="Close Journal" onClick={() => controlRef.current?.settle(0)} className="jcard-close">
            <SfXmarkIcon size={17} />
          </GlassCircleButton>
        </div>
        <div ref={body} className="jcard-body">
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The circle that logs (Ladder's): empty until the set is logged, a blue fill for a moment when it is, Skip while
 * resting. A 2pt #0082f0 ring (Figma ZD41TUAEBtLJI7t0qChNup, 28:945) and a 17pt check, the kit's symbol size. 38pt in the
 * pill, 16pt from its every edge, as the kit's notification holds its icon; 44pt in the open card's header, the kit's
 * toolbar button (`--pill-check`, set by `.jcard-head`). Frank's calls, 2026-11-12, from the Journal Pill Lab.
 */
export function PillCheck({
  state,
  flash,
  done,
  disabled,
  onClick,
}: {
  /** every set of the shown exercise is logged: solid blue with a white check, at full strength (Frank's call, 2026-11-10) */
  done?: boolean;
  /** start and stop run a timed set: a stretch's hold, an outdoor run's stopwatch */
  state: "log" | "skip" | "finish" | "start" | "stop";
  flash: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const skip = state === "skip" && !flash;
  return (
    <button
      type="button"
      aria-label={
        done
          ? "All sets logged"
          : skip
          ? "Skip rest"
          : state === "finish"
            ? "Finish workout"
            : state === "start"
              ? "Start set"
              : state === "stop"
                ? "Stop and log set"
                : "Log set"
      }
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative grid shrink-0 place-items-center rounded-full",
        done ? "bg-blue text-white" : "disabled:opacity-50",
        flash ? "pill-check-fill bg-blue text-white" : !done && "shadow-[inset_0_0_0_2px_#0082f0]",
      )}
      style={{ width: "var(--pill-check, 38px)", height: "var(--pill-check, 38px)" }}
    >
      {/* the other states keep their old proportion to the check (21.25pt then, 17pt now) */}
      {skip ? (
        <SkipIcon size={16} />
      ) : state === "start" && !flash ? (
        <PlayIcon size={14.5} className="translate-x-[1px]" />
      ) : state === "stop" && !flash ? (
        <StopIcon size={13.5} />
      ) : (
        <CheckIcon size={17} strokeWidth={2.6} />
      )}
    </button>
  );
}
