import { gradientLine, parseColor, resolveStops, type Gradient, type Shadow } from "./css";
import type { Clip, DisplayList, Item } from "./display-list";

const ELLIPSIS = "…";

/** Paint a display list into the content canvas at the current scroll. The context's transform maps CSS px to device
 *  pixels; W and H are the viewport in CSS px. */
export function paintList(c: CanvasRenderingContext2D, list: DisplayList, scrollX: number, scrollY: number, W: number, H: number) {
  // canvas shadow blur and offsets are in device pixels and ignore the transform, so they are scaled by hand
  const s = c.getTransform().a || 1;
  c.fillStyle = list.bg;
  c.fillRect(0, 0, W, H);
  for (const it of list.items) {
    const dx = it.fixed ? 0 : -scrollX, dy = it.fixed ? 0 : -scrollY;
    if (!onScreen(it, dx, dy, W, H)) continue;
    c.save();
    c.globalAlpha = it.alpha;
    if (it.clip) applyClip(c, it.clip, scrollX, scrollY);
    draw(c, it, dx, dy, s);
    c.restore();
  }
}

function onScreen(it: Item, dx: number, dy: number, W: number, H: number) {
  if (it.k === "text") return it.y + dy > -100 && it.y + dy < H + 100;
  const m = it.k === "box" ? Math.max(0, ...it.shadows.map((q) => q.blur + Math.max(0, q.spread) + Math.max(Math.abs(q.x), Math.abs(q.y)))) : 0;
  return it.y + dy - m < H && it.y + dy + it.h + m > 0 && it.x + dx - m < W && it.x + dx + it.w + m > 0;
}

function applyClip(c: CanvasRenderingContext2D, clip: Clip, sx: number, sy: number) {
  if (clip.parent) applyClip(c, clip.parent, sx, sy);
  const dx = clip.fixed ? 0 : -sx, dy = clip.fixed ? 0 : -sy;
  c.beginPath();
  c.roundRect(clip.x + dx, clip.y + dy, Math.max(0, clip.w), Math.max(0, clip.h), clip.radii);
  c.clip();
}

/** The canvas gradient for a CSS linear-gradient layer over a w x h box: the CSS gradient line, px stops resolved
 *  against its length, and the line lengthened (not the stops clamped) when positions fall outside 0 to 1. */
export function gradientGeometry(g: Gradient, w: number, h: number) {
  const L = gradientLine(g.angle, w, h);
  const dx = L.x1 - L.x0, dy = L.y1 - L.y0;
  const stops = resolveStops(g.stops, Math.hypot(dx, dy));
  if (!stops.length) return null;
  const lo = Math.min(0, stops[0].pos), hi = Math.max(1, stops[stops.length - 1].pos);
  return {
    x0: L.x0 + dx * lo, y0: L.y0 + dy * lo, x1: L.x0 + dx * hi, y1: L.y0 + dy * hi,
    stops: stops.map((q) => ({ t: Math.min(1, Math.max(0, (q.pos - lo) / (hi - lo))), color: q.color })),
  };
}

/** The longest prefix of `t` that fits `max` with an ellipsis, as text-overflow: ellipsis draws it. */
export function fitText(t: string, max: number, measure: (s: string) => number): string {
  if (measure(t) <= max) return t;
  let lo = 0, hi = t.length - 1; // the prefix length; 0 leaves the ellipsis alone
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(t.slice(0, mid).trimEnd() + ELLIPSIS) <= max) lo = mid;
    else hi = mid - 1;
  }
  return t.slice(0, lo).trimEnd() + ELLIPSIS;
}

/** A CSS outer box shadow: only outside the box (so a translucent box does not show it through), with spread. The
 *  caster is drawn far off to the left and only its shadow is offset back onto the canvas. */
function drawShadow(c: CanvasRenderingContext2D, q: Shadow, x: number, y: number, w: number, h: number, radii: number[], s: number) {
  const sw = w + 2 * q.spread, sh = h + 2 * q.spread;
  if (sw <= 0 || sh <= 0) return;
  const off = 100000;
  c.save();
  c.beginPath();
  c.rect(x - off * 2, y - off * 2, w + off * 4, h + off * 4);
  c.roundRect(x, y, w, h, radii);
  c.clip("evenodd");
  c.shadowColor = q.color;
  c.shadowBlur = q.blur * s;
  c.shadowOffsetX = (q.x + off) * s;
  c.shadowOffsetY = q.y * s;
  c.beginPath();
  c.roundRect(x - q.spread - off, y - q.spread, sw, sh, radii.map((r) => (r > 0 ? Math.max(0, r + q.spread) : 0)));
  c.fillStyle = "#000";
  c.fill();
  c.restore();
}

function draw(c: CanvasRenderingContext2D, it: Item, dx: number, dy: number, s: number) {
  switch (it.k) {
    case "box": {
      const x = it.x + dx, y = it.y + dy;
      const path = () => { c.beginPath(); c.roundRect(x, y, it.w, it.h, it.radii); };
      // CSS paints the first shadow and the first gradient layer on top
      for (const q of [...it.shadows].reverse()) drawShadow(c, q, x, y, it.w, it.h, it.radii, s);
      if (it.color) { path(); c.fillStyle = it.color; c.fill(); }
      for (const g of [...it.gradients].reverse()) {
        const geo = gradientGeometry(g, it.w, it.h);
        if (!geo) continue;
        const grad = c.createLinearGradient(x + geo.x0, y + geo.y0, x + geo.x1, y + geo.y1);
        for (const st of geo.stops) {
          try { grad.addColorStop(st.t, st.color); }
          catch { const col = parseColor(st.color); if (col) grad.addColorStop(st.t, `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3]})`); }
        }
        path(); c.fillStyle = grad; c.fill();
      }
      if (it.border) {
        const b = it.border.w;
        c.beginPath();
        c.roundRect(x + b / 2, y + b / 2, Math.max(0, it.w - b), Math.max(0, it.h - b), it.radii.map((r) => Math.max(0, r - b / 2)));
        c.lineWidth = b; c.strokeStyle = it.border.color; c.stroke();
      }
      return;
    }
    case "line":
      c.fillStyle = it.color; c.fillRect(it.x + dx, it.y + dy, it.w, it.h);
      return;
    case "text": {
      c.font = it.font; c.fillStyle = it.color; c.textBaseline = "alphabetic"; c.textAlign = "left";
      if ("letterSpacing" in c) c.letterSpacing = it.letterSpacing === "normal" ? "0px" : it.letterSpacing;
      if (it.shadow) { c.shadowColor = it.shadow.color; c.shadowBlur = it.shadow.blur * s; c.shadowOffsetX = it.shadow.x * s; c.shadowOffsetY = it.shadow.y * s; }
      const t = it.maxWidth != null ? fitText(it.text, it.maxWidth, (v) => c.measureText(v).width) : it.text;
      c.fillText(t, it.x + dx, it.y + dy);
      return;
    }
    case "image":
      c.drawImage(it.img, it.x + dx, it.y + dy, it.w, it.h);
      return;
  }
}
