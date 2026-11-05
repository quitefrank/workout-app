"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { LargeTitle } from "@/components/page";
import { cn } from "@/lib/cn";
import type { CalendarDots } from "@/lib/workout/calendar";
import { dayTitle, sameWeekdayIn, shiftDate, weekCells, weekNumber } from "@/lib/workout/dates";
import { DayCell } from "./day-cell";
import { MonthPanel } from "./month-panel";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
/** Weeks reachable from 1970, past the year 2080: the strip has no end anyone reaches */
const WEEKS = 6000;
/** Weeks rendered either side of the one in view; a swipe stops at each week, so these are never outrun */
const RENDERED = 2;
/** Weeks of dots kept loaded either side of the one in view */
const LOADED = 8;
/** How long the strip must be still before it counts as settled, for browsers without `scrollend` */
const SETTLE_MS = 120;

/**
 * MyFitnessPal's date header: the title is the selected day and opens the month panel, and the week strip scrolls
 * sideways a week at a time. A swipe selects the same weekday in the week it lands on, once it has settled. The strip
 * is one native scroller as wide as every week, with only the weeks near the view rendered, each placed by its week
 * number, so the scroll position never needs correcting. The selected day lives in the URL (`?d=`), so the server
 * renders that day's workouts below; the title and the strip answer at once, ahead of that render.
 */
export function WeekCalendar({ selected, today, days, trailing }: { selected: string; today: string; days: CalendarDots; trailing?: ReactNode }) {
  const router = useRouter();
  const strip = useRef<HTMLDivElement>(null);
  const title = useRef<HTMLButtonElement>(null);
  const [width, setWidth] = useState(0); // 0 until measured: the server and the first render draw the one week, in flow
  const [panelOpen, setPanelOpen] = useState(false);

  // The day shown leads the URL. `pending` is the day last asked for, so a slower answer to an earlier swipe cannot pull it back
  const [day, setDay] = useState(selected);
  const [urlDay, setUrlDay] = useState(selected);
  const [pending, setPending] = useState<string | null>(null);
  if (selected !== urlDay) {
    setUrlDay(selected);
    if (pending === null || pending === selected) {
      setPending(null);
      setDay(selected);
    }
  }

  const dayWeek = weekNumber(day);
  const [inView, setInView] = useState(dayWeek);

  const pick = useCallback(
    (date: string) => {
      setDay(date);
      setPending(date === selected ? null : date);
      router.replace(`/?d=${date}`, { scroll: false });
    },
    [router, selected],
  );

  const closePanel = useCallback(() => setPanelOpen(false), []);

  useLayoutEffect(() => {
    const el = strip.current;
    if (!el) return;
    const measure = () => setWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Before the first paint and whenever the day moves from outside the strip (the panel, the Today link)
  useLayoutEffect(() => {
    const el = strip.current;
    if (el && width && Math.abs(el.scrollLeft - dayWeek * width) > width / 2) {
      el.scrollTo({ left: dayWeek * width, behavior: "instant" });
    }
  }, [dayWeek, width]);

  useEffect(() => {
    const el = strip.current;
    if (!el || !width) return;
    let timer: ReturnType<typeof setTimeout>;
    const settle = () => {
      const week = Math.round(el.scrollLeft / width);
      // a finger holding the strip between weeks is not a landing
      if (Math.abs(el.scrollLeft - week * width) <= 1 && week !== weekNumber(day)) pick(sameWeekdayIn(day, week));
    };
    const onScroll = () => {
      setInView(Math.round(el.scrollLeft / width));
      clearTimeout(timer);
      timer = setTimeout(settle, SETTLE_MS);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.addEventListener("scrollend", settle);
    return () => {
      clearTimeout(timer);
      el.removeEventListener("scroll", onScroll);
      el.removeEventListener("scrollend", settle);
    };
  }, [day, width, pick]);

  // Dots: what the server sent for the selected month, over what has been fetched as weeks came near
  const [fetched, setFetched] = useState<CalendarDots>({});
  const dots = useMemo(() => ({ ...fetched, ...days }), [fetched, days]);
  const inFlight = useRef(new Set<string>());
  const ensure = useCallback(
    (from: string, to: string) => {
      const key = `${from}|${to}`;
      let missing = false;
      for (let d = from; d <= to && !missing; d = shiftDate(d, 1)) missing = !(d in dots);
      if (!missing || inFlight.current.has(key)) return;
      inFlight.current.add(key);
      fetch(`/api/calendar?from=${from}&to=${to}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((r: { days: CalendarDots } | null) => r && setFetched((prev) => ({ ...prev, ...r.days })))
        .catch(() => {}) // no dots until the week comes near again; the strip itself never waits on them
        .finally(() => inFlight.current.delete(key));
    },
    [dots],
  );
  useEffect(() => {
    ensure(weekCells(inView - LOADED)[0].date, weekCells(inView + LOADED)[6].date);
  }, [inView, ensure]);

  const weeks = useMemo(() => {
    const near = new Set<number>();
    for (let i = -RENDERED; i <= RENDERED; i++) near.add(inView + i);
    for (let i = -1; i <= 1; i++) near.add(dayWeek + i); // the destination of a jump is there on the same frame
    return [...near].sort((a, b) => a - b);
  }, [inView, dayWeek]);

  const label = dayTitle(day, today);
  const row = (week: number) => (
    <div role="row" className="grid h-12 grid-cols-7">
      {weekCells(week).map((cell) => (
        <DayCell key={cell.date} cell={cell} dots={dots[cell.date]} today={today} selected={day} onPick={pick} />
      ))}
    </div>
  );

  return (
    <>
      <LargeTitle
        trailing={trailing}
        title={
          <button
            ref={title}
            type="button"
            aria-haspopup="dialog"
            aria-expanded={panelOpen}
            aria-label={`${label}, choose a date`}
            onClick={() => setPanelOpen((v) => !v)}
            className="inline-flex items-center gap-2.5 active:opacity-70"
          >
            {label}
            <svg width="14" height="9" viewBox="0 0 14 9" aria-hidden className={cn("mt-1", panelOpen && "rotate-180")}>
              <path d="M7 8.2 1 1.4h12z" fill="currentColor" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
            </svg>
          </button>
        }
      />

      <section aria-label="Week" className="mt-3 px-4">
        <div className="grid grid-cols-7 pb-1 text-center text-[13px] font-semibold text-ink-3">
          {WEEKDAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div ref={strip} role="grid" className="no-scrollbar h-[52px] snap-x snap-mandatory overflow-x-auto overflow-y-hidden overscroll-x-contain">
          {width === 0 ? (
            row(dayWeek)
          ) : (
            <div className="relative h-full" style={{ width: WEEKS * width }}>
              {weeks.map((week) => (
                <div key={week} className="absolute top-0 snap-start [scroll-snap-stop:always]" style={{ left: week * width, width }}>
                  {row(week)}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <MonthPanel
        open={panelOpen}
        onClose={closePanel}
        anchor={title}
        selected={day}
        today={today}
        dots={dots}
        ensure={ensure}
        onPick={(date) => {
          setPanelOpen(false);
          if (date !== day) pick(date);
        }}
      />
    </>
  );
}
