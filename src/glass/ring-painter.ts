import type { Clip, DisplayList, Item } from "./paint/display-list";
import { paintContent, paintList, within } from "./paint/paint";
import { clipRows, cover, extend, margin, visibleRows, type Rows } from "./paint/ring";
import { parseColor } from "./paint/css";

/**
 * The ring's painter (lever `ring`, 2026-11-14; plan in tmp/agent-scratch/scroll-verdict.md). Each frame it decides how
 * the page is drawn:
 * - `full`: today's whole-screen paint into the page canvas, for whatever the ring cannot follow (an animation, the page
 *   push, the keyboard, a soft edge, a sticky element, pinned items mixed into the content);
 * - `ring`: only the app scroller's content rows that came into view (or that an inner scroller moved) are painted, each
 *   run handed to `upload` straight after, and the GPU places the ring by the scroll; pinned items are an over layer
 *   painted only when the list changes;
 * - `none`: nothing to do.
 * At rest it paints a little more of the ring ahead of a scroll each frame, off screen, so a fling rarely paints.
 */

export type RingRect = { x0: number; y0: number; x1: number; y1: number };
export type RingFrame =
  | { kind: "none" }
  | { kind: "full"; reason: string }
  | { kind: "ring"; sRow: number; rect: RingRect; bg: [number, number, number]; over: "same" | "empty" | "painted"; visible: boolean; rows: number };

export type RingArgs = {
  c: CanvasRenderingContext2D;
  over: CanvasRenderingContext2D;
  origin: { x: number; y: number };
  hr: number;
  dpr: number;
  sigMoved: boolean;
  upload: (row: number, at: number, n: number) => void;
};

type Analysis = { main: Clip | null; reason: string | null; inner: Clip[]; overItems: Item[] };

/** Which items the ring holds, and whether it can hold this list at all */
export function analyse(list: DisplayList, mainEl: Element | null): Analysis {
  const none = (reason: string): Analysis => ({ main: null, reason, inner: [], overItems: [] });
  if (!mainEl) return none("no scroller");
  let main: Clip | null = null;
  for (const it of list.items) {
    for (let c = it.clip; c && !main; c = c.parent) if (c.scroller === mainEl) main = c;
    if (main) break;
  }
  if (!main) return none("no content");
  if (list.sticky) return none("sticky");
  if (main.radii.some((r) => r > 0)) return none("rounded scroller");
  const isContent = (it: Item) => !it.fixed && within(it.clip, main);
  let first = -1, last = -1;
  list.items.forEach((it, i) => { if (isContent(it)) { if (first < 0) first = i; last = i; } });
  const overItems: Item[] = [];
  const inner = new Set<Clip>();
  for (let i = 0; i < list.items.length; i++) {
    const it = list.items[i];
    if (it.k === "soft") return none("soft edge");
    if (isContent(it)) {
      for (let c = it.clip; c && c !== main; c = c.parent) if (c.scroller) inner.add(c);
      continue;
    }
    // pinned items drawn between content items, or under the content, would change places in the layers
    if (i > first && i < last && it.alpha > 0.001) return none("mixed layers");
    if (i < first && it.alpha > 0.001 && !it.fade && underScroller(it, main)) {
      // the page's own background, painted as a box, is what the ring's rows are filled with already
      if (it.k === "box" && it.color && sameColor(it.color, list.bg) && !it.gradients.length && !it.shadows.length && !it.border) continue;
      return none(`under layer ${it.k} ${Math.round(it.x)},${Math.round(it.y)}${"w" in it ? ` ${Math.round(it.w)}x${Math.round(it.h)}` : ""}`);
    }
    overItems.push(it);
  }
  return { main, reason: null, inner: [...inner], overItems };
}

function sameColor(a: string, b: string) {
  const x = parseColor(a), y = parseColor(b);
  return !!x && !!y && x.every((v, i) => Math.abs(v - y[i]) < 0.01);
}

function underScroller(it: Item, main: Clip) {
  if (it.k === "text") return it.y > main.y && it.y < main.y + main.h;
  return it.x < main.x + main.w && it.x + it.w > main.x && it.y < main.y + main.h && it.y + it.h > main.y;
}

/** The painter, holding what the ring has; `list()` gives the current display list (rebuilding it when needed) */
export function makeRingPainter(o: {
  list: () => DisplayList;
  mainEl: () => Element | null;
  W: number;
  H: number;
  /** a reason the ring cannot be used this frame, beyond the list's own (an animation, the push, the keyboard) */
  blocked: () => string | null;
  scrollTop: () => number;
}) {
  let valid: Rows | null = null;
  let lastList: DisplayList | null = null, analysis: Analysis | null = null;
  let lastKind: "full" | "ring" | null = null, lastSRow = NaN;
  const innerPos = new Map<Clip, string>();
  const pos = (c: Clip) => `${c.scroller!.scrollLeft},${c.scroller!.scrollTop}`;

  return (a: RingArgs): RingFrame => {
    const { c, dpr, hr } = a;
    const cw = c.canvas.width;
    // nothing moved: only a ring at rest has work (its margin)
    if (!a.sigMoved && lastKind !== "ring") return { kind: "none" };
    const list = o.list();
    if (list !== lastList) analysis = analyse(list, o.mainEl());
    const A = analysis!;
    const reason = o.blocked() ?? (a.origin.x || a.origin.y ? "keyboard" : null) ?? A.reason;
    if (reason || !A.main) {
      if (!a.sigMoved && lastKind === "full") return { kind: "none" };
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      paintList(c, list, 0, 0, o.W, o.H, a.origin);
      valid = null; lastKind = "full"; lastList = list;
      return { kind: "full", reason: reason ?? "no scroller" };
    }
    const main = A.main;
    const fresh = list !== lastList || lastKind !== "ring";
    let over: "same" | "empty" | "painted" = "same";
    if (fresh) {
      const shown = A.overItems.filter((it) => !it.fade || (parseFloat(getComputedStyle(it.fade).opacity) || 0) > 0.001);
      if (shown.length) {
        a.over.setTransform(dpr, 0, 0, dpr, 0, 0);
        const keep = new Set(A.overItems);
        paintList(a.over, list, 0, 0, o.W, o.H, a.origin, { include: (it) => keep.has(it) });
        over = "painted";
      } else over = "empty";
      valid = null;
      innerPos.clear();
      for (const cl of A.inner) innerPos.set(cl, pos(cl));
    }
    const rect: RingRect = { x0: Math.round(main.x * dpr), y0: Math.round(main.y * dpr), x1: Math.round((main.x + main.w) * dpr), y1: Math.round((main.y + main.h) * dpr) };
    const sRow = Math.round(o.scrollTop() * dpr);
    const want = visibleRows(sRow, rect.y0, rect.y1);
    const strips: Rows[] = [];
    const cov = cover(valid, want, hr);
    strips.push(...cov.paint);
    valid = cov.valid;
    // an inner scroller (the week strip) moved: its rows again, where the ring holds them
    for (const cl of A.inner) {
      const p = pos(cl);
      if (innerPos.get(cl) === p) continue;
      innerPos.set(cl, p);
      const top = innerTop(cl, main);
      const r = clipRows({ r0: Math.floor(top * dpr), r1: Math.ceil((top + cl.h) * dpr) }, valid);
      if (r) strips.push(r);
    }
    // at rest: a little more of the margin, off screen
    if (!strips.length && !a.sigMoved) {
      const el = o.mainEl();
      const content = { r0: 0, r1: Math.ceil((el?.scrollHeight ?? 0) * dpr) };
      const m = margin(valid, want, hr, content, Math.round(160 * dpr));
      if (!m) return { kind: "none" };
      strips.push(m);
      valid = extend(valid, m, hr);
    }
    const [r, g, b] = parseColor(list.bg) ?? [0, 0, 0];
    const bg: [number, number, number] = [r / 255, g / 255, b / 255];
    let rows = 0, visible = fresh || sRow !== lastSRow;
    const chunk = c.canvas.height;
    for (const s of strips) {
      if (s.r0 < want.r1 && s.r1 > want.r0) visible = true;
      for (let r0 = s.r0; r0 < s.r1; r0 += chunk) {
        const n = Math.min(chunk, s.r1 - r0);
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.globalAlpha = 1;
        c.fillStyle = list.bg;
        c.fillRect(0, 0, cw, n);
        c.setTransform(dpr, 0, 0, dpr, 0, -r0);
        paintContent(c, list, main, r0 / dpr, n / dpr, o.W);
        a.upload(r0, 0, n);
        rows += n;
      }
    }
    lastKind = "ring"; lastList = list; lastSRow = sRow;
    return { kind: "ring", sRow, rect, bg, over, visible, rows };
  };
}

/** An inner scroller's top in content y (the main scroller at scrollTop 0) */
function innerTop(cl: Clip, main: Clip): number {
  let y = cl.y;
  for (let c = cl.parent; c; c = c.parent) {
    if (!c.scroller) continue;
    y += c === main ? c.sy0 : c.sy0 - c.scroller.scrollTop;
    if (c === main) break;
  }
  return y;
}
