"use client";

import { ChevronUpDown } from "@/components/icons";
import { Toggle } from "@/components/toggle";

/**
 * Rows for a grouped settings list, by what the setting is (Frank's rule, 2026-11-04, applied to Settings 2026-11-13):
 * an on/off value is a toggle, a choice among values is a pop-up button. A segmented control switches a view and is
 * never used to set a value.
 */

/** A label with the iOS 27 toggle at the trailing edge. */
export function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 px-4 py-2">
      <span className="text-[17px]">{label}</span>
      <Toggle label={label} checked={checked} onChange={onChange} />
    </div>
  );
}

/**
 * A label with its value and the pop-up button's chevron. The value and chevron are painted with the page; the real
 * select lies over the row, invisible, so a tap opens iOS's own menu. A live select in scrolling content drifts from
 * its painted row (see the glass rules in CLAUDE.md).
 */
export function SelectRow<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  const current = options.find(([v]) => v === value)?.[1] ?? String(value);
  return (
    <div className="relative flex min-h-11 items-center justify-between gap-3 px-4 py-2.5">
      <span className="text-[17px]">{label}</span>
      <span aria-hidden className="flex items-center gap-1 text-[17px] text-ink-2">
        {current}
        <ChevronUpDown size={16} strokeWidth={2.2} />
      </span>
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const hit = options.find(([v]) => String(v) === e.target.value);
          if (hit && hit[0] !== value) onChange(hit[0]);
        }}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
      >
        {options.map(([v, text]) => (
          <option key={String(v)} value={String(v)}>
            {text}
          </option>
        ))}
      </select>
    </div>
  );
}
