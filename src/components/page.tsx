import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { TopBar } from "./top-bar";
import { WorkoutIcon } from "./workout-icon";

/**
 * Screen scaffolding: the kit's Large Title toolbar (controls row 44pt
 * under the status bar, pinned; title 34 Bold scrolls under it),
 * section headers at 22 Bold,
 * and grouped rows at 17/15.
 */

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <main
      className={cn("mx-auto w-full max-w-[640px] flex-1", className)}
      style={{ paddingBottom: "calc(var(--dock-h) + 72px)" }}
    >
      {children}
    </main>
  );
}

export function LargeTitle({
  title,
  subtitle,
  leading,
  trailing,
}: {
  title: string;
  subtitle?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <header className="px-4">
      <TopBar leading={leading} trailing={trailing} />
      <h1 className="mt-1 text-[34px] font-bold leading-[41px] tracking-[-0.01em] [text-wrap:balance]">{title}</h1>
      {subtitle && <div className="text-[15px] font-medium leading-5 text-ink-2">{subtitle}</div>}
    </header>
  );
}

export function SectionHeader({ title, trailing, className }: { title: string; trailing?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-baseline justify-between px-4 pb-2 pt-6", className)}>
      <h2 className="text-[22px] font-bold tracking-[-0.01em]">{title}</h2>
      {trailing && <div className="text-[15px] text-blue">{trailing}</div>}
    </div>
  );
}

export function Row({
  title,
  subtitle,
  value,
  leading,
  chevron,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  value?: ReactNode;
  leading?: ReactNode;
  chevron?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3 px-4 py-2.5", className)}>
      {leading}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] leading-[22px]">{title}</div>
        {subtitle && <div className="truncate text-[15px] leading-5 text-ink-2">{subtitle}</div>}
      </div>
      {value != null && <div className="tabular shrink-0 text-[15px] text-ink-2">{value}</div>}
      {chevron && (
        <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden className="shrink-0 text-ink-3">
          <path d="M1.5 1.5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mx-4 rounded-[26px] bg-card px-6 py-10 text-center">
      <p className="text-[17px] font-semibold">{title}</p>
      {children && <div className="mt-1 text-[15px] text-ink-2">{children}</div>}
    </div>
  );
}

/** Category colour, the hue the cards and thumbnails are painted in. */
export const CATEGORY_HUE: Record<string, number> = {
  push: 12,
  pull: 212,
  legs: 145,
  arms: 275,
  full_body: 40,
  abs: 330,
  cardio: 178,
  rehab: 95,
};

export function hueStyle(category: string | null | undefined): CSSProperties {
  return { ["--h" as string]: String(CATEGORY_HUE[category ?? ""] ?? 220) };
}

/** The lab's gradient tile: a saturated top fading to a deep base. */
export const tileGradient =
  "bg-[linear-gradient(160deg,hsl(var(--h)_62%_52%),hsl(calc(var(--h)+40)_68%_22%))]";

export function Thumb({ category, label }: { category: string | null | undefined; label: string }) {
  return (
    <div
      style={hueStyle(category)}
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[10px] text-white/95",
        tileGradient,
      )}
    >
      <WorkoutIcon category={category} size={20} />
      <span className="max-w-full truncate px-1 text-[11px] font-bold leading-none">{label}</span>
    </div>
  );
}

/** Filter chip: a capsule, filled when on. */
export function Chip({ href, on, children }: { href: string; on: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "true" : undefined}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] font-medium",
        on ? "bg-ink text-bg" : "bg-fill text-ink",
      )}
    >
      {children}
    </Link>
  );
}
