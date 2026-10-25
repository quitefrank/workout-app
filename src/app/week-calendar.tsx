"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { hueStyle } from "@/components/page";
import { cn } from "@/lib/cn";
import { dayLabel, shiftDate, shiftDateMonth, weekIndexOf, type CalendarCell } from "@/lib/workout/dates";

export type CalendarDot = { id: string; category: string | null; done: boolean };
export type CalendarDay = CalendarCell & { dots: CalendarDot[] };

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
/** One week row: the 48pt day cell and the 4pt between rows */
const ROW = 52;
/** iOS's sheet curve, for the snap after a drag */
const SNAP = "320ms cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Runna's week strip over the month, as iOS Calendar folds its month into a week: the whole month grid is laid out and
 * the window over it is one row tall, slid to the selected week. The handle under it drags the window open to the
 * month and back (a tap toggles, a flick follows its direction), a sideways swipe moves a week, or a month when open.
 * The selected day lives in the URL (`?d=`), so the server renders that day's workouts below.
 */
export function WeekCalendar({ weeks, selected, today }: { weeks: CalendarDay[][]; selected: string; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(0); // 0 the week, 1 the month
  const [dragging, setDragging] = useState(false);
  const drag = useRef<{ y: number; open: number; lastY: number; lastT: number; v: number } | null>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  const range = (weeks.length - 1) * ROW;
  const row = weekIndexOf(weeks, selected);
  const go = (date: string) => router.replace(`/?d=${date}`, { scroll: false });
  const transition = dragging ? "none" : `height ${SNAP}, transform ${SNAP}`;

  const onHandleDown = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y: e.clientY, open, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    setDragging(true);
  };
  const onHandleMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY; d.lastT = e.timeStamp;
    setOpen(Math.min(1, Math.max(0, d.open + (e.clientY - d.y) / range)));
  };
  const onHandleUp = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    setDragging(false);
    if (!d) return;
    const moved = Math.abs(e.clientY - d.y);
    const now = Math.min(1, Math.max(0, d.open + (e.clientY - d.y) / range));
    // a tap toggles; a flick goes where it was thrown; a slow drag settles on the nearer end
    setOpen(moved < 6 ? (d.open > 0.5 ? 0 : 1) : Math.abs(d.v) > 0.35 ? (d.v > 0 ? 1 : 0) : now > 0.5 ? 1 : 0);
  };
  const onHandleKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    setOpen(open > 0.5 ? 0 : 1);
  };

  const onGridDown = (e: PointerEvent<HTMLDivElement>) => {
    swipe.current = { x: e.clientX, y: e.clientY };
    swiped.current = false;
  };
  const onGridUp = (e: PointerEvent<HTMLDivElement>) => {
    const s = swipe.current;
    swipe.current = null;
    if (!s) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    swiped.current = true;
    const ahead = dx < 0 ? 1 : -1;
    go(open > 0.5 ? shiftDateMonth(selected, ahead) : shiftDate(selected, 7 * ahead));
  };

  return (
    <section aria-label="Calendar" className="mt-3 px-4">
      <div className="grid grid-cols-7 pb-1 text-center text-[13px] font-semibold text-ink-3">
        {WEEKDAYS.map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>
      <div
        role="grid"
        onPointerDown={onGridDown}
        onPointerUp={onGridUp}
        onPointerCancel={() => (swipe.current = null)}
        className="overflow-hidden touch-pan-y"
        style={{ height: ROW + range * open, transition }}
      >
        <div style={{ transform: `translateY(${-row * ROW * (1 - open)}px)`, transition }}>
          {weeks.map((week, w) => (
            <div key={w} role="row" className="grid h-[52px] grid-cols-7">
              {week.map((cell) => {
                const isToday = cell.date === today;
                const isSelected = cell.date === selected;
                return (
                  <button
                    key={cell.date}
                    type="button"
                    role="gridcell"
                    aria-selected={isSelected}
                    aria-label={`${dayLabel(cell.date)}${cell.dots.length ? `, ${cell.dots.length} workout${cell.dots.length > 1 ? "s" : ""}` : ""}`}
                    onClick={() => {
                      if (swiped.current) { swiped.current = false; return; }
                      if (!isSelected) go(cell.date);
                    }}
                    className="flex h-12 flex-col items-center justify-start gap-1 pt-1"
                  >
                    <span
                      className={cn(
                        "tabular grid size-8 place-items-center rounded-full text-[17px]",
                        !cell.inMonth && "text-ink-3",
                        isToday && !isSelected && "font-semibold text-red",
                        isSelected && (isToday ? "bg-red font-semibold text-white" : "bg-ink font-semibold text-bg"),
                      )}
                    >
                      {cell.day}
                    </span>
                    <span className="flex h-1.5 gap-[3px]">
                      {cell.dots.slice(0, 3).map((d) => (
                        <span
                          key={d.id}
                          style={hueStyle(d.category)}
                          className={cn(
                            "size-1.5 rounded-full",
                            d.done ? "bg-[hsl(var(--h)_70%_52%)]" : "ring-1 ring-[hsl(var(--h)_70%_52%)] ring-inset",
                          )}
                        />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={open > 0.5}
        aria-label={open > 0.5 ? "Show the week" : "Show the month"}
        onPointerDown={onHandleDown}
        onPointerMove={onHandleMove}
        onPointerUp={onHandleUp}
        onPointerCancel={onHandleUp}
        onKeyDown={onHandleKey}
        className="flex h-7 cursor-grab touch-none items-center justify-center"
      >
        <span className="h-[5px] w-9 rounded-full bg-ink-3" />
      </div>
    </section>
  );
}
