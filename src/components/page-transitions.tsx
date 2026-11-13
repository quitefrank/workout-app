"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { beginPush, pushCommitted } from "@/glass/nav-state";
import { installNavIndex } from "@/lib/nav-index";
import { pushesFor } from "@/lib/page-push";

// number every history entry from the first navigation on, so the toolbar's Back knows if a page of ours is behind it
if (typeof window !== "undefined") installNavIndex(window.history);

/**
 * Starts the page push (src/lib/page-push.ts) before the new page renders, so the glass stage can copy the page on
 * screen, and says when the new route has rendered. A tap on a link to another page pushes forward; a link marked
 * `data-nav="back"` (the toolbar's Back) and history going back push back; anything inside `data-nav="none"` (the tab
 * bar: switching tabs is not a push on iOS) does not push. The link's own navigation is left alone.
 */
export function PageTransitions() {
  const pathname = usePathname();

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      const a = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a || a.closest("[data-nav='none']")) return;
      if (!pushesFor({ href: a.href, target: a.target, download: a.hasAttribute("download") }, e, location)) return;
      beginPush(a.closest("[data-nav='back']") ? "back" : "forward");
    };
    const onPop = () => beginPush("back");
    // capture, so the copy is taken before the link's own handler starts the navigation
    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPop);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // the new route has rendered (effects run after the commit)
  useEffect(() => {
    pushCommitted();
  }, [pathname]);

  return null;
}
