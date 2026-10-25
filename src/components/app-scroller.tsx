"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { followVisualViewport } from "@/lib/scroller";

/**
 * The one scrolling element (see src/lib/scroller.ts). Next.js scrolls the window to the top on navigation, and the
 * window never scrolls here, so a new screen resets this element instead.
 */
export function AppScroller({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    ref.current?.scrollTo(0, 0);
  }, [pathname]);
  useEffect(() => followVisualViewport(), []);
  return (
    <div ref={ref} data-app-scroller className="app-scroller">
      <div className="flex min-h-full flex-col">{children}</div>
    </div>
  );
}
