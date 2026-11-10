"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { formatField, parseField, stepField, type Field } from "@/lib/workout/measure";

/**
 * The focus screen's steppers (weight, reps, time, incline, speed or distance, by the exercise's measure), in the two forms Frank picked per layout (2026-11-08, from the teardown prototype):
 *
 * - `Stepper` (centred layout): a card with the value in Apple's Large Title Emphasized (34pt bold, shrinking to fit so
 *   185 or 182.5 never clip) over the iOS 27 kit's stepper. The number can be typed for a big jump, as the HIG pairs a
 *   stepper with a text field.
 * - `StepperRow` (pill layout): the kit's list Row (Lists, Height=Regular 550:50627: 52pt, 16pt sides, Body title, the
 *   value in Body secondary) with the stepper trailing, two of them in an inset group (`StepperList`).
 *
 * Both use `KitStepper`, the kit's Stepper (Figma wH8YZbekJXNew109clIJz1, Steppers 5415:17699): 92 × 32pt, two 46pt
 * halves in Fills/Tertiary, a 1 × 24pt separator in Labels/Tertiary, − and + at Headline (17pt semibold). All colours are
 * the app's tokens, so they follow light and dark.
 */

type Props = {
  field: Field;
  unit: "lbs" | "kg";
  value: number | null;
  onChange: (v: number | null) => void;
};

function useValueField({ field, value, onChange }: Props) {
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? formatField(field, value);
  const commit = (s: string) => {
    const n = parseField(field, s);
    if (n !== undefined) onChange(n);
  };
  return {
    shown,
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => {
      setText(e.target.value);
      commit(e.target.value);
    },
    onBlur: () => setText(null),
  };
}

/**
 * A stepper card's box: Apple's grey card, or with Settings' Glass Steppers switch on, the Liquid Glass material at 26pt
 * corners (Frank's Figma frame, 38:2134). Only the background changes; what sits on it stays the same.
 */
export function stepperCard(glass: boolean): string {
  return `grid gap-1 px-2.5 pb-3 pt-2.5 text-center ${glass ? "glass [--r:26px]" : "rounded-[24px] bg-card"}`;
}

export function Stepper(props: Props & { label: string; glass?: boolean }) {
  const { label, field, unit } = props;
  const input = useRef<HTMLInputElement>(null);
  const f = useValueField(props);
  useLayoutEffect(() => fitText(input.current), [f.shown]);
  return (
    <div className={stepperCard(!!props.glass)}>
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">{label}</span>
      <input
        ref={input}
        data-live
        type="text"
        inputMode={inputMode(field)}
        aria-label={ariaLabel(field, unit)}
        value={f.shown}
        placeholder="–"
        onChange={f.onChange}
        onBlur={f.onBlur}
        className="tabular h-[41px] w-full min-w-0 bg-transparent p-0 text-center text-[34px] font-bold leading-[41px] tracking-[0.4px] text-ink outline-none placeholder:text-ink-3 focus:text-blue"
      />
      <KitStepper {...props} className="mx-auto" />
    </div>
  );
}

/** The inset group that holds the pill layout's rows */
export function StepperList({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-[26px] bg-card">{children}</div>;
}

export function StepperRow(props: Props & { first?: boolean }) {
  const { field, unit, first } = props;
  const f = useValueField(props);
  return (
    <div className="relative flex h-[52px] items-center gap-3 px-4 text-ink">
      {!first && <span aria-hidden className="absolute left-4 right-0 top-0 h-[0.5px] bg-sep" />}
      <span className="min-w-0 flex-1 truncate text-[17px] leading-[22px] tracking-[-0.43px]">
        {field === "weight" ? "Weight" : "Reps"}
      </span>
      <label className="flex items-baseline gap-1 text-[17px] tracking-[-0.43px] text-ink-2">
        <input
          data-live
          type="text"
          inputMode={inputMode(field)}
          aria-label={ariaLabel(field, unit)}
          value={f.shown}
          placeholder="–"
          onChange={f.onChange}
          onBlur={f.onBlur}
          className="tabular w-16 bg-transparent p-0 text-right text-[17px] text-inherit outline-none focus:text-blue"
        />
        {field === "weight" && <span>{unit}</span>}
      </label>
      <KitStepper {...props} />
    </div>
  );
}

function inputMode(field: Field): "decimal" | "numeric" | "text" {
  // time takes a colon ("1:30"), which the numeric keypad lacks
  return field === "seconds" ? "text" : field === "reps" ? "numeric" : "decimal";
}

const ARIA: Record<Field, string> = {
  weight: "Weight",
  reps: "Reps",
  seconds: "Time",
  incline: "Incline in percent",
  speed: "Speed in kilometres per hour",
  distance: "Distance in kilometres",
};

function ariaLabel(field: Field, unit: "lbs" | "kg"): string {
  return field === "weight" ? `Weight in ${unit}` : ARIA[field];
}

function KitStepper({ field, unit, value, onChange, className }: Props & { className?: string }) {
  const what = field === "weight" ? unit : ARIA[field].split(" ")[0].toLowerCase();
  return (
    <span className={`relative inline-flex h-8 w-[92px] shrink-0 ${className ?? ""}`}>
      <StepButton side="rounded-l-full" label={`Less ${what}`} onClick={() => onChange(stepField(value, field, -1, unit))}>
        −
      </StepButton>
      <StepButton side="rounded-r-full" label={`More ${what}`} onClick={() => onChange(stepField(value, field, 1, unit))}>
        +
      </StepButton>
      <i aria-hidden className="pointer-events-none absolute left-1/2 top-1 h-6 w-px -translate-x-1/2 rounded-[8px] bg-ink-3" />
    </span>
  );
}

function StepButton({ side, label, onClick, children }: { side: string; label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // the half is 46 × 32; the ::after pads its touch area to 44pt tall (so the capsule is the halves' corners, not a clip)
      className={`${side} relative grid h-8 w-[46px] place-items-center bg-fill text-[17px] font-semibold leading-none tracking-[-0.43px] text-ink after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] active:bg-fill-2`}
    >
      {children}
    </button>
  );
}

let ctx: CanvasRenderingContext2D | null = null;

/** Step the number down from 34px (Large Title) until it fits its field, measured on a canvas with the field's font. */
function fitText(el: HTMLInputElement | null) {
  if (!el) return;
  const room = el.clientWidth - 4;
  if (room <= 0) return;
  const txt = el.value || el.placeholder || "–";
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return;
  const family = getComputedStyle(el).fontFamily;
  let size = 34;
  for (; size > 18; size--) {
    ctx.font = `700 ${size}px ${family}`;
    if (ctx.measureText(txt).width + size * 0.012 * txt.length <= room) break;
  }
  el.style.fontSize = `${size}px`;
}
