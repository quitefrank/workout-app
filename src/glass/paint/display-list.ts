/**
 * Walks the live DOM into a display list: document coordinates (viewport coordinates for fixed elements), per-item
 * alpha, overflow clips with radii. Scrolling the window only moves the items, and so does scrolling an inner
 * scroller (a horizontal rail): its clip records the element and its scroll at build time and the painter subtracts
 * the change, so inner scroll never requires a rebuild. Layout changes, sticky elements (`sticky`) and assets still
 * decoding (`pending`) do.
 */
import { parseBoxShadows, parseColor, parseLinearGradients, parseLinearTransform, type Gradient, type Linear, type Shadow } from "./css";
import { svgImage } from "./svg";
import { inputTextItems, textItems, type Metrics } from "./text";

/** A clip rectangle with per-corner radii; `parent` chains the clips of outer overflow containers. `scroller` is the
 *  clipping element when it can scroll, with its scroll offsets at build time. */
export type Clip = { x: number; y: number; w: number; h: number; radii: number[]; fixed: boolean; parent: Clip | null; scroller: Element | null; sx0: number; sy0: number };
/** A transformed image: drawn at its untransformed size about the centre of its bounding rect. */
export type ImageTransform = { cx: number; cy: number; w: number; h: number; m: Linear };
type Base = { fixed: boolean; clip: Clip | null; alpha: number };
export type Item =
  | (Base & { k: "box"; x: number; y: number; w: number; h: number; radii: number[]; color: string | null; gradients: Gradient[]; shadows: Shadow[]; border: { w: number; color: string } | null })
  | (Base & { k: "line"; x: number; y: number; w: number; h: number; color: string })
  | (Base & { k: "text"; x: number; y: number; text: string; font: string; color: string; letterSpacing: string; maxWidth: number | null; shadow: Shadow | null })
  | (Base & { k: "image"; x: number; y: number; w: number; h: number; img: CanvasImageSource; tf: ImageTransform | null });

/** `sticky`: the list holds a sticky element, whose place depends on the scroll, so the stage rebuilds on scroll. */
export type DisplayList = { items: Item[]; bg: string; pending: boolean; sticky: boolean };

/** Nothing under these changes the painted page (glass, the sheet, live elements, toasts): the painter skips them and
 *  the stage ignores their mutations, animations and scrolling. A live input is painted at rest, so it scrolls with the
 *  page around it, and is live only while it has focus (caret, selection, typing). The debug readout is never painted. */
export const UNPAINTED = ".glass, .glass-sheet, [data-live]:not(input), input[data-live]:focus, [data-glass-debug], [data-sonner-toaster]";
const SKIP = `${UNPAINTED}, [data-glass-canvas], script, style, template, noscript`;
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
      // Tailwind's rotate-180 and scale-* are the `rotate` and `scale` properties, not `transform`
      const m = parseLinearTransform(cs.getPropertyValue("rotate") || "none", cs.getPropertyValue("scale") || "none", cs.transform || "none");
      const uw = el instanceof HTMLElement ? el.offsetWidth : el.clientWidth, uh = el instanceof HTMLElement ? el.offsetHeight : el.clientHeight;
      const tf = m && { cx: x + w / 2, cy: y + h / 2, w: uw || w, h: uh || h, m };
      if (el instanceof HTMLImageElement) {
        if (el.complete && el.naturalWidth) items.push({ k: "image", x, y, w, h, img: el, tf, ...base });
        else if (!el.complete) {
          pending = true;
          if (!waiting.has(el)) { waiting.add(el); el.addEventListener("load", () => { waiting.delete(el); onAsset(); }, { once: true }); }
        }
      } else if (el instanceof SVGSVGElement) {
        const { img, loading } = svgImage(el, onAsset);
        if (img) items.push({ k: "image", x, y, w, h, img, tf, ...base });
        if (loading) pending = true;
      }
    }
    if (el instanceof HTMLInputElement) {
      if (visible) items.push(...inputTextItems(el, cs, { ox, oy, fixed: isFixed, clip, alpha: a, metrics }));
      return cs.position === "sticky";
    }
    if (el instanceof SVGElement || el instanceof HTMLImageElement) return cs.position === "sticky";

    let childClip = clip;
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      // overflow clips to the padding box, whose corners are the outer radii less the borders
      const inner = radii.map((v, i) => Math.max(0, v - Math.max(bw[(i + 3) % 4], bw[i])));
      const scrolls = !/^(visible|clip)$/.test(cs.overflowX) || !/^(visible|clip)$/.test(cs.overflowY);
      childClip = { x: x + bw[3], y: y + bw[0], w: w - bw[1] - bw[3], h: h - bw[0] - bw[2], radii: inner, fixed: isFixed, parent: clip, scroller: scrolls ? el : null, sx0: el.scrollLeft, sy0: el.scrollTop };
    }
    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (visible) items.push(...textItems(node as Text, el as HTMLElement, cs, { ox: isFixed ? 0 : sx, oy: isFixed ? 0 : sy, fixed: isFixed, clip: childClip, alpha: a, metrics }));
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node as Element, isFixed, childClip, a);
      }
    }
    return cs.position === "sticky";
  };

  walk(root, false, null, 1);
  return { items, bg, pending, sticky };
}
