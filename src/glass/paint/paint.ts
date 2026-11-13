import { gradientLine, parseColor, resolveStops, type Gradient, type Shadow } from "./css";
import type { Clip, DisplayList, Item } from "./display-list";
import { SOFT_EDGE } from "@/components/soft-edge";

const ELLIPSIS = "\u2026";
const SENTINEL = "#010203";
const graphemes = typeof Intl !== "undefined" && "Segmenter" in Intl ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;

/** Set a colour, falling back to the parsed rgba() when the canvas rejects the string (an invalid colour leaves the
 *  property as it was, so the sentinel survives). */
function setColor(c: CanvasRenderingContext2D, prop: "fillStyle" | "strokeStyle" | "shadowColor", color: string) {
  c[prop] = SENTINEL;
  c[prop] = color;
  if (String(c[prop]) !== SENTINEL) return;
  const col = parseColor(color);
  if (col) c[prop] = `rgba(${col[0]}, ${col[1]}, ${col[2]}, ${col[3]})`;
}

type Shift = [number, number];

/** Paint a display list into the content canvas at the current scroll. The context's transform maps CSS px to device
 *  pixels; W and H are the viewport in CSS px; `origin` is where the canvas sits in the page's viewport coordinates
 *  (0,0 unless iOS has slid the viewport under the keyboard). */
export function paintList(c: CanvasRenderingContext2D, list: DisplayList, scrollX: number, scrollY: number, W: number, H: number, origin = { x: 0, y: 0 }) {
  // canvas shadow blur and offsets are in device pixels and ignore the transform, so they are scaled by hand
  const s = c.getTransform().a || 1;
  setColor(c, "fillStyle", list.bg);
  c.fillRect(0, 0, W, H);
  // how far each clip's contents moved since the build: the sum of the scroll deltas of the scrollers around them
  const shifts = new Map<Clip, Shift>();
  const shiftOf = (clip: Clip | null): Shift => {
    if (!clip) return [0, 0];
    let v = shifts.get(clip);
    if (!v) {
      const p = shiftOf(clip.parent);
      v = clip.scroller ? [p[0] + clip.sx0 - clip.scroller.scrollLeft, p[1] + clip.sy0 - clip.scroller.scrollTop] : p;
      shifts.set(clip, v);
    }
    return v;
  };
  for (const it of list.items) {
    const [ix, iy] = shiftOf(it.clip);
    const dx = (it.fixed ? 0 : -scrollX) + ix - origin.x, dy = (it.fixed ? 0 : -scrollY) + iy - origin.y;
    if (!onScreen(it, dx, dy, W, H)) continue;
    const fade = it.fade ? parseFloat(getComputedStyle(it.fade).opacity) || 0 : 1;
    if (fade <= 0.001) continue;
    c.save();
    c.globalAlpha = it.alpha * fade;
    if (it.clip) applyClip(c, it.clip, scrollX, scrollY, shiftOf, origin);
    draw(c, it, dx, dy, s);
    c.restore();
  }
}

function onScreen(it: Item, dx: number, dy: number, W: number, H: number) {
  if (it.k === "text") return it.y + dy > -100 && it.y + dy < H + 100;
  const m = it.k === "box" ? Math.max(0, ...it.shadows.map((q) => q.blur + Math.max(0, q.spread) + Math.max(Math.abs(q.x), Math.abs(q.y)))) : 0;
  return it.y + dy - m < H && it.y + dy + it.h + m > 0 && it.x + dx - m < W && it.x + dx + it.w + m > 0;
}

/** A clip moves with the scrollers around it, not with its own scroller. */
function applyClip(c: CanvasRenderingContext2D, clip: Clip, sx: number, sy: number, shiftOf: (clip: Clip | null) => Shift, origin: { x: number; y: number }) {
  if (clip.parent) applyClip(c, clip.parent, sx, sy, shiftOf, origin);
  const [px, py] = shiftOf(clip.parent);
  const dx = (clip.fixed ? 0 : -sx) + px - origin.x, dy = (clip.fixed ? 0 : -sy) + py - origin.y;
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

/** The longest prefix of `t` that fits `max` with an ellipsis, as text-overflow: ellipsis draws it, cut only between
 *  graphemes so an emoji is never split. */
export function fitText(t: string, max: number, measure: (s: string) => number): string {
  if (measure(t) <= max) return t;
  const g = graphemes ? Array.from(graphemes.segment(t), (x) => x.segment) : Array.from(t);
  const prefix = (n: number) => g.slice(0, n).join("").trimEnd() + ELLIPSIS;
  let lo = 0, hi = g.length - 1; // the prefix length in graphemes; 0 leaves the ellipsis alone
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (measure(prefix(mid)) <= max) lo = mid;
    else hi = mid - 1;
  }
  return prefix(lo);
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
  setColor(c, "shadowColor", q.color);
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
      if (it.color) { path(); setColor(c, "fillStyle", it.color); c.fill(); }
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
        c.lineWidth = b; setColor(c, "strokeStyle", it.border.color); c.stroke();
      }
      return;
    }
    case "line":
      setColor(c, "fillStyle", it.color); c.fillRect(it.x + dx, it.y + dy, it.w, it.h);
      return;
    case "text": {
      c.font = it.font; setColor(c, "fillStyle", it.color); c.textBaseline = "alphabetic"; c.textAlign = "left";
      if ("letterSpacing" in c) c.letterSpacing = it.letterSpacing === "normal" ? "0px" : it.letterSpacing;
      if (it.shadow) { setColor(c, "shadowColor", it.shadow.color); c.shadowBlur = it.shadow.blur * s; c.shadowOffsetX = it.shadow.x * s; c.shadowOffsetY = it.shadow.y * s; }
      const t = it.maxWidth != null ? fitText(it.text, it.maxWidth, (v) => c.measureText(v).width) : it.text;
      c.fillText(t, it.x + dx, it.y + dy);
      return;
    }
    case "image":
      if (!it.tf) { c.drawImage(it.img, it.x + dx, it.y + dy, it.w, it.h); return; }
      c.translate(it.tf.cx + dx, it.tf.cy + dy);
      c.transform(it.tf.m[0], it.tf.m[1], it.tf.m[2], it.tf.m[3], 0, 0);
      c.drawImage(it.img, -it.tf.w / 2, -it.tf.h / 2, it.tf.w, it.tf.h);
      return;
    case "soft":
      drawSoftEdge(c, it, it.x + dx, it.y + dy);
      return;
  }
}

/** The soft edge's blur bands as fractions of its full blur, weakest first, each running from its start (i / 4 of the
 *  way toward the edge) to the edge, so the strongest is nearest it; as the CSS layers in src/components/soft-edge.tsx */
// six bands for a smoother ramp than four (2026-11-12: four read as steps on the phone)
const SOFT_BANDS = [1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6, 1];

type Scratch = { canvas: HTMLCanvasElement | OffscreenCanvas; ctx: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D };
let scratch: Scratch[] | null = null;
let canFilter: boolean | null = null;

function newScratch(): Scratch {
  const canvas = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(1, 1) : document.createElement("canvas");
  const ctx = canvas.getContext("2d") as Scratch["ctx"] | null;
  if (!ctx) throw new Error("no 2d context");
  return { canvas, ctx };
}

/** A scratch canvas at least w x h, cleared, transform reset. Grown, never shrunk, so a steady screen allocates once.
 *  0 holds the copy, 1 a band, 2 and 3 take turns in `mipBlur`. */
function sized(i: number, w: number, h: number): Scratch {
  scratch ??= [newScratch(), newScratch(), newScratch(), newScratch()];
  const s = scratch[i];
  if (s.canvas.width < w || s.canvas.height < h) {
    s.canvas.width = Math.max(s.canvas.width, w);
    s.canvas.height = Math.max(s.canvas.height, h);
  }
  s.ctx.setTransform(1, 0, 0, 1, 0, 0);
  s.ctx.globalAlpha = 1;
  s.ctx.globalCompositeOperation = "source-over";
  // the whole canvas, so pixels from a larger earlier use never bleed into a blur
  s.ctx.clearRect(0, 0, s.canvas.width, s.canvas.height);
  return s;
}

/** Canvas `filter` is missing in older Safari, where assigning it only sets an expando, so the prototype is checked */
function filterSupported() {
  if (canFilter == null) {
    canFilter = typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;
    if (canFilter) {
      const { ctx } = sized(2, 1, 1);
      ctx.filter = "blur(1px)";
      canFilter = ctx.filter === "blur(1px)";
      ctx.filter = "none";
    }
  }
  return canFilter;
}

/**
 * A blur of about `sigma` px without canvas `filter`: halve `src` (w x h) until a step is near sigma, then double it back
 * to full size into `dst` at (dx, dy). Scratch canvases 2 and 3 take turns, so no canvas is drawn onto itself.
 */
function mipBlur(src: CanvasImageSource, w: number, h: number, sigma: number, dst: Scratch["ctx"], dx: number, dy: number) {
  const levels = Math.max(1, Math.round(Math.log2(Math.max(1, sigma))));
  const sizes: [number, number][] = [[w, h]];
  let cur: CanvasImageSource = src;
  let slot = 2;
  for (let l = 0; l < levels; l++) {
    const [pw, ph] = sizes[sizes.length - 1];
    const nw = Math.max(1, Math.ceil(pw / 2)), nh = Math.max(1, Math.ceil(ph / 2));
    const next = sized(slot, nw, nh);
    next.ctx.imageSmoothingEnabled = true;
    next.ctx.imageSmoothingQuality = "high";
    next.ctx.drawImage(cur, 0, 0, pw, ph, 0, 0, nw, nh);
    sizes.push([nw, nh]);
    cur = next.canvas;
    slot = slot === 2 ? 3 : 2;
  }
  // back up, one doubling at a time, the last straight into the destination
  for (let l = sizes.length - 1; l > 1; l--) {
    const [cw, ch] = sizes[l], [uw, uh] = sizes[l - 1];
    const next = sized(slot, uw, uh);
    next.ctx.imageSmoothingEnabled = true;
    next.ctx.imageSmoothingQuality = "high";
    next.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, uw, uh);
    cur = next.canvas;
    slot = slot === 2 ? 3 : 2;
  }
  const [lw, lh] = sizes[1];
  dst.imageSmoothingEnabled = true;
  dst.imageSmoothingQuality = "high";
  dst.drawImage(cur, 0, 0, lw, lh, dx, dy, w, h);
}

/**
 * Apple's soft scroll edge on the painted page: blur what is already painted in the box, in bands that grow toward the
 * edge, then the screen's colour fading in toward it. The page so far is copied out of the canvas (with a margin, so the
 * blur reads real pixels past the box), each band is blurred into a second scratch canvas and feathered in with a
 * gradient mask, and drawn back over the same pixels. Canvas filter lengths are in canvas pixels, so the blur is scaled by
 * the device ratio; where `filter` is missing, a downscale and upscale stands in for the blur.
 */
function drawSoftEdge(c: CanvasRenderingContext2D, it: Extract<Item, { k: "soft" }>, x: number, y: number) {
  const m = c.getTransform();
  const cw = c.canvas.width, ch = c.canvas.height;
  const ratio = Math.abs(m.d) || 1;
  // the box in device pixels, clamped to the canvas
  const x0 = Math.max(0, Math.floor(m.a * x + m.e)), y0 = Math.max(0, Math.floor(m.d * y + m.f));
  const x1 = Math.min(cw, Math.ceil(m.a * (x + it.w) + m.e)), y1 = Math.min(ch, Math.ceil(m.d * (y + it.h) + m.f));
  const w = x1 - x0, h = y1 - y0;
  if (w <= 0 || h <= 0) return;
  const top = it.edge === "top";

  try {
    const sigma = it.blur * ratio;
    const pad = Math.ceil(sigma * 3);
    const px0 = Math.max(0, x0 - pad), py0 = Math.max(0, y0 - pad);
    const px1 = Math.min(cw, x1 + pad), py1 = Math.min(ch, y1 + pad);
    const src = sized(0, px1 - px0, py1 - py0);
    src.ctx.drawImage(c.canvas, px0, py0, px1 - px0, py1 - py0, 0, 0, px1 - px0, py1 - py0);
    const filter = filterSupported();
    for (let i = 0; i < SOFT_BANDS.length; i++) {
      const s = sigma * SOFT_BANDS[i];
      const band = sized(1, w, h);
      const b = band.ctx;
      if (filter) {
        b.filter = `blur(${s}px)`;
        b.drawImage(src.canvas, px0 - x0, py0 - y0);
        b.filter = "none";
      } else {
        // iPhone Safari has no canvas filter: halve the copy step by step and double it back, each step a 2x2 bilinear
        // average, which approaches a Gaussian. One large downscale and upscale drew visible blocks (2026-11-12).
        mipBlur(src.canvas, px1 - px0, py1 - py0, s, b, px0 - x0, py0 - y0);
      }
      // solid from i / 4 of the way toward the edge, fading in over the eighth before, as the CSS masks
      const start = i / SOFT_BANDS.length;
      const g = top ? b.createLinearGradient(0, h, 0, 0) : b.createLinearGradient(0, 0, 0, h);
      // each band feathers in over a full band's width, so neighbouring blurs blend rather than step
      g.addColorStop(Math.max(0, start - 1 / SOFT_BANDS.length), "rgba(0,0,0,0)");
      g.addColorStop(start, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,1)");
      b.globalCompositeOperation = "destination-in";
      b.fillStyle = g;
      b.fillRect(0, 0, w, h);
      b.globalCompositeOperation = "source-over";
      // back over the same pixels, in device space; the clip already set stays in force
      c.save();
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.drawImage(band.canvas, 0, 0, w, h, x0, y0, w, h);
      c.restore();
    }
  } catch {
    // no scratch canvas: the tint alone still carries the edge
  }

  const g = top ? c.createLinearGradient(0, y + it.h, 0, y) : c.createLinearGradient(0, y, 0, y + it.h);
  g.addColorStop(0, `rgba(${it.tint}, 0)`);
  g.addColorStop(1, `rgba(${it.tint}, ${SOFT_EDGE.tint})`);
  c.fillStyle = g;
  c.fillRect(x, y, it.w, it.h);
  // the darkening on top, reaching further from the edge (as the CSS layer in soft-edge.tsx)
  const d = top ? c.createLinearGradient(0, y + it.h, 0, y) : c.createLinearGradient(0, y, 0, y + it.h);
  for (const [at, a] of it.darken) d.addColorStop(at, `rgba(${it.tint}, ${a})`);
  c.fillStyle = d;
  c.fillRect(x, y, it.w, it.h);
}
