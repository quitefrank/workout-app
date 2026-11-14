"use client";

import { type ReactNode, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";
import { initialTab, type LibraryLayout, type LibraryTab, readLibraryTab, TAB_LABELS, tabsFor, writeLibraryTab } from "@/lib/library-layout";

/**
 * The Library's capsule pills (2026-11-13, Apple Fitness+'s view switcher): a row under the search field that switches
 * which panel shows. The panels are rendered on the server and passed in; only the picked one is mounted. The pill
 * picked last is kept on this device. Same look as search's muscle group pills, which never show at the same time
 * (search hides everything under its field).
 */
export function LibraryPills({ layout, panels }: { layout: LibraryLayout; panels: Partial<Record<LibraryTab, ReactNode>> }) {
  const tabs = tabsFor(layout);
  // the server renders the first pill; the device reads the one it kept
  const stored = useSyncExternalStore(noop, readLibraryTab, () => null);
  const [picked, setPicked] = useState<LibraryTab | null>(null);
  const tab = initialTab(layout, picked ?? stored);
  const pick = (t: LibraryTab) => {
    setPicked(t);
    writeLibraryTab(t);
  };
  return (
    <>
      <div role="tablist" aria-label="Library" className="flex gap-2 overflow-x-auto px-4 pt-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {tabs.map((t) => {
          const on = t === tab;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => pick(t)}
              className={cn(
                "h-[34px] shrink-0 rounded-full border px-4 text-[16px] font-medium",
                on ? "border-transparent bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--sep)] text-ink-2",
              )}
            >
              {TAB_LABELS[t]}
            </button>
          );
        })}
      </div>
      <div role="tabpanel">{panels[tab]}</div>
    </>
  );
}

const noop = () => () => {};
