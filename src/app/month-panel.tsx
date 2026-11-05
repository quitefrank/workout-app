"use client";

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent, type RefObject } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight } from "@/components/icons";
import { cn } from "@/lib/cn";
import type { CalendarDots } from "@/lib/workout/calendar";
import { formatYearMonth, gridBounds, monthGrid, monthOf, monthTitle, shiftMonth, type YearMonth } from "@/lib/workout/dates";
import { DayCell } from "./day-cell";

const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
/** Off the MFP screenshot, at 3x on a 375pt screen: the panel 319pt wide (85%), 13pt under the title, 24pt corners */
const GAP = 13;
const RADIUS = 24;
/** The pinned bar's foot, so a title half scrolled under it does not put the panel under the bar */
const MIN_TOP = 56;
/** month-panel-out in globals.css, plus a margin */
const CLOSE_MS = 200;

/**
 * The floating month from MFP's date title, in the sheet material. A panel is large glass, so it keeps the page's
 * appearance. It stays mounted, hidden, so its shaders are built before it first opens, as the Sheet does. There is no
 * scrim: a clear layer catches the tap that closes it.
 */
export function MonthPanel({
  open,
  onClose,
  anchor,
  selected,
  today,
  dots,
  ensure,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  anchor: RefObject<HTMLElement | null>;
  selected: string;
  today: string;
  dots: CalendarDots;
  ensure: (from: string, to: string) => void;
  onPick: (date: string) => void;
}) {
  const panel = useRef<HTMLDivElement>(null);
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

  // Placed under the title before the frame that shows it
  useLayoutEffect(() => {
    if (!open) return;
    const r = anchor.current?.getBoundingClientRect();
    if (r && panel.current) {
      panel.current.style.top = `${Math.max(r.bottom + GAP, MIN_TOP)}px`;
      panel.current.style.left = `${r.left}px`;
    }
  }, [open, anchor]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    panel.current?.focus();
    const back = anchor.current;
    return () => {
      window.removeEventListener("keydown", onKey);
      back?.focus({ preventScroll: true });
    };
  }, [open, onClose, anchor]);

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
      {open && <div onClick={onClose} aria-hidden className="fixed inset-0 z-50" />}
      <div
        ref={panel}
        role="dialog"
        aria-label="Choose a date"
        aria-hidden={!open}
        data-glass-skip
        data-closing={phase === "closing" ? "" : undefined}
        tabIndex={-1}
        className={cn("glass-sheet month-panel fixed z-50 w-[min(85vw,340px)] outline-none", phase === "hidden" && "hidden")}
        style={{ ["--r" as string]: `${RADIUS}px`, borderRadius: RADIUS }}
      >
        {phase !== "hidden" && <Contents key={opens} selected={selected} today={today} dots={dots} ensure={ensure} onPick={onPick} />}
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
      <div className="flex h-11 items-center justify-between pl-2">
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
          <div className="grid grid-cols-7 pb-1 pt-1 text-center text-[13px] font-semibold text-ink-3">
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
