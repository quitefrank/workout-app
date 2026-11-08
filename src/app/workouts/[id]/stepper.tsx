"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { step } from "@/lib/workout/active";
import { formatNumber } from "@/lib/workout/format";

/**
 * A value and the standard iOS stepper under it (UIStepper, 94 × 32pt, each half's touch area padded to 44pt tall, as
 * Apple's 44pt minimum asks). The number can be typed for a big jump, and shrinks to fit its card from 44px so 185 or
 * 182.5 never clip, as iOS adjusts text to fit its width (Frank's calls, 2026-11-08).
 */
export function Stepper({
  label,
  field,
  unit,
  value,
  onChange,
}: {
  label: string;
  field: "weight" | "reps";
  unit: "lbs" | "kg";
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value == null ? "" : field === "weight" ? formatNumber(value) : String(value));

  useLayoutEffect(() => fitText(input.current), [shown]);

  const commit = (s: string) => {
    const t = s.trim();
    if (t === "") return onChange(null);
    const n = Number(t);
    if (Number.isFinite(n) && n >= 0) onChange(field === "reps" ? Math.round(n) : n);
  };

  return (
    <div className="grid gap-0.5 rounded-[24px] bg-white/10 px-2.5 pb-3 pt-2.5 text-center backdrop-blur-md">
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-white/60">{label}</span>
      <input
        ref={input}
        data-live
        type="text"
        inputMode={field === "weight" ? "decimal" : "numeric"}
        aria-label={field === "weight" ? `Weight in ${unit}` : "Reps"}
        value={shown}
        placeholder="–"
        onChange={(e) => {
          setText(e.target.value);
          commit(e.target.value);
        }}
        onBlur={() => setText(null)}
        className="tabular h-12 w-full min-w-0 bg-transparent p-0 text-center text-[44px] font-extrabold tracking-[-0.02em] text-white outline-none placeholder:text-white/30 focus:text-blue"
      />
      <span className="mx-auto mt-0.5 inline-flex h-8 items-center rounded-full bg-white/15">
        <StepButton label={`Less ${field === "weight" ? unit : "reps"}`} onClick={() => onChange(step(value, field, -1, unit))}>
          −
        </StepButton>
        <i aria-hidden className="h-[18px] w-px bg-white/25" />
        <StepButton label={`More ${field === "weight" ? unit : "reps"}`} onClick={() => onChange(step(value, field, 1, unit))}>
          +
        </StepButton>
      </span>
    </div>
  );
}

function StepButton({ label, onClick, children }: { label: string; onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      // the half is 47 × 32; the ::after pads its touch area to 44pt tall
      className="relative grid h-8 w-[47px] place-items-center text-[22px] font-medium leading-none after:absolute after:inset-x-0 after:-inset-y-1.5 after:content-[''] active:opacity-50"
    >
      {children}
    </button>
  );
}

let ctx: CanvasRenderingContext2D | null = null;

/** Step the number down from 44px until it fits its field, measured on a canvas with the field's own font. */
function fitText(el: HTMLInputElement | null) {
  if (!el) return;
  const room = el.clientWidth - 4;
  if (room <= 0) return;
  const txt = el.value || el.placeholder || "–";
  ctx ??= document.createElement("canvas").getContext("2d");
  if (!ctx) return;
  const family = getComputedStyle(el).fontFamily;
  let size = 44;
  for (; size > 18; size--) {
    ctx.font = `800 ${size}px ${family}`;
    if (ctx.measureText(txt).width - size * 0.02 * txt.length <= room) break;
  }
  el.style.fontSize = `${size}px`;
}
