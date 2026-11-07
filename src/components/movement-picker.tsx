"use client";

import { useEffect, useRef, useState } from "react";
import { axisChoices, exerciseTitle, optionFor, techniqueLabel, unavailableReason, type MovementAxis, type MovementOption } from "@/lib/workout/movements";
import { cn } from "@/lib/cn";
import { revealAboveDock } from "@/lib/scroller";
import { PopUpMenu } from "./pop-up-menu";

const AXES: { axis: MovementAxis; label: string }[] = [
  { axis: "equipment", label: "Equipment" },
  { axis: "position", label: "Position" },
  { axis: "variation", label: "Variation" },
];

/**
 * The versions of one exercise family: Equipment, Position and Variation as line items, then every version by name.
 * Equipment is the parent; a position or variation the current equipment cannot do stays in its menu, dimmed, with
 * what it needs. Each version is a library row with its own image and history, so a choice switches to that row.
 * Rule: a segmented control switches the view, a pop-up button sets a value.
 */
export function MovementPicker({ options, currentId, disabled, onSelect }: { options: MovementOption[]; currentId: string; disabled?: boolean; onSelect: (id: string) => void }) {
  const [showAll, setShowAll] = useState(false);
  const versions = useRef<HTMLDivElement>(null);
  // the opened list scrolls clear of the floating bar
  useEffect(() => {
    if (!showAll) return;
    const frame = requestAnimationFrame(() => revealAboveDock(versions.current));
    return () => cancelAnimationFrame(frame);
  }, [showAll]);
  const current = options.find((o) => o.id === currentId);
  if (!current || options.length < 2) return null;
  const valueOf = (axis: MovementAxis) => (axis === "equipment" ? current.equipment : axis === "position" ? current.position : techniqueLabel(current.technique));
  return (
    <div>
      {AXES.map(({ axis, label }) => {
        const values = axisChoices(options, axis);
        const value = valueOf(axis);
        if (values.length === 0 || value === null) return null;
        return (
          <PopUpMenu
            key={axis}
            label={label}
            value={value}
            disabled={disabled}
            items={values.map((v) => {
              const note = v === value ? "" : unavailableReason(options, current, axis, v);
              return { value: v, note: note || undefined, disabled: !!note };
            })}
            onChange={(v) => {
              const next = optionFor(options, current, axis, v);
              if (next && next.id !== currentId) onSelect(next.id);
            }}
          />
        );
      })}
      {/* A button and a rendered list, not <details>: the glass stage paints the DOM, closed details included */}
      <div ref={versions} className="border-t border-[var(--sep)] py-2 text-[15px]">
        <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)} className="flex h-8 items-center font-medium text-blue">
          {showAll ? "Hide versions" : `All ${options.length} versions`}
        </button>
        {showAll && (
          <ul className="grid pb-1">
            {options.map((o) => (
              <li key={o.id}>
                <button
                  type="button"
                  disabled={disabled || o.id === currentId}
                  onClick={() => onSelect(o.id)}
                  className={cn("w-full py-1.5 text-left", o.id === currentId ? "font-semibold text-ink" : "text-ink-2 active:opacity-60")}
                >
                  {exerciseTitle(o)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
