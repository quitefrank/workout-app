/**
 * An inline <svg> as an image the canvas can draw. The clone carries each element's computed fill, stroke, opacity and
 * font, since a detached image cannot read the page's CSS. Cached by the serialised clone; `onLoad` fires when a new
 * image finishes decoding so the stage repaints.
 */
const PAINT = ["fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "font-size", "font-family", "font-weight"] as const;
const cache = new Map<string, HTMLImageElement>();

export function svgImage(svg: SVGSVGElement, onLoad: () => void): HTMLImageElement | null {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const k of PAINT) dst[i].setAttribute(k, cs.getPropertyValue(k));
    dst[i].removeAttribute("class");
  });
  const r = svg.getBoundingClientRect();
  clone.setAttribute("width", String(r.width));
  clone.setAttribute("height", String(r.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const hit = cache.get(xml);
  if (hit) return hit.complete && hit.naturalWidth ? hit : null;
  const img = new Image();
  img.onload = onLoad;
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  cache.set(xml, img);
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return null;
}
