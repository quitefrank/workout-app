"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState, type ComponentType, type PointerEvent as ReactPointerEvent } from "react";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/workout/format";
import { LENS, lensGoal, lensSettled, lensShape, nearestIndex, restingLens, stepLens, type LensInput } from "@/lib/tab-lens";
import { lensState } from "@/glass/lens-state";
import { CalendarIcon, ChevronRight, LibraryIcon, ProgressIcon, TemplatesIcon } from "./icons";

/**
 * The floating tab bar: the kit's Tabs=4 bar, 62pt tall, 21pt in from
 * each side and up from the bottom, with iOS 26's selection lens (src/lib/tab-lens.ts):
 * a touch lifts the capsule into clear glass that travels to the tab, and a drag
 * carries it under the finger, selecting on release. A workout in progress rides
 * above it as its own glass pill.
 */

type IconType = ComponentType<{ size?: number; strokeWidth?: number }>;

const TABS: { href: string; label: string; Icon: IconType; match: (p: string) => boolean }[] = [
  { href: "/", label: "Calendar", Icon: CalendarIcon, match: (p: string) => p === "/" || p.startsWith("/workouts") },
  { href: "/templates", label: "Templates", Icon: TemplatesIcon, match: (p: string) => p.startsWith("/templates") || p.startsWith("/programs") },
  { href: "/exercises", label: "Library", Icon: LibraryIcon, match: (p: string) => p.startsWith("/exercises") },
  { href: "/analytics", label: "Progress", Icon: ProgressIcon, match: (p: string) => p.startsWith("/analytics") },
];

/** The active workout screen has its own bottom bar. */
const ACTIVE_WORKOUT = /^\/workouts\/[^/]+$/;

/** The capsule is the tab plus 2pt each side, and the tab's 54pt height */
const CAPSULE_PAD = 2, CAPSULE_H = 54;
/** A press becomes a drag past this many px */
const DRAG_SLOP = 6;

export type InProgress = { id: string; name: string; startedAt: string | null } | null;

export function TabBar({ inProgress }: { inProgress: InProgress }) {
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
      {inProgress && <ResumePill workout={inProgress} />}
      <Tabs pathname={pathname} />
    </nav>
  );
}

/** One tab's symbol and label. The bar draws every tab twice: once in the bar's ink, and once in the tint, clipped to
 *  the lens, so a lens half over a tab tints half of it, as the phone does. */
function TabFace({ label, Icon, bold }: { label: string; Icon: IconType; bold: boolean }) {
  return (
    <>
      <span className="relative flex h-7 items-center" data-tab-icon>
        <Icon size={24} strokeWidth={bold ? 2.2 : 1.9} />
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
      className="glass pointer-events-auto relative mx-auto flex h-[62px] w-full max-w-[420px] touch-none items-center px-1.5 py-1"
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
      {TABS.map(({ href, label, Icon }, i) => (
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
          <TabFace label={label} Icon={Icon} bold={i === selected} />
        </Link>
      ))}
      {/* the tint, laid out as the tabs are and clipped to the lens */}
      <div ref={tintRef} aria-hidden data-tab-ink className="pointer-events-none absolute inset-0 flex items-center px-1.5 py-1 text-[var(--glass-ink-on)]">
        {TABS.map(({ href, label, Icon }, i) => (
          <span key={href} className={cn(TAB_CLASS, i > 0 && "-ml-2")}>
            <TabFace label={label} Icon={Icon} bold={i === selected} />
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
