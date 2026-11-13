"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { knobBox, TOGGLE } from "@/lib/toggle";

/**
 * The iOS 27 toggle (values and sources in src/lib/toggle.ts). An on/off value is always this, never a segmented
 * control (HIG Toggles). While the finger is down the knob swells into a clear glass capsule over the track, as the
 * kit's Pressed state draws it; the glass is CSS (fill, a hairline ring and a soft shadow), since the control sits in
 * content and shader glass belongs to the bars. The motion is not measured.
 */
export function Toggle({
  checked,
  onChange,
  label,
  disabled = false,
  className,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  className?: string;
}) {
  const [pressed, setPressed] = useState(false);
  const box = knobBox(checked, pressed);
  const release = () => setPressed(false);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      onPointerDown={() => !disabled && setPressed(true)}
      onPointerUp={release}
      onPointerCancel={release}
      onPointerLeave={release}
      // a 44pt touch area round the 28pt track
      className={cn("relative shrink-0 rounded-full before:absolute before:-inset-y-2 before:inset-x-0", className)}
      style={{ width: TOGGLE.width, height: TOGGLE.height, opacity: disabled ? TOGGLE.disabledOpacity : 1 }}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-0 rounded-full transition-colors duration-200",
          checked ? "bg-green" : "bg-ink-3",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute rounded-full transition-[left,top,width,height,background-color,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]",
          pressed
            ? // the kit's pressed glass: white at 9%, a 0.5pt #ccc ring, a soft shadow under it
              "bg-white/[0.09] shadow-[inset_0_0_0_0.5px_rgba(204,204,204,0.9),inset_0_1px_1px_rgba(255,255,255,0.5),0_4px_10px_rgba(0,0,0,0.18)]"
            : "bg-white", // the kit's resting knob has no shadow
        )}
        style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
      />
    </button>
  );
}
