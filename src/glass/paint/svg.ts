/**
 * An inline <svg> as an image the canvas can draw. The clone carries each element's computed paint and font, since a
 * detached image cannot read the page's CSS. Rendered at layout size times devicePixelRatio. Cached by the serialised
 * clone (LRU); `onLoad` fires when a new image finishes decoding, or fails to, so the stage rebuilds. While a changed
 * svg decodes, the last image decoded for that element is returned so icons do not blank. `loading` is true only while
 * a decode is in flight: a failed decode is not retried and is never pending.
 */
const PAINT = [
  "fill", "fill-opacity", "fill-rule", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stop-color", "stop-opacity", "opacity", "display", "visibility",
  "font-size", "font-family", "font-weight", "font-style", "letter-spacing", "text-anchor", "dominant-baseline",
] as const;

type Entry = { img: HTMLImageElement; failed: boolean };
const cache = new Map<string, Entry>();
const last = new WeakMap<SVGSVGElement, HTMLImageElement>();

/** `url("http://host/page#grad")` resolves against the page; the detached image only has the fragment. */
function localUrl(v: string): string {
  return v.replace(/url\(\s*["']?[^"')]*?(#[^"')]+)["']?\s*\)/g, "url($1)");
}

export function svgImage(svg: SVGSVGElement, onLoad: () => void): { img: HTMLImageElement | null; loading: boolean } {
  const r = svg.getBoundingClientRect();
  const w = svg.clientWidth || r.width;
  const h = svg.clientHeight || r.height;
  const dpr = (typeof window !== "undefined" && window.devicePixelRatio) || 1;
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const k of PAINT) {
      if (i === 0 && k === "opacity") continue; // the painter applies the element's own opacity
      const v = cs.getPropertyValue(k);
      if (v) dst[i].setAttribute(k, localUrl(v));
    }
    dst[i].removeAttribute("class");
  });
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  clone.setAttribute("width", String(w * dpr));
  clone.setAttribute("height", String(h * dpr));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);

  const hit = cache.get(xml);
  if (hit) {
    cache.delete(xml);
    cache.set(xml, hit); // refresh LRU order
    if (!hit.failed && hit.img.complete && hit.img.naturalWidth) {
      last.set(svg, hit.img);
      return { img: hit.img, loading: false };
    }
    return { img: last.get(svg) ?? null, loading: !hit.failed && !hit.img.complete };
  }
  const img = new Image();
  const entry: Entry = { img, failed: false };
  img.onload = onLoad;
  img.onerror = () => {
    entry.failed = true; // not retried: the entry stays in the cache
    console.warn("glass: an inline svg failed to decode as an image");
    onLoad();
  };
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  cache.set(xml, entry);
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return { img: last.get(svg) ?? null, loading: true };
}
