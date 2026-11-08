"use client";

import { useEffect, useLayoutEffect, useRef, type MutableRefObject, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { CheckIcon, SkipIcon } from "@/components/icons";
import { cn } from "@/lib/cn";
import { closesOnRelease, progressFor, travel } from "@/lib/workout/journal-card";

/**
 * The pill layout's Journal (Frank's call, 2026-11-08, aligned in the teardown prototype): the pill grows into it and
 * back. One card whose shape follows `--jp`, a registered property from 0 (exactly the pill) to 1 (open under the status
 * bar): its sides and bottom move out to the edges, its top follows the finger, and the content is in it the whole time,
 * the current exercise pinned under the header, as Ladder does (Supercut hW8oIanK6sdvLXdtmNSqaH). The circle never moves
 * sideways: the header's padding gives back what the card's inset takes. Geometry in `.jcard` (globals.css), decisions in
 * src/lib/workout/journal-card.ts.
 *
 * The parent drives it: `controlRef` sets the progress while a finger drags the pill and settles it open or closed. The card
 * is CSS on both glass paths (`data-unpainted`), as sheets are, and above the canvas.
 */

export type CardControl = { setP: (p: number) => void; settle: (to: 0 | 1) => void };

/** How long a settle runs, in ms (the `--jp` transition in globals.css) */
const SETTLE_MS = 440;

export function JournalCard({
  controlRef,
  startRef,
  openOnMount,
  onClosed,
  check,
  title,
  label,
  count,
  current,
  children,
}: {
  controlRef: MutableRefObject<CardControl | null>;
  /** where the card starts: the finger's progress if a drag opened it, else 0 */
  startRef: MutableRefObject<number>;
  /** a tap or a swipe opened it: grow to open on mount */
  openOnMount: boolean;
  onClosed: () => void;
  check: ReactNode;
  title: string;
  label?: string;
  count?: string;
  /** the exercise to pin under the header */
  current: string | null;
  children: ReactNode;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const body = useRef<HTMLDivElement>(null);
  const closedRef = useRef(onClosed);
  useEffect(() => {
    closedRef.current = onClosed;
  }, [onClosed]);

  useLayoutEffect(() => {
    const el = stage.current;
    if (!el) return;
    let timer = 0;
    const setP = (p: number) => {
      el.classList.remove("settling");
      el.style.setProperty("--jp", String(p));
    };
    const settle = (to: 0 | 1) => {
      el.classList.add("settling");
      el.style.setProperty("--jp", String(to));
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        el.classList.remove("settling");
        if (to === 0) closedRef.current();
      }, SETTLE_MS);
    };
    controlRef.current = { setP, settle };
    setP(startRef.current);
    // the current exercise sits right under the header from the first frame
    const cur = current ? body.current?.querySelector<HTMLElement>(`[data-we="${current}"]`) : null;
    const b = body.current;
    if (cur && b) b.scrollTop = Math.max(0, cur.getBoundingClientRect().top - b.getBoundingClientRect().top + b.scrollTop - 4);
    if (openOnMount) {
      void el.offsetWidth;
      settle(1);
    }
    return () => {
      window.clearTimeout(timer);
      controlRef.current = null;
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
    <div ref={stage} data-unpainted className="jcard-stage" role="dialog" aria-modal="true" aria-label="Journal">
      <div className="jcard-scrim" onClick={() => controlRef.current?.settle(0)} />
      <div className="jcard">
        <div
          className="jcard-head touch-none select-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        >
          {check}
          <span className="min-w-0 flex-1 truncate text-[17px] font-semibold tracking-[-0.43px]">
            {title}
            {label && <span className="jcard-label text-blue"> · {label}</span>}
          </span>
          {count && <span className="tabular shrink-0 text-[17px] text-blue">{count}</span>}
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
 * resting. 26pt with a 44pt touch area; it sits 50pt from the screen's edge in the pill and in the card's header.
 */
export function PillCheck({
  state,
  flash,
  disabled,
  onClick,
}: {
  state: "log" | "skip" | "finish";
  flash: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const skip = state === "skip" && !flash;
  return (
    <button
      type="button"
      aria-label={skip ? "Skip rest" : state === "finish" ? "Finish workout" : "Log set"}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={cn(
        "relative grid size-[26px] shrink-0 place-items-center rounded-full after:absolute after:-inset-[9px] after:content-[''] disabled:opacity-50",
        flash ? "pill-check-fill bg-blue text-white" : "text-white/90 shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.85)]",
      )}
    >
      {skip ? <SkipIcon size={13} /> : <CheckIcon size={14} strokeWidth={flash ? 2.6 : 1.8} />}
    </button>
  );
}
