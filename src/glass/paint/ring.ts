/**
 * The ring's arithmetic (lever `ring`, 2026-11-14, from the scroll review in tmp/agent-scratch/scroll-verdict.md). The
 * app scroller's content is kept in a GPU texture by content row, wrapping at its height, so a scroll only paints and
 * uploads the rows that came into view and the GPU places the rest by the scroll offset. Rows are device pixels counted
 * from the content's top (the scroller at scrollTop 0); intervals are half open, [r0, r1). Pure.
 */

export type Rows = { r0: number; r1: number };

/** The ring's height in rows: two screens, within the device's texture limit and never under one screen */
export function ringRows(screenRows: number, limit = 8192): number {
  return Math.max(screenRows, Math.min(limit, 2 * screenRows));
}

/** Where a content row lives in the ring */
export const ringRow = (r: number, hr: number) => ((r % hr) + hr) % hr;

/** A run of content rows as the copies that land in the ring, split where it wraps: `src` counts from the run's start */
export function splitWrap(r0: number, n: number, hr: number): { dst: number; src: number; n: number }[] {
  if (n <= 0) return [];
  const dst = ringRow(r0, hr), first = Math.min(n, hr - dst);
  return first === n ? [{ dst, src: 0, n }] : [{ dst, src: 0, n: first }, { dst: 0, src: first, n: n - first }];
}

/** The content rows on screen: the scroller's rows on screen moved by the scroll (sRow = scrollTop in device rows) */
export const visibleRows = (sRow: number, top: number, bottom: number): Rows => ({ r0: sRow + top, r1: sRow + bottom });

const len = (r: Rows) => r.r1 - r.r0;
const overlaps = (a: Rows, b: Rows) => a.r0 < b.r1 && b.r0 < a.r1;

/** The ring after `add` is painted next to or over `valid`: their union, giving up the rows furthest from `add` when it
 *  outgrows the ring */
export function extend(valid: Rows, add: Rows, hr: number): Rows {
  const next = { r0: Math.min(valid.r0, add.r0), r1: Math.max(valid.r1, add.r1) };
  if (len(next) <= hr) return next;
  return add.r1 > valid.r1 ? { r0: next.r1 - hr, r1: next.r1 } : { r0: next.r0, r1: next.r0 + hr };
}

/**
 * What to paint so the ring holds `want`, and what it holds after. With nothing valid, or `want` clear of what is, the
 * ring starts again at `want`. Otherwise the rows of `want` it lacks are painted (above and below).
 */
export function cover(valid: Rows | null, want: Rows, hr: number): { paint: Rows[]; valid: Rows } {
  if (!valid || !overlaps(valid, want) || len(want) > hr) return { paint: [want], valid: want };
  const paint: Rows[] = [];
  if (want.r0 < valid.r0) paint.push({ r0: want.r0, r1: valid.r0 });
  if (want.r1 > valid.r1) paint.push({ r0: valid.r1, r1: want.r1 });
  let next = valid;
  for (const p of paint) next = extend(next, p, hr);
  return { paint, valid: next };
}

/**
 * At rest, the next rows to paint ahead of a scroll: up to `budget` rows, below first, then above, toward a margin that
 * fills the ring around what is on screen, within the content (`content`). Null when the margin is full. The caller
 * adds them with `extend`, which never gives up rows on screen since the margin and the screen fit the ring.
 */
export function margin(valid: Rows, want: Rows, hr: number, content: Rows, budget: number): Rows | null {
  const spare = Math.max(0, hr - len(want));
  const below = Math.max(want.r1, Math.min(content.r1, want.r1 + Math.ceil(spare / 2)));
  const above = Math.min(want.r0, Math.max(content.r0, want.r0 - Math.floor(spare / 2)));
  if (valid.r1 < below) return { r0: valid.r1, r1: Math.min(below, valid.r1 + budget) };
  if (valid.r0 > above) return { r0: Math.max(above, valid.r0 - budget), r1: valid.r0 };
  return null;
}

/** The rows of `a` inside `b`, or null */
export function clipRows(a: Rows, b: Rows): Rows | null {
  const r0 = Math.max(a.r0, b.r0), r1 = Math.min(a.r1, b.r1);
  return r1 > r0 ? { r0, r1 } : null;
}
