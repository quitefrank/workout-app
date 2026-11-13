"use client";

import { useRef, type PointerEvent } from "react";

/**
 * iOS's slider (4pt track, blue fill, 28pt white thumb), built from divs rather than `<input type="range">`: the glass
 * painter draws divs with the page, while a native range is live and would drift from the painted page as it scrolls.
 * Drag anywhere on the row; a vertical drag still scrolls (touch-action pan-y). Arrow keys step it.
 */
export function TuneSlider({
  value,
  min,
  max,
  step,
  label,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  step: number;
  label: string;
  onChange: (v: number) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const f = (value - min) / (max - min);
  const at = (clientX: number) => {
    const r = track.current!.getBoundingClientRect();
    const t = Math.min(1, Math.max(0, (clientX - r.left) / r.width));
    const v = Math.round((min + t * (max - min)) / step) * step;
    if (v !== value) onChange(v);
  };
  const down = (e: PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    at(e.clientX);
  };
  const move = (e: PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) at(e.clientX);
  };
  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={value}
      onPointerDown={down}
      onPointerMove={move}
      onKeyDown={(e) => {
        const d = e.key === "ArrowRight" || e.key === "ArrowUp" ? step : e.key === "ArrowLeft" || e.key === "ArrowDown" ? -step : 0;
        if (d) {
          e.preventDefault();
          onChange(Math.min(max, Math.max(min, value + d)));
        }
      }}
      className="relative flex h-11 cursor-pointer touch-pan-y select-none items-center px-3.5"
    >
      <div ref={track} className="relative h-1 w-full rounded-full bg-fill-2">
        <div className="absolute inset-y-0 left-0 rounded-full bg-[var(--blue)]" style={{ width: `${f * 100}%` }} />
        <div
          className="absolute top-1/2 size-7 rounded-full bg-white shadow-[0_0.5px_4px_rgba(0,0,0,0.12),0_6px_13px_rgba(0,0,0,0.12)]"
          style={{ left: `calc(${f * 100}% - 14px)`, marginTop: -14 }}
        />
      </div>
    </div>
  );
}
