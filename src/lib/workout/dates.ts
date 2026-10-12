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
 * The month as whole weeks, Sunday first, padded with the neighbouring
 * months' days so every row has seven cells.
 */
export function monthGrid({ year, month }: YearMonth): CalendarCell[][] {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const lead = first.getUTCDay();
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
