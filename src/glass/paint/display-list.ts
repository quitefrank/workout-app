import { parseBoxShadows, parseColor, parseLinearGradients, type Gradient, type Shadow } from "./css";
import { svgImage } from "./svg";

/** A clip rectangle with per-corner radii; `parent` chains the clips of outer overflow containers. */
export type Clip = { x: number; y: number; w: number; h: number; radii: number[]; fixed: boolean; parent: Clip | null };
type Base = { fixed: boolean; clip: Clip | null; alpha: number };
export type Item =
  | (Base & { k: "box"; x: number; y: number; w: number; h: number; radii: number[]; color: string | null; gradients: Gradient[]; shadows: Shadow[]; border: { w: number; color: string } | null })
  | (Base & { k: "line"; x: number; y: number; w: number; h: number; color: string })
  | (Base & { k: "text"; x: number; y: number; text: string; font: string; color: string; letterSpacing: string; maxWidth: number | null; shadow: Shadow | null })
  | (Base & { k: "image"; x: number; y: number; w: number; h: number; img: CanvasImageSource });

/** `sticky`: the list holds a sticky element, whose place depends on the scroll, so the stage rebuilds on scroll. */
export type DisplayList = { items: Item[]; bg: string; pending: boolean; sticky: boolean };
type Metrics = { ascent: number; descent: number } | null;

const SKIP = ".glass, .glass-sheet, [data-live], [data-sonner-toaster], [data-glass-canvas], script, style, template, noscript";
const SCRIM = "rgba(0, 0, 0, 0.2)";

/** Per-corner radii as CSS draws them: px or % of the box (an elliptical corner takes its smaller axis), then all
 *  scaled down together when two adjacent corners would overlap (CSS Backgrounds 3, "corner overlap"). */
export function cornerRadii(values: string[], w: number, h: number): number[] {
  const px = (s: string, ref: number) => (s.endsWith("%") ? (parseFloat(s) / 100) * ref : parseFloat(s)) || 0;
  const r = values.map((v) => {
    const [a, b = a] = v.trim().split(/\s+/);
    return Math.max(0, Math.min(px(a, w), px(b, h)));
  });
  const fit = (len: number, sum: number) => (sum > 0 ? len / sum : Infinity);
  const f = Math.min(1, fit(w, r[0] + r[1]), fit(w, r[3] + r[2]), fit(h, r[0] + r[3]), fit(h, r[1] + r[2]));
  return r.map((v) => v * f);
}

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

const waiting = new WeakSet<HTMLImageElement>();
const visibleColor = (c: string) => (parseColor(c)?.[3] ?? 1) > 0; // an unparseable colour is drawn, not dropped

export function buildDisplayList(root: HTMLElement, onAsset: () => void): DisplayList {
  const items: Item[] = [];
  const sy = window.scrollY, sx = window.scrollX;
  const metrics = new Map<string, Metrics>();
  let pending = false, sticky = false;
  const bg = getComputedStyle(document.body).backgroundColor;

  // a sticky element moves with the scroll; it only matters to the stage when its subtree painted something
  const walk = (el: Element, fixed: boolean, clip: Clip | null, alpha: number) => {
    const n = items.length;
    if (visit(el, fixed, clip, alpha) && items.length > n) sticky = true;
  };

  /** Push an element's items and walk its children; true when the element is sticky. */
  const visit = (el: Element, fixed: boolean, clip: Clip | null, alpha: number): boolean => {
    if (el.matches(SKIP)) return false;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return false;
    const scrim = (el as HTMLElement).dataset?.scrim;
    if (scrim !== undefined) {
      if (scrim === "on") items.push({ k: "box", x: 0, y: 0, w: window.innerWidth, h: window.innerHeight, radii: [0, 0, 0, 0], color: SCRIM, gradients: [], shadows: [], border: null, fixed: true, clip: null, alpha: 1 });
      return false;
    }
    const op = parseFloat(cs.opacity);
    const a = alpha * (Number.isFinite(op) ? op : 1);
    if (a <= 0.001) return false;
    const isFixed = fixed || cs.position === "fixed";
    const r = el.getBoundingClientRect();
    const ox = isFixed ? 0 : sx, oy = isFixed ? 0 : sy;
    const x = r.left + ox, y = r.top + oy, w = r.width, h = r.height;
    const visible = cs.visibility !== "hidden";
    const base = { fixed: isFixed, clip, alpha: a };
    const radii = cornerRadii([cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius], w, h);
    const bw = [cs.borderTopWidth, cs.borderRightWidth, cs.borderBottomWidth, cs.borderLeftWidth].map((v) => parseFloat(v) || 0);

    if (visible && w > 0 && h > 0) {
      const color = visibleColor(cs.backgroundColor) ? cs.backgroundColor : null;
      const gradients = parseLinearGradients(cs.backgroundImage);
      const shadows = parseBoxShadows(cs.boxShadow);
      const outer = shadows.filter((s) => !s.inset && visibleColor(s.color));
      const sides = [
        [bw[0], cs.borderTopStyle, cs.borderTopColor], [bw[1], cs.borderRightStyle, cs.borderRightColor],
        [bw[2], cs.borderBottomStyle, cs.borderBottomColor], [bw[3], cs.borderLeftStyle, cs.borderLeftColor],
      ].map(([sw, st, sc]) => ((sw as number) > 0 && st !== "none" && st !== "hidden" && visibleColor(sc as string) ? { w: sw as number, color: sc as string } : null));
      const uniform = sides.every((s) => s && s.w === sides[0]!.w && s.color === sides[0]!.color);
      const border = uniform ? sides[0] : null;
      if (color || gradients.length || border || outer.length) items.push({ k: "box", x, y, w, h, radii, color, gradients, shadows: outer, border, ...base });
      if (!uniform) {
        const [t, rt, b, l] = sides;
        if (t) items.push({ k: "line", x, y, w, h: t.w, color: t.color, ...base });
        if (rt) items.push({ k: "line", x: x + w - rt.w, y, w: rt.w, h, color: rt.color, ...base });
        if (b) items.push({ k: "line", x, y: y + h - b.w, w, h: b.w, color: b.color, ...base });
        if (l) items.push({ k: "line", x, y, w: l.w, h, color: l.color, ...base });
      }
      // inset hairlines: the grouped list's separators (inset 0 0.5px 0 var(--sep))
      for (const s of shadows) {
        if (!s.inset || s.blur || s.spread || !visibleColor(s.color)) continue;
        if (s.y > 0) items.push({ k: "line", x, y, w, h: s.y, color: s.color, ...base });
        if (s.y < 0) items.push({ k: "line", x, y: y + h + s.y, w, h: -s.y, color: s.color, ...base });
      }
      if (el instanceof HTMLImageElement) {
        if (el.complete && el.naturalWidth) items.push({ k: "image", x, y, w, h, img: el, ...base });
        else if (!el.complete) {
          pending = true;
          if (!waiting.has(el)) { waiting.add(el); el.addEventListener("load", () => { waiting.delete(el); onAsset(); }, { once: true }); }
        }
      } else if (el instanceof SVGSVGElement) {
        const { img, loading } = svgImage(el, onAsset);
        if (img) items.push({ k: "image", x, y, w, h, img, ...base });
        if (loading) pending = true;
      }
    }
    if (el instanceof SVGElement || el instanceof HTMLImageElement) return cs.position === "sticky";

    let childClip = clip;
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      // overflow clips to the padding box, whose corners are the outer radii less the borders
      const inner = radii.map((v, i) => Math.max(0, v - Math.max(bw[(i + 3) % 4], bw[i])));
      childClip = { x: x + bw[3], y: y + bw[0], w: w - bw[1] - bw[3], h: h - bw[0] - bw[2], radii: inner, fixed: isFixed, parent: clip };
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (visible) text(node as Text, el as HTMLElement, cs, isFixed, childClip, a);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node as Element, isFixed, childClip, a);
      }
    }
    return cs.position === "sticky";
  };

  const text = (node: Text, parent: HTMLElement, cs: CSSStyleDeclaration, fixed: boolean, clip: Clip | null, alpha: number) => {
    const raw = node.data;
    const i0 = raw.search(/\S/);
    if (i0 < 0) return;
    const j0 = raw.trimEnd().length;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const fontSize = parseFloat(cs.fontSize);
    const ox = fixed ? 0 : sx, oy = fixed ? 0 : sy;
    const range = document.createRange();
    const measure = (from: number, to: number) => { range.setStart(node, from); range.setEnd(node, to); return range; };
    const rects = Array.from(measure(i0, j0).getClientRects()).filter((q) => q.width > 0);
    if (!rects.length) return;
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
    const shadow = parseBoxShadows(cs.textShadow)[0] ?? null;
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
  };

  walk(root, false, null, 1);
  return { items, bg, pending, sticky };
}
