"use client";

import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { cn } from "@/lib/cn";

/**
 * Apple's soft scroll edge effect (the iOS 27 kit's "Scroll Edge Effect - Soft", Figma RrXV3TJi8viPxN3lELlvfK
 * 2681:67704, Edge=Bottom): a blur that grows from nothing to `SOFT_EDGE.blur` toward the screen's edge, under the
 * screen's colour fading in to `SOFT_EDGE.tint` at the edge (the kit's black layer at 90% under a 90% gradient mask; the
 * kit draws only dark, so light uses the screen's white, as the top bar's edge effect does). Frank's call, 2026-11-12.
 *
 * Two renderers, one element. On the CSS path, stacked `backdrop-filter` layers, each masked to its band, make the ramp.
 * On the WebGPU path the page painter finds `[data-soft-edge]` and blurs what it has painted so far in that box, so the
 * edge must come after what it blurs in the DOM and before what stays sharp over it (src/glass/paint/).
 */
export const SOFT_EDGE = {
  blur: 10,
  tint: 0.81,
  /** A darkening gradient over the kit's tint (Frank's call, 2026-11-12, after seeing it on the phone: the image sits at the
   *  edge's far end, where the kit's tint barely reaches; Claude's iOS side menu dissolves its last row almost fully).
   *  Stops from the far end (0) to the edge (1), as alpha of the screen's colour: black in dark, white in light. */
  darken: [[0, 0], [0.35, 0.3], [0.7, 0.55], [1, 0.7]] as ReadonlyArray<readonly [number, number]>,
} as const;

/** Stronger, for the active workout's edges and Start Workout's (Frank's calls, 2026-11-12, after the phone): twice
 *  the blur and a darkening that reaches nearly the screen's colour at the edge. */
export const SOFT_EDGE_STRONG = {
  blur: 20,
  darken: [[0, 0], [0.25, 0.35], [0.6, 0.7], [1, 0.9]] as ReadonlyArray<readonly [number, number]>,
} as const;

/** The values an edge uses: the kit's, or the strong ones */
export function softEdgeValues(strong: boolean) {
  return strong ? { blur: SOFT_EDGE_STRONG.blur, darken: SOFT_EDGE_STRONG.darken } : { blur: SOFT_EDGE.blur, darken: SOFT_EDGE.darken };
}

/** The blur bands, weakest first: each covers from its start to the edge, so the strongest is nearest the edge */
const BANDS = [0.125, 0.25, 0.5, 1] as const;

type Edge = "top" | "bottom";

function Layers({ edge, strong = false }: { edge: Edge; strong?: boolean }) {
  const dir = edge === "top" ? "to top" : "to bottom";
  const v = softEdgeValues(strong);
  return (
    <>
      {BANDS.map((f, i) => {
        // band i runs from i/4 of the way to the edge onward
        const start = (i / BANDS.length) * 100;
        // from nothing at its start to full one band later, so the blur starts from 0 at the far end (no hard line)
        const mask = `linear-gradient(${dir}, transparent ${start}%, black ${start + 100 / BANDS.length}%)`;
        return (
          <div
            key={f}
            // the blur is a custom property applied by `.soft-edge-blur` in globals.css, so html.gpu can turn it off
            className="soft-edge-blur absolute inset-0"
            style={{ "--soft-blur": `blur(${v.blur * f}px)`, maskImage: mask, WebkitMaskImage: mask } as CSSProperties}
          />
        );
      })}
      <div
        className="absolute inset-0"
        style={{ background: `linear-gradient(${dir}, rgb(var(--bg-rgb) / 0), rgb(var(--bg-rgb) / ${SOFT_EDGE.tint}))` }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(${dir}, ${v.darken.map(([at, a]) => `rgb(var(--bg-rgb) / ${a}) ${at * 100}%`).join(", ")})`,
        }}
      />
    </>
  );
}

/**
 * A soft edge the caller places (a pinned bar's backdrop). `live`: it sits over the WebGPU canvas (inside a
 * `[data-unpainted]` layer, as the Start Workout button's is), so it keeps its CSS blur under html.gpu; an edge in the
 * painted page drops it there, where the painter draws it and the CSS layers sit unseen under the canvas.
 */
export function SoftEdge({ edge, live, strong, className, style }: { edge: Edge; live?: boolean; strong?: boolean; className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden
      data-soft-edge={edge}
      data-soft-strong={strong ? "" : undefined}
      className={cn("soft-edge pointer-events-none absolute", live && "soft-edge-live", className)}
      style={style}
    >
      <Layers edge={edge} strong={strong} />
    </div>
  );
}

/** Where an element's layout box sits inside `frame`, from the offset chain, so a running transform (a slide) is ignored */
function offsetIn(el: HTMLElement, frame: HTMLElement) {
  let x = 0, y = 0;
  let n: HTMLElement | null = el;
  while (n && n !== frame) {
    x += n.offsetLeft;
    y += n.offsetTop;
    n = n.offsetParent as HTMLElement | null;
  }
  return { x, y };
}

/**
 * A soft edge that runs from the screen's edge to `margin` past a zone it covers (the active workout's header from the
 * top, its controls from the bottom), full width. The zone is `zone`, a selector looked up inside the edge's parent (it
 * may come later in the DOM, since the edge must paint before it), or else the parent itself. It measures itself against
 * the nearest `[data-focus-screen]`, so it follows the zone (a two-line title, the steppers or the rest arc).
 */
export function ZoneSoftEdge({ edge, margin, zone: selector, strong }: { edge: Edge; margin: number; zone?: string; strong?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    const zone = selector ? parent?.querySelector<HTMLElement>(selector) : parent;
    const frame = el?.closest<HTMLElement>("[data-focus-screen]");
    if (!el || !parent || !zone || !frame) return;
    const fit = () => {
      const z = offsetIn(zone, frame);
      // the edge is placed in its containing block's coordinates (its offset parent's padding box)
      const host = (el.offsetParent as HTMLElement | null) ?? parent;
      const o = host === frame ? { x: 0, y: 0 } : offsetIn(host, frame);
      const top = edge === "top" ? 0 : z.y - margin;
      const bottom = edge === "top" ? z.y + zone.offsetHeight + margin : frame.clientHeight;
      el.style.left = `${-o.x}px`;
      el.style.width = `${frame.clientWidth}px`;
      el.style.top = `${top - o.y}px`;
      el.style.height = `${Math.max(0, bottom - top)}px`;
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(zone);
    ro.observe(frame);
    // the zone moves without resizing when the space around it changes (the pill's distance off the bottom)
    ro.observe(parent);
    return () => ro.disconnect();
  }, [edge, margin, selector]);
  return (
    <div ref={ref} aria-hidden data-soft-edge={edge} data-soft-strong={strong ? "" : undefined} className="soft-edge pointer-events-none absolute">
      <Layers edge={edge} strong={strong} />
    </div>
  );
}
