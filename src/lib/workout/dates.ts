/**
 * Calendar dates in the user's time zone. The server runs in UTC on
 * Vercel, so every "which day was this" question goes through here.
 */

export const DEFAULT_TIME_ZONE = "America/New_York";

/** YYYY-MM-DD for an instant, in the given zone. */
export function localDate(instant: Date | string, timeZone = DEFAULT_TIME_ZONE): string {
  const d = typeof instant === "string" ? new Date(instant) : instant;
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** The calendar day a workout belongs to: its scheduled date, else when it ended or began. */
export function workoutDay(
  w: { scheduled_for: string | null; completed_at: string | null; started_at: string | null; created_at?: string },
  timeZone = DEFAULT_TIME_ZONE,
): string | null {
  if (w.scheduled_for) return w.scheduled_for;
  const at = w.completed_at ?? w.started_at ?? w.created_at ?? null;
  return at ? localDate(at, timeZone) : null;
}

export type YearMonth = { year: number; month: number }; // month 1-12

/** "2026-10" to { year, month }; anything malformed returns null. */
export function parseYearMonth(s: string | null | undefined): YearMonth | null {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(s);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

export function formatYearMonth({ year, month }: YearMonth): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function shiftMonth({ year, month }: YearMonth, delta: number): YearMonth {
  const i = year * 12 + (month - 1) + delta;
  return { year: Math.floor(i / 12), month: (i % 12) + 1 };
}

function iso(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export type CalendarCell = { date: string; day: number; inMonth: boolean };

/**
 * The month as whole weeks, Monday first, padded with the neighbouring
 * months' days so every row has seven cells.
 */
export function monthGrid({ year, month }: YearMonth): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = (first.getUTCDay() + 6) % 7;
  const cells: CalendarCell[] = [];
  for (let i = lead; i > 0; i--) {
    const d = new Date(Date.UTC(year, month - 1, 1 - i));
    cells.push({ date: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: iso(year, month, day), day, inMonth: true });
  }
  let next = 1;
  while (cells.length % 7 !== 0) {
    const d = new Date(Date.UTC(year, month, next++));
    cells.push({ date: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: false });
  }
  const weeks: CalendarCell[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

/** A YYYY-MM-DD moved by whole days. */
export function shiftDate(date: string, days: number): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** The month a YYYY-MM-DD falls in. */
export function monthOf(date: string): YearMonth {
  return parseYearMonth(date.slice(0, 7))!;
}

/** Whole weeks, Monday first, since Monday Jan 5 1970: a stable number for the week a YYYY-MM-DD falls in. */
export function weekNumber(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) / 86400000 - 4) / 7);
}

/** The seven days of a week by its weekNumber, Monday first. */
export function weekCells(week: number): CalendarCell[] {
  const monday = week * 7 + 4;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date((monday + i) * 86400000);
    return { date: d.toISOString().slice(0, 10), day: d.getUTCDate(), inMonth: true };
  });
}

/** The same weekday in another week: what a swipe of the week strip selects. */
export function sameWeekdayIn(date: string, week: number): string {
  return shiftDate(date, (week - weekNumber(date)) * 7);
}

/** The calendar's title for a day, close to Apple's Fitness: "Today, Nov 4" or "Wed, Nov 11". */
export function dayTitle(date: string, today: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const at = new Date(Date.UTC(y, m - 1, d));
  const day = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(at);
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(at);
  return `${date === today ? "Today" : weekday}, ${day}`;
}

/** "Friday, Oct 24" for a YYYY-MM-DD. */
export function longDayLabel(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}

/** First and last date shown by monthGrid, for the query window. */
export function gridBounds(ym: YearMonth): { from: string; to: string } {
  const weeks = monthGrid(ym);
  return { from: weeks[0][0].date, to: weeks[weeks.length - 1][6].date };
}

export function monthTitle({ year, month }: YearMonth): string {
  return new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month - 1, 1)),
  );
}

/** "Mon, Oct 12" for a YYYY-MM-DD. */
export function dayLabel(date: string, opts: { year?: boolean } = {}): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: opts.year ? "numeric" : undefined,
    timeZone: "UTC",
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** Minutes between two instants, or null when either is missing. */
export function durationMinutes(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  return Math.round(ms / 60000);
}

/** The Monday starting each of the last `count` ISO weeks, oldest first, as the weekly views bucket them. */
export function weekStarts(today: string, count: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  const monday = new Date(t.getTime() - ((t.getUTCDay() + 6) % 7) * 86400000);
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    out.push(new Date(monday.getTime() - i * 7 * 86400000).toISOString().slice(0, 10));
  }
  return out;
}
