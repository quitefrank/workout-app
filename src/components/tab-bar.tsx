"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { parsePages, parseTune, readTuneRaw, subscribeTune, tuneVars } from "@/lib/soft-edge-tune";
import { SoftEdge } from "./soft-edge";
import { formatClock } from "@/lib/workout/format";
import { LENS, lensGoal, lensSettled, lensShape, nearestIndex, restingLens, stepLens, type LensInput } from "@/lib/tab-lens";
import { lensState } from "@/glass/lens-state";
import type { TemplateSummary } from "@/lib/data/queries";
import type { NextTemplate } from "@/lib/programs/up-next";
import { ChevronRight } from "./icons";
import { SfSymbol } from "./sf-symbol";
import type { SfSymbolName } from "./sf-symbol-data";
import { StartWorkout } from "./start-workout";

/**
 * The floating tab bar: the kit's Tabs=4 bar, 62pt tall, 21pt in from
 * each side and up from the bottom, with iOS 26's selection lens (src/lib/tab-lens.ts):
 * a touch lifts the capsule into clear glass that travels to the tab, and a drag
 * carries it under the finger, selecting on release. The start button sits beside it
 * in the same row. A workout in progress rides above both as its own glass pill.
 */


// SF Symbols, as iOS tab bars use (Frank's call, 2026-11-11): filled where the symbol has a fill
const TABS: { href: string; label: string; symbol: SfSymbolName; match: (p: string) => boolean }[] = [
  { href: "/", label: "Home", symbol: "house.fill", match: (p: string) => p === "/" || p.startsWith("/workouts") || p.startsWith("/settings") },
  // Library: exercises, workouts and programs (Frank's call, 2026-11-11); square.stack.fill is Apple Music's Library symbol
  {
    href: "/library",
    label: "Library",
    symbol: "square.stack.fill",
    match: (p: string) => p.startsWith("/library") || p.startsWith("/templates") || p.startsWith("/programs") || p.startsWith("/exercises"),
  },
  { href: "/analytics", label: "Progress", symbol: "chart.line.uptrend.xyaxis", match: (p: string) => p.startsWith("/analytics") },
];

/** The active workout screen and a workout before it starts (a template) have their own bottom bar. */
const ACTIVE_WORKOUT = /^\/(workouts|templates)\/[^/]+$/;

/** The capsule is the tab plus 2pt each side, and the tab's 54pt height */
const CAPSULE_PAD = 2, CAPSULE_H = 54;
/** A press becomes a drag past this many px */
const DRAG_SLOP = 6;

export type InProgress = { id: string; name: string; startedAt: string | null } | null;

export function TabBar({ inProgress, templates, next }: { inProgress: InProgress; templates: TemplateSummary[]; next: NextTemplate | null }) {
  const pathname = usePathname() ?? "/";
  if (ACTIVE_WORKOUT.test(pathname)) return null;
  return (
    <nav
      aria-label="Main"
      data-glass-unit="dock"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-stretch gap-2.5 px-[21px]"
      // 21pt up from the screen edge (--dock-bottom); a home screen app places it from the top instead (globals.css)
        style={{ paddingBottom: "var(--dock-bottom)" }}
    >
      {/* the dock's content in its own box, so the edge measures from it and not from the column, which is the screen's
          height in a home screen app */}
      <div className="relative flex flex-col items-stretch gap-2.5">
        <DockEdge />
        {inProgress && <ResumePill workout={inProgress} />}
        <div className="mx-auto flex w-full max-w-[420px] items-center gap-2">
          <Tabs pathname={pathname} />
          <StartWorkout templates={templates} next={next} />
        </div>
      </div>
    </nav>
  );
}

/**
 * The Start Workout edge under the tab bar, on every page that has the bar (Frank's call, 2026-11-13, on by default,
 * switched in Settings): from the screen's bottom to the tuned reach above the dock's top, its blur and gradient from the
 * same sliders. In the painted page, so the bar's glass sits on the faded page; first, so the bar stacks over it.
 */
function DockEdge() {
  const raw = useSyncExternalStore(subscribeTune, readTuneRaw, () => null);
  const vars = useMemo(() => tuneVars(parseTune(raw)), [raw]);
  if (!parsePages(raw)) return null;
  return (
    <SoftEdge
      edge="bottom"
      tuned
      className="bottom-[calc(-1*var(--dock-bottom))] left-[calc(50%-50vw)] w-screen"
      style={{ ...vars, top: "calc(-1 * var(--se-reach, 40px))" }}
    />
  );
}

/** One tab's symbol and label. The bar draws every tab twice: once in the bar's ink, and once in the tint, clipped to
 *  the lens, so a lens half over a tab tints half of it, as the phone does. */
function TabFace({ label, symbol }: { label: string; symbol: SfSymbolName }) {
  return (
    <>
      <span className="relative flex h-7 items-center" data-tab-icon>
        <SfSymbol name={symbol} />
      </span>
      <span className="relative" data-tab-label>{label}</span>
    </>
  );
}

const TAB_CLASS = "relative flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-full px-2 pb-[7px] pt-1.5 text-[10px] font-semibold leading-3";

function Tabs({ pathname }: { pathname: string }) {
  const router = useRouter();
  const matched = TABS.findIndex((t) => t.match(pathname));
  // a tab picked here shows as selected at once, before its page has loaded; the route catching up clears it
  const [picked, setPicked] = useState<{ i: number; from: string } | null>(null);
  const selected = picked && picked.from === pathname ? picked.i : matched;

  const barRef = useRef<HTMLDivElement>(null);
  const lensRef = useRef<HTMLSpanElement>(null);
  const tintRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const drive = useRef({ s: restingLens(), input: { pressed: false, dragX: null } as LensInput, selected, raf: 0, last: 0 });
  const kickRef = useRef<() => void>(() => {});

  useLayoutEffect(() => {
    const d = drive.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const frame = (now: number) => {
      const bar = barRef.current, lens = lensRef.current, tint = tintRef.current;
      if (!bar || !lens || !tint) { d.raf = 0; return; }
      const dt = Math.min(100, now - d.last); d.last = now;
      // offsets ignore the bar's swell, so everything here is the bar's own px, from its centre
      const half = bar.clientWidth / 2, midY = bar.clientHeight / 2;
      const tabs = tabRefs.current.filter((t): t is HTMLAnchorElement => !!t);
      const centres = tabs.map((t) => t.offsetLeft + t.offsetWidth / 2 - half);
      const sel = tabs[d.selected] ? d.selected : -1;
      const goal = sel < 0 ? 0 : lensGoal(centres, sel, d.input);
      d.s = sel < 0 ? restingLens() : stepLens(d.s, goal, d.input, LENS, dt, reduce.matches);
      const restW = sel < 0 ? 0 : tabs[sel].offsetWidth + 2 * CAPSULE_PAD;
      const shape = lensShape(d.s, restW, sel < 0 ? 0 : CAPSULE_H, LENS);
      bar.style.transform = shape.swell === 1 ? "" : `scale(${shape.swell})`;
      const left = half + shape.x - shape.w / 2, top = midY - shape.h / 2;
      lens.style.width = `${shape.w}px`; lens.style.height = `${shape.h}px`;
      lens.style.transform = `translate(${left}px, ${top}px)`;
      lens.style.setProperty("--lens-lift", String(shape.lift));
      tint.style.clipPath = shape.w
        ? `inset(${top}px ${bar.clientWidth - left - shape.w}px ${bar.clientHeight - top - shape.h}px ${left}px round ${shape.h / 2}px)`
        : "inset(50%)";
      Object.assign(lensState, { bar, x: shape.x, w: shape.w, h: shape.h, lift: shape.lift, swell: shape.swell });
      d.raf = sel >= 0 && !lensSettled(d.s, goal, d.input) ? requestAnimationFrame(frame) : 0;
    };
    const kick = () => { if (!d.raf) { d.last = performance.now(); d.raf = requestAnimationFrame(frame); } };
    kickRef.current = kick;
    kick();
    // a new width (rotation, the window) moves every tab: one frame puts the lens back under its tab
    const bar = barRef.current;
    const ro = new ResizeObserver(kick);
    if (bar) ro.observe(bar);
    return () => {
      ro.disconnect(); cancelAnimationFrame(d.raf); d.raf = 0;
      if (lensState.bar === bar) lensState.bar = null;
    };
  }, []);

  useEffect(() => { drive.current.selected = selected; kickRef.current(); }, [selected]);

  // A touch lifts the lens; a tap then selects through the tab's own link (so keys and VoiceOver work as they always
  // did); a drag past the slop takes the pointer, carries the lens under the finger and selects the nearest tab on
  // release, swallowing the click that can follow it.
  const gesture = useRef({ id: -1, downX: 0, dragging: false, swallow: false });
  const barX = (e: ReactPointerEvent) => {
    const bar = barRef.current!; const r = bar.getBoundingClientRect();
    return (e.clientX - (r.left + r.width / 2)) / (r.width / bar.offsetWidth || 1);
  };
  const release = (commit: boolean, e: ReactPointerEvent) => {
    const g = gesture.current, d = drive.current;
    if (e.pointerId !== g.id) return;
    if (g.dragging && commit) {
      const bar = barRef.current!;
      const centres = tabRefs.current.map((t) => (t ? t.offsetLeft + t.offsetWidth / 2 - bar.clientWidth / 2 : Infinity));
      const i = nearestIndex(centres, barX(e));
      g.swallow = true;
      if (i !== selected) { setPicked({ i, from: pathname }); router.push(TABS[i].href); }
    }
    g.id = -1; g.dragging = false;
    d.input = { pressed: false, dragX: null };
    kickRef.current();
  };

  return (
    <div
      ref={barRef}
      // switching tabs is not a push on iOS (src/components/page-transitions.tsx)
      data-nav="none"
      className="glass pointer-events-auto relative flex h-[62px] min-w-0 flex-1 touch-none items-center px-1.5 py-1"
      onPointerDown={(e) => {
        if (e.button > 0) return;
        gesture.current = { id: e.pointerId, downX: e.clientX, dragging: false, swallow: false };
        drive.current.input = { pressed: true, dragX: null };
        kickRef.current();
      }}
      onPointerMove={(e) => {
        const g = gesture.current;
        if (e.pointerId !== g.id) return;
        if (!g.dragging && Math.abs(e.clientX - g.downX) > DRAG_SLOP) {
          g.dragging = true;
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        if (g.dragging) { drive.current.input = { pressed: true, dragX: barX(e) }; kickRef.current(); }
      }}
      onPointerUp={(e) => release(true, e)}
      onPointerCancel={(e) => release(false, e)}
      onClickCapture={(e) => {
        if (!gesture.current.swallow) return;
        gesture.current.swallow = false;
        e.preventDefault(); e.stopPropagation();
      }}
    >
      <span ref={lensRef} aria-hidden data-tab-lens />
      {TABS.map(({ href, label, symbol }, i) => (
        <Link
          key={href}
          ref={(el) => { tabRefs.current[i] = el; }}
          href={href}
          draggable={false}
          aria-current={i === selected ? "page" : undefined}
          onClick={() => { if (i !== selected) setPicked({ i, from: pathname }); }}
          className={cn(TAB_CLASS, "text-[var(--glass-ink)] [-webkit-touch-callout:none]", i > 0 && "-ml-2")}
          data-tab-ink
        >
          <TabFace label={label} symbol={symbol} />
        </Link>
      ))}
      {/* the tint, laid out as the tabs are and clipped to the lens */}
      <div ref={tintRef} aria-hidden data-tab-ink className="pointer-events-none absolute inset-0 flex items-center px-1.5 py-1 text-[var(--glass-ink-on)]">
        {TABS.map(({ href, label, symbol }, i) => (
          <span key={href} className={cn(TAB_CLASS, i > 0 && "-ml-2")}>
            <TabFace label={label} symbol={symbol} />
          </span>
        ))}
      </div>
    </div>
  );
}

function ResumePill({ workout }: { workout: NonNullable<InProgress> }) {
  const elapsed = useElapsed(workout.startedAt);
  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="glass pointer-events-auto mx-auto flex h-12 w-full max-w-[420px] items-center gap-3 pl-5 pr-3 text-[15px]"
    >
      <span className="relative flex size-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-green opacity-60" />
        <span className="relative size-2.5 rounded-full bg-green" />
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{workout.name}</span>
      {elapsed != null && <span className="tabular text-[var(--glass-ink)] opacity-70">{formatClock(elapsed)}</span>}
      <ChevronRight size={16} className="opacity-60" />
    </Link>
  );
}

/** Seconds since `startedAt`, ticking once a second; null before mount so server and client agree. */
export function useElapsed(startedAt: string | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt || now == null) return null;
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}
