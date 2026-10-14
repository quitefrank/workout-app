import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

/**
 * Standard iOS buttons for the content layer. Apple's HIG keeps Liquid Glass for the navigation and control layer
 * (bars, the dock, floating controls) and says not to use it in content, so buttons that scroll with the page use the
 * system's plain styles: one filled button for the view's most likely action, tinted or gray for the rest. Over media
 * (a gradient hero or card), white filled for the primary and a white veil for the rest, as Apple draws them over
 * artwork. Capsules, 50pt large and 44pt small, the iOS 26 shapes.
 */

export type ButtonStyle = "filled" | "tinted" | "gray" | "white" | "veil";
export type ButtonTone = "blue" | "red" | "green";

const base =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-full font-semibold tracking-[-0.01em] transition-opacity active:opacity-70 disabled:opacity-40";

const size = { large: "h-[50px] px-5 text-[17px]", small: "h-11 pl-4 pr-3 text-[15px]" };

const toneVar: Record<ButtonTone, string> = { blue: "var(--blue)", red: "var(--red)", green: "var(--green)" };

function styleOf(style: ButtonStyle, tone: ButtonTone) {
  const t = toneVar[tone];
  switch (style) {
    case "filled":
      return { className: "text-white", css: { background: t } };
    case "tinted":
      return { className: "", css: { background: `color-mix(in srgb, ${t} 15%, transparent)`, color: t } };
    case "gray":
      return { className: "bg-fill-2", css: { color: t } };
    case "white":
      return { className: "bg-white text-black", css: {} };
    case "veil":
      return { className: "bg-white/20 text-white", css: {} };
  }
}

/** The style for an element that is not itself the control (a label inside a card that is one big link) */
export function buttonLook(variant: ButtonStyle, tone: ButtonTone = "blue", small = false) {
  const s = styleOf(variant, tone);
  return { className: cn(base, size[small ? "small" : "large"], s.className), style: s.css };
}

type Own = { variant?: ButtonStyle; tone?: ButtonTone; small?: boolean };

export function Button({ variant = "gray", tone = "blue", small, className, style, ...rest }: ComponentProps<"button"> & Own) {
  const s = styleOf(variant, tone);
  return (
    <button
      type="button"
      className={cn(base, size[small ? "small" : "large"], s.className, className)}
      style={{ ...s.css, ...style }}
      {...rest}
    />
  );
}

export function ButtonLink({ variant = "gray", tone = "blue", small, className, style, ...rest }: ComponentProps<typeof Link> & Own) {
  const s = styleOf(variant, tone);
  return <Link className={cn(base, size[small ? "small" : "large"], s.className, className)} style={{ ...s.css, ...style }} {...rest} />;
}
