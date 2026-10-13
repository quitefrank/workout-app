import type { ReactNode } from "react";

/**
 * The pinned top toolbar: one glass unit (every control in it takes the
 * same side), 44pt tall under the status bar, with the scroll edge
 * effect behind it. `soft` (Apple's soft style) fades in once content
 * has scrolled under the bar; `dim` is for media pages, always on, and
 * keeps the bar on the dark side.
 *
 * `spacer` holds the bar's height in the flow, for screens whose content
 * starts below it. A media hero runs under the bar and leaves it out.
 */
export function TopBar({
  leading,
  center,
  trailing,
  edge = "soft",
  spacer = true,
}: {
  leading?: ReactNode;
  center?: ReactNode;
  trailing?: ReactNode;
  edge?: "soft" | "dim";
  spacer?: boolean;
}) {
  return (
    <>
      <div data-glass-unit="top" data-edge={edge} className="pointer-events-none fixed inset-x-0 top-0 z-30">
        <div aria-hidden className="top-edge">
          <span className="top-edge-blur" />
          <span className="top-edge-light" />
          <span className="top-edge-dark" />
        </div>
        <div
          data-glass-bar
          className="relative mx-auto flex h-11 max-w-[640px] items-center justify-between gap-2.5 px-4 [&>*>*]:pointer-events-auto"
          style={{ marginTop: "var(--bar-top)" }}
        >
          <div className="flex items-center gap-2.5">{leading}</div>
          {center && <div className="flex items-center gap-2.5">{center}</div>}
          <div className="flex items-center gap-2.5">{trailing}</div>
        </div>
      </div>
      {spacer && <div aria-hidden style={{ height: "calc(var(--bar-top) + 44px)" }} />}
    </>
  );
}
