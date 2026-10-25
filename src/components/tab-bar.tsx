"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";
import { formatClock } from "@/lib/workout/format";
import { CalendarIcon, ChevronRight, LibraryIcon, ProgressIcon, TemplatesIcon } from "./icons";

/**
 * The floating tab bar: the kit's Tabs=4 bar, 62pt tall, 21pt in from
 * each side and up from the bottom, with the selected capsule. A
 * workout in progress rides above it as its own glass pill.
 */

const TABS = [
  { href: "/", label: "Calendar", Icon: CalendarIcon, match: (p: string) => p === "/" || p.startsWith("/workouts") },
  { href: "/templates", label: "Templates", Icon: TemplatesIcon, match: (p: string) => p.startsWith("/templates") || p.startsWith("/programs") },
  { href: "/exercises", label: "Library", Icon: LibraryIcon, match: (p: string) => p.startsWith("/exercises") },
  { href: "/analytics", label: "Progress", Icon: ProgressIcon, match: (p: string) => p.startsWith("/analytics") },
];

/** The active workout screen has its own bottom bar. */
const ACTIVE_WORKOUT = /^\/workouts\/[^/]+$/;

export type InProgress = { id: string; name: string; startedAt: string | null } | null;

export function TabBar({ inProgress }: { inProgress: InProgress }) {
  const pathname = usePathname() ?? "/";
  if (ACTIVE_WORKOUT.test(pathname)) return null;
  return (
    <nav
      aria-label="Main"
      data-glass-unit="dock"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex flex-col items-stretch gap-2.5 px-[21px]"
      // 21pt up from the screen edge (--dock-bottom); a home screen app places it from the top instead (globals.css)
        style={{ paddingBottom: "var(--dock-bottom)" }}
    >
      {inProgress && <ResumePill workout={inProgress} />}
      <div className="glass pointer-events-auto mx-auto flex h-[62px] w-full max-w-[420px] items-center px-1.5 py-1">
        {TABS.map(({ href, label, Icon, match }, i) => {
          const on = match(pathname);
          return (
            <Link
              key={href}
              href={href}
              aria-current={on ? "page" : undefined}
              data-glass-pill={on ? "" : undefined}
              className={cn(
                "relative flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-px rounded-full px-2 pb-[7px] pt-1.5 text-[10px] font-semibold leading-3 transition-colors",
                i > 0 && "-ml-2",
                on ? "text-[var(--glass-ink-on)]" : "text-[var(--glass-ink)]",
              )}
            >
              {on && <span aria-hidden className="absolute -inset-x-0.5 inset-y-0 rounded-full bg-[var(--glass-pill)]" />}
              <span className="relative flex h-7 items-center">
                <Icon size={24} strokeWidth={on ? 2.2 : 1.9} />
              </span>
              <span className="relative">{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

function ResumePill({ workout }: { workout: NonNullable<InProgress> }) {
  const elapsed = useElapsed(workout.startedAt);
  return (
    <Link
      href={`/workouts/${workout.id}`}
      className="glass pointer-events-auto mx-auto flex h-12 w-full max-w-[420px] items-center gap-3 pl-5 pr-3 text-[15px]"
    >
      <span className="relative flex size-2.5">
        <span className="absolute inset-0 animate-ping rounded-full bg-green opacity-60" />
        <span className="relative size-2.5 rounded-full bg-green" />
      </span>
      <span className="min-w-0 flex-1 truncate font-semibold">{workout.name}</span>
      {elapsed != null && <span className="tabular text-[var(--glass-ink)] opacity-70">{formatClock(elapsed)}</span>}
      <ChevronRight size={16} className="opacity-60" />
    </Link>
  );
}

/** Seconds since `startedAt`, ticking once a second; null before mount so server and client agree. */
export function useElapsed(startedAt: string | null): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (!startedAt) return;
    const tick = () => setNow(Date.now());
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [startedAt]);
  if (!startedAt || now == null) return null;
  return Math.max(0, Math.floor((now - Date.parse(startedAt)) / 1000));
}
