/**
 * The time range of an exercise's chart (Frank's calls, 2026-11-13). Five ranges in a pop-up button beside the chart's
 * heading, 6 months by default. The range picked last is kept per device for every exercise, as Stocks keeps its range
 * across symbols. An exercise with fewer than 2 sessions in that range opens on the shortest range that has 2, without
 * changing what is saved; only a range picked by hand is saved. Pure apart from the storage.
 */

export const CHART_RANGES = [
  { value: "1M", label: "Last month", months: 1 },
  { value: "3M", label: "Last 3 months", months: 3 },
  { value: "6M", label: "Last 6 months", months: 6 },
  { value: "1Y", label: "Last year", months: 12 },
  { value: "All", label: "All time", months: null },
] as const;

export type ChartRange = (typeof CHART_RANGES)[number]["value"];
export const DEFAULT_CHART_RANGE: ChartRange = "6M";
const STORAGE_KEY = "exercise-chart-range";

const DAY = 86_400_000;

export function rangeLabel(range: ChartRange): string {
  return CHART_RANGES.find((r) => r.value === range)!.label;
}

export function isChartRange(v: unknown): v is ChartRange {
  return CHART_RANGES.some((r) => r.value === v);
}

/** UTC midnight of a YYYY-MM-DD date: a point's `t`, from its local date, so points and the axis share one clock */
export function dayMs(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** The first instant a range shows, counting back from `today` (YYYY-MM-DD) by calendar months; null for All time.
 *  A month with fewer days clamps, so a month back from Mar 31 is Feb 28 (or 29). */
export function rangeStart(range: ChartRange, today: string): number | null {
  const months = CHART_RANGES.find((r) => r.value === range)!.months;
  if (months === null) return null;
  const [y, m, d] = today.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 - months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  return Date.UTC(target.getUTCFullYear(), target.getUTCMonth(), Math.min(d, lastDay));
}

/** The points a range shows. `t` is each point's time in ms. */
export function inRange<P extends { t: number }>(points: readonly P[], range: ChartRange, today: string): P[] {
  const start = rangeStart(range, today);
  return start === null ? [...points] : points.filter((p) => p.t >= start);
}

/** The range the chart opens on: the saved one when it holds 2 points, else the shortest that does, else the saved
 *  one (an exercise with one session has no trend in any range). */
export function openingRange(points: readonly { t: number }[], saved: ChartRange, today: string): ChartRange {
  if (inRange(points, saved, today).length >= 2) return saved;
  return CHART_RANGES.find((r) => inRange(points, r.value, today).length >= 2)?.value ?? saved;
}

export type ChartAxis = { domain: [number, number]; ticks: number[]; format: (t: number) => string };

/**
 * A time axis for a range: the domain runs from the range's start (the first point for All time) to the end of
 * today, so a gap since the last session shows as a gap. `count` ticks sit evenly inside it. A span past about
 * 200 days labels months with the year ("Jan ’26"), a shorter one month and day ("May 19").
 */
export function chartAxis(points: readonly { t: number }[], range: ChartRange, today: string, count = 4): ChartAxis {
  const end = dayMs(today) + DAY - 1;
  const first = points.length ? Math.min(...points.map((p) => p.t)) : end - 30 * DAY;
  const start = Math.min(rangeStart(range, today) ?? first, end - DAY);
  // each tick centred in its slice of the span, so neither end label is cut off by the card's edge
  const ticks = Array.from({ length: count }, (_, i) => Math.round(start + ((end - start) * (i + 0.5)) / count));
  const long = end - start > 200 * DAY;
  const fmt = new Intl.DateTimeFormat("en-US", long ? { month: "short", year: "2-digit", timeZone: "UTC" } : { month: "short", day: "numeric", timeZone: "UTC" });
  return {
    domain: [start, end],
    ticks,
    format: (t) => (long ? fmt.format(t).replace(/ (\d{2})$/, " ’$1") : fmt.format(t)),
  };
}

/** The saved range, or the default when none is saved or storage is blocked */
export function readChartRange(): ChartRange {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return isChartRange(v) ? v : DEFAULT_CHART_RANGE;
  } catch {
    return DEFAULT_CHART_RANGE;
  }
}

// in-memory copy, so a blocked storage still keeps the pick for this visit
let session: ChartRange | null = null;
const listeners = new Set<() => void>();

/** The saved range as a store snapshot (for useSyncExternalStore) */
export function chartRangeSnapshot(): ChartRange {
  return session ?? readChartRange();
}

export function subscribeChartRange(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function writeChartRange(range: ChartRange) {
  session = range;
  try {
    localStorage.setItem(STORAGE_KEY, range);
  } catch {
    // private mode: the in-memory copy carries it for this visit
  }
  listeners.forEach((l) => l());
}
