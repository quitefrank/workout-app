/**
 * Text for the display list: graphemes by UTF-16 offset, line splitting by binary search, the baseline from the font's
 * metrics, text-transform, and the builder that turns one text node into text items.
 */
import { parseBoxShadows, type Shadow } from "./css";
import type { Clip, Item } from "./display-list";

export type Metrics = { ascent: number; descent: number } | null;
type TextItem = Extract<Item, { k: "text" }>;

/** The alphabetic baseline of a run of text. The engines centre the font's content area (ascent plus descent, each
 *  rounded to whole px as WebKit and Blink do for layout) in the box, so this is exact for both a text range's own
 *  rect (whose height is the content area) and a full line box. Without metrics (no canvas), the plan's estimate. */
export function baselineOf(top: number, height: number, m: Metrics, fontSize: number): number {
  if (!m) return top + height / 2 + fontSize * 0.3;
  const a = Math.round(m.ascent), d = Math.round(m.descent);
  return top + (height - (a + d)) / 2 + a;
}

type Unit = { i: number; len: number };
const graphemes = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** The visible graphemes of `s` between two UTF-16 offsets, as offset and length, so a range never splits an emoji. */
export function textUnits(s: string, from: number, to: number): Unit[] {
  const out: Unit[] = [];
  if (graphemes) {
    for (const g of graphemes.segment(s.slice(from, to))) if (/\S/.test(g.segment)) out.push({ i: from + g.index, len: g.segment.length });
    return out;
  }
  for (let i = from; i < to; ) {
    const len = s.codePointAt(i)! > 0xffff ? 2 : 1;
    if (/\S/.test(s[i])) out.push({ i, len });
    i += len;
  }
  return out;
}

/** Split n units into lines as [start, end) pairs. Tops never decrease along a text node, so each line ends at the
 *  first unit whose top passes the line's first top by half its height, found by binary search. Units without a box
 *  join the line after them; trailing ones are dropped. */
export function splitLines(n: number, boxAt: (k: number) => { top: number; height: number } | null): [number, number][] {
  const out: [number, number][] = [];
  let k = 0;
  while (k < n) {
    let f = k;
    let first = boxAt(f);
    while (!first && ++f < n) first = boxAt(f);
    if (!first) break;
    const limit = first.top + first.height / 2;
    let lo = f + 1, hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const b = boxAt(mid);
      if (b && b.top > limit) hi = mid;
      else lo = mid + 1;
    }
    out.push([k, lo]);
    k = lo;
  }
  return out;
}

export function transformText(t: string, transform: string): string {
  if (transform === "uppercase") return t.toUpperCase();
  if (transform === "lowercase") return t.toLowerCase();
  if (transform === "capitalize") return t.replace(/(^|\s)(\p{L})/gu, (_, s: string, ch: string) => s + ch.toUpperCase());
  return t;
}

let measureCtx: CanvasRenderingContext2D | null | undefined;
function fontMetrics(font: string, cache: Map<string, Metrics>): Metrics {
  if (cache.has(font)) return cache.get(font)!;
  if (measureCtx === undefined) {
    try { measureCtx = document.createElement("canvas").getContext("2d"); } catch { measureCtx = null; }
  }
  let m: Metrics = null;
  if (measureCtx) {
    measureCtx.font = font;
    const t = measureCtx.measureText("Hg");
    if (Number.isFinite(t.fontBoundingBoxAscent) && Number.isFinite(t.fontBoundingBoxDescent)) m = { ascent: t.fontBoundingBoxAscent, descent: t.fontBoundingBoxDescent };
  }
  cache.set(font, m);
  return m;
}

/** Where a text node sits: the scroll offset to add (0 for fixed), its clip, alpha, and the build's metrics cache. */
export type TextContext = { ox: number; oy: number; fixed: boolean; clip: Clip | null; alpha: number; metrics: Map<string, Metrics> };

/** The text items for one text node: one per line, or one per grapheme for short tabular text. */
export function textItems(node: Text, parent: HTMLElement, cs: CSSStyleDeclaration, { ox, oy, fixed, clip, alpha, metrics }: TextContext): TextItem[] {
  const items: TextItem[] = [];
  const raw = node.data;
  const i0 = raw.search(/\S/);
  if (i0 < 0) return items;
  const j0 = raw.trimEnd().length;
  const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
  const fontSize = parseFloat(cs.fontSize);
  const range = document.createRange();
  const measure = (from: number, to: number) => { range.setStart(node, from); range.setEnd(node, to); return range; };
  const rects = Array.from(measure(i0, j0).getClientRects()).filter((q) => q.width > 0);
  if (!rects.length) return items;
  const us = textUnits(raw, i0, j0);
  const boxes = new Map<number, DOMRect | null>();
  const boxAt = (k: number) => {
    if (!boxes.has(k)) {
      const q = measure(us[k].i, us[k].i + us[k].len).getBoundingClientRect();
      boxes.set(k, q.width === 0 && q.height === 0 ? null : q);
    }
    return boxes.get(k)!;
  };
  // canvas has no font-variant-numeric, so short tabular text is placed one grapheme at a time where the page put it
  const perChar = /tabular-nums/.test(cs.fontVariantNumeric) && us.length <= 32;
  const keepSpaces = /^(pre|pre-wrap|break-spaces|preserve|preserve-spaces)$/.test(cs.getPropertyValue("white-space-collapse") || cs.whiteSpace);
  const spans = rects.length === 1 ? [[0, us.length]] : splitLines(us.length, boxAt);
  const truncate = cs.textOverflow === "ellipsis" && parent.scrollWidth > parent.clientWidth;
  const pr = parent.getBoundingClientRect();
  const contentRight = pr.right - (parseFloat(cs.paddingRight) || 0) - (parseFloat(cs.borderRightWidth) || 0);
  const shadow: Shadow | null = parseBoxShadows(cs.textShadow)[0] ?? null;
  const m = fontMetrics(font, metrics);
  const push = (t: string, left: number, ln: DOMRect) => {
    items.push({ k: "text", x: left + ox, y: baselineOf(ln.top, ln.height, m, fontSize) + oy, text: transformText(t, cs.textTransform), font, color: cs.color, letterSpacing: cs.letterSpacing, maxWidth: truncate ? contentRight - left : null, shadow, fixed, clip, alpha });
  };
  for (const [a, b] of spans) {
    const start = us[a].i, end = us[b - 1].i + us[b - 1].len;
    const ln = spans.length === 1 ? rects[0] : measure(start, end).getBoundingClientRect();
    if (perChar) {
      for (let k = a; k < b; k++) { const q = boxAt(k); if (q) push(raw.slice(us[k].i, us[k].i + us[k].len), q.left, ln); }
      continue;
    }
    const slice = raw.slice(start, end);
    push(keepSpaces ? slice : slice.replace(/\s+/g, " "), ln.left, ln);
  }
  return items;
}
