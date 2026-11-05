"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { followVisualViewport } from "@/lib/scroller";

/**
 * The one scrolling element (see src/lib/scroller.ts). Next.js scrolls the window to the top on navigation, and the
 * window never scrolls here, so a new screen resets this element instead, and going back returns to where that screen
 * was left, as a browser does for the window (back from a muscle group lands on Home's Library, not its top).
 */
export function AppScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const place = useRef(pathname);
  const wentBack = useRef(false);
  const atLastClick = useRef(0);
  useEffect(() => {
    const onPop = () => {
      wentBack.current = true;
    };
    // the position is taken at the tap that navigates: by the time the path changes, Next.js has scrolled the new
    // content into view, so the scroller no longer says where the old screen was left
    const onClick = () => {
      atLastClick.current = ref.current?.scrollTop ?? 0;
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  useEffect(() => {
    if (place.current === pathname) return;
    leftAt.set(place.current, atLastClick.current);
    place.current = pathname;
    ref.current?.scrollTo(0, wentBack.current ? (leftAt.get(pathname) ?? 0) : 0);
    wentBack.current = false;
  }, [pathname]);
  useEffect(() => followVisualViewport(), []);
  return (
    <div ref={ref} data-app-scroller className="app-scroller">
      <div className="flex min-h-full flex-col">{children}</div>
    </div>
  );
}

/** Where each screen was last scrolled to */
const leftAt = new Map<string, number>();
