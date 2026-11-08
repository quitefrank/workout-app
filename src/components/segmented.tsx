"use client";

import { cn } from "@/lib/cn";

/** iOS's segmented control: a few mutually exclusive choices that switch a view or a setting at once. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div className="p-2">
      <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-full bg-fill p-0.5">
        {options.map(([v, text]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => value !== v && onChange(v)}
            className={cn(
              "h-8 flex-1 rounded-full text-[13px] font-medium",
              value === v && "bg-[var(--seg-on)] font-semibold shadow-[var(--seg-shadow)]",
            )}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** A grouped section with its title and footer, as iOS Settings draws them */
export function Group({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-4 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">{title}</h2>
      <div className="grouped">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-[13px] text-ink-2">{footer}</p>}
    </section>
  );
}
