import Link from "next/link";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Glass controls at the kit's sizes: 44pt circles for the top toolbar,
 * 50pt large buttons, any radius for panels. The material itself is
 * the `.glass` class in globals.css (Preset 1).
 */

export function Glass({
  radius,
  className,
  style,
  children,
  ...rest
}: ComponentProps<"div"> & { radius?: number }) {
  return (
    <div
      className={cn("glass", className)}
      style={{ ...(radius != null ? ({ "--r": `${radius}px` } as CSSProperties) : null), ...style }}
      {...rest}
    >
      {children}
    </div>
  );
}

type CircleProps = { label: string; children: ReactNode; className?: string };

/** 44pt circle, the top toolbar's button. */
export function GlassCircleLink({ href, label, children, className }: CircleProps & { href: string }) {
  return (
    <Link href={href} aria-label={label} className={cn("glass grid size-11 shrink-0 place-items-center", className)}>
      {children}
    </Link>
  );
}

export function GlassCircleButton({
  label,
  children,
  className,
  ...rest
}: CircleProps & Omit<ComponentProps<"button">, "children">) {
  return (
    <button
      type="button"
      aria-label={label}
      className={cn("glass grid size-11 shrink-0 place-items-center disabled:opacity-40", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

const cta = "glass flex h-[50px] items-center justify-center gap-2 px-5 text-[17px] font-semibold tracking-[-0.01em]";

/** 50pt large glass button, for floating controls only (the active workout's bottom bar). Buttons in the page's
 * content use `Button` from ./button: Apple keeps Liquid Glass out of the content layer. */
export function GlassButton({
  tone,
  className,
  children,
  ...rest
}: ComponentProps<"button"> & { tone?: "blue" | "red" | "green" }) {
  return (
    <button
      type="button"
      className={cn(cta, tone && toneClass[tone], "disabled:opacity-40", className)}
      {...rest}
    >
      {children}
    </button>
  );
}

const toneClass = {
  blue: "text-blue",
  red: "text-red",
  green: "text-green",
};
