"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { CalendarDots } from "@/lib/workout/calendar";
import { formatYearMonth, gridBounds, monthGrid, monthOf, monthTitle, shiftMonth, type YearMonth } from "@/lib/workout/dates";
import { DayCell } from "./day-cell";

const WEEKDAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** The glass at its smallest: a pill round the date, B tall, this far past the date at each end */
const PILL_PAD = 10;
/** The B of `.month-panel` in globals.css */
const PILL_H = 44;
/** The pinned bar's foot, so a date half scrolled under it does not put the panel under the bar */
const MIN_TOP = 56;
/** The close curves in globals.css (320ms), plus a margin */
const CLOSE_MS = 340;
/** When the real date comes back under its copy on the glass: as the glass starts to dissolve, so it is painted in time */
const DATE_BACK_MS = 256;

/**
 * The month opens with Liquid Glass's menu morph (the motion is `.month-panel` in globals.css): the date becomes the
 * panel and the panel closes back into the date. The glass starts as a pill round the date, pinned at its top-left, and
 * covers it. The date is plain text at rest, not glass, so a copy of it rides on the glass as the handoff's glyph does,
 * gone on the first frame and back at 200ms of the close, and the glass dissolves as it lands. A panel is large glass,
 * so it keeps the page's appearance, and it is the CSS material on both paths, as the Sheet is. There is no scrim: a clear layer catches the tap that closes it.
 */
export function MonthPanel({
  open,
  onClose,
  anchor,
  heading,
  onCovering,
  selected,
  today,
  dots,
  ensure,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  heading: ReactNode;
  /** The panel has the date on its glass, so the real one should not show */
  onCovering: (covering: boolean) => void;
  selected: string;
  today: string;
  dots: CalendarDots;
  ensure: (from: string, to: string) => void;
  onPick: (date: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const opened = useRef(false);
  const [opens, setOpens] = useState(0); // a new count starts the contents over, on the selected month
  const [phase, setPhase] = useState<"hidden" | "open" | "closing">("hidden");
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setOpens(opens + 1);
      setPhase("open");
    } else {
      setPhase("closing");
    }
  }

  // The glass grows to the contents' height, which changes from month to month
  useLayoutEffect(() => {
    const el = panel.current, inner = content.current;
    if (!el || !inner) return;
    const measure = () => el.style.setProperty("--H", `${inner.offsetHeight}px`);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [phase]);

  // Placed round the date, then one style pass at that size, so the state change has a size to morph from
  useLayoutEffect(() => {
    const el = panel.current, date = anchor.current;
    if (!el || !date || (!open && !opened.current)) return;
    opened.current = true;
    const r = date.getBoundingClientRect();
    const top = Math.max(r.top + r.height / 2 - PILL_H / 2, MIN_TOP), left = r.left - PILL_PAD;
    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
    el.style.setProperty("--W0", `${r.width + PILL_PAD * 2}px`); // measured on close too: picking a day changes the date
    el.style.setProperty("--date-x", `${r.left - left}px`);
    el.style.setProperty("--date-y", `${r.top - top}px`);
    if (open) {
      onCovering(true);
      el.getBoundingClientRect();
    }
    el.dataset.state = open ? "open" : "closed";
    if (open) return;
    const back = setTimeout(() => {
      onCovering(false);
      date.focus({ preventScroll: true });
    }, DATE_BACK_MS);
    return () => clearTimeout(back);
  }, [open, anchor, onCovering]);

  useEffect(() => {
    if (open) panel.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (phase !== "closing") return;
    const timer = setTimeout(() => setPhase("hidden"), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
  if (!mounted) return null;
  return createPortal(
    <>
      {open && <div onClick={onClose} aria-hidden data-screen-fill className="fixed inset-0 z-50" />}
      <div
        ref={panel}
        role="dialog"
        aria-label="Choose a date"
        aria-hidden={!open}
        data-glass-skip
        data-state="closed" // the starting point; the layout effect above moves it, and React leaves an unchanged prop alone
        tabIndex={-1}
        className={cn("glass-sheet month-panel fixed z-50 outline-none", phase === "hidden" && "hidden")}
      >
        {phase !== "hidden" && (
          <>
            <div ref={content} className="month-panel-content">
              <Contents key={opens} selected={selected} today={today} dots={dots} ensure={ensure} onPick={onPick} />
            </div>
            <div aria-hidden className="month-panel-date inline-flex items-center gap-2.5 text-[34px] font-bold leading-[41px] tracking-[-0.01em]">
              {heading}
            </div>
          </>
        )}
      </div>
    </>,
    document.body,
  );
}

const noop = () => () => {};

function Contents({
  selected,
  today,
  dots,
  ensure,
  onPick,
}: {
  selected: string;
  today: string;
  dots: CalendarDots;
  ensure: (from: string, to: string) => void;
  onPick: (date: string) => void;
}) {
  const [month, setMonth] = useState<YearMonth>(() => monthOf(selected));
  const [choosing, setChoosing] = useState(false); // the month and year chooser, in place of the days
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  useEffect(() => {
    const { from, to } = gridBounds(month);
    ensure(from, to);
  }, [month, ensure]);

  const step = (delta: number) => setMonth((m) => shiftMonth(m, choosing ? delta * 12 : delta));
  const onDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swiped.current = true;
    step(dx < 0 ? 1 : -1);
  };
  const picked = (date: string) => {
    if (swiped.current) { swiped.current = false; return; }
    onPick(date);
  };

  return (
    <div className="relative px-3 pb-4 pt-3.5">
      <div className="flex h-11 items-center justify-between">
        <button type="button" aria-expanded={choosing} onClick={() => setChoosing(!choosing)} className="flex h-11 items-center gap-1.5 text-[17px] font-semibold active:opacity-70">
          {monthTitle(month)}
          <ChevronRight size={16} strokeWidth={2.6} className={cn("text-blue", choosing && "rotate-90")} />
        </button>
        <div className="flex">
          <button type="button" aria-label={choosing ? "Previous year" : "Previous month"} onClick={() => step(-1)} className="grid size-11 place-items-center active:opacity-70">
            <ChevronLeft size={20} strokeWidth={2.4} />
          </button>
          <button type="button" aria-label={choosing ? "Next year" : "Next month"} onClick={() => step(1)} className="grid size-11 place-items-center active:opacity-70">
            <ChevronRight size={20} strokeWidth={2.4} />
          </button>
        </div>
      </div>

      {choosing ? (
        <div className="mt-2 grid grid-cols-3 gap-y-1">
          {MONTHS.map((name, i) => {
            const ym = { year: month.year, month: i + 1 };
            const isMonth = formatYearMonth(ym) === formatYearMonth(month);
            return (
              <button
                key={name}
                type="button"
                aria-pressed={isMonth}
                onClick={() => {
                  setMonth(ym);
                  setChoosing(false);
                }}
                className={cn("mx-auto h-11 w-[72px] rounded-full text-[17px] active:opacity-70", isMonth && "bg-ink font-semibold text-bg")}
              >
                {name}
              </button>
            );
          })}
        </div>
      ) : (
        <div role="grid" onPointerDown={onDown} onPointerUp={onUp} onPointerCancel={() => (swipe.current = null)} className="touch-pan-y">
          <div className="grid grid-cols-7 pb-1 pt-1 text-center text-[13px] font-semibold text-ink-2">
            {WEEKDAYS.map((d) => (
              <div key={d}>{d}</div>
            ))}
          </div>
          {monthGrid(month).map((week) => (
            <div key={week[0].date} role="row" className="grid h-[46px] grid-cols-7">
              {week.map((cell) =>
                cell.inMonth ? (
                  <DayCell key={cell.date} cell={cell} dots={dots[cell.date]} today={today} selected={selected} onPick={picked} />
                ) : (
                  <div key={cell.date} />
                ),
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
