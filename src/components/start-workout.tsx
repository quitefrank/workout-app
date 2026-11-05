"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TemplateSummary } from "@/lib/data/queries";
import type { NextTemplate } from "@/lib/programs/up-next";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";
import { Row, Thumb } from "./page";
import { Sheet } from "./sheet";

const SECTION_TITLE = "px-4 pb-1.5 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2";

/**
 * The dock's + button, beside the tab bar, measured off MyFitnessPal's (2026-11-04, a 3x screenshot): a 62pt circle, as
 * tall as the bar and 8pt from it, a hairline ring in dark, and an 18pt plus with a 2pt stroke in the page's own colour. Solid,
 * not glass: it is the screen's one filled action. It lives in the root layout, so a pick has to close the sheet itself.
 * The sheet offers the program's next workout first, then the day templates grouped by category.
 */
export function StartWorkout({ templates, next }: { templates: TemplateSummary[]; next: NextTemplate | null }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const start = (id: string) => {
    setOpen(false);
    router.push(`/templates/${id}?start=1`);
  };
  return (
    <>
      <button
        type="button"
        aria-label="Start a Workout"
        // live, so the painter leaves it out of the page the glass refracts
        data-live
        onClick={() => setOpen(true)}
        className="dock-start pointer-events-auto grid size-[62px] shrink-0 place-items-center rounded-full transition-opacity active:opacity-70"
      >
        <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M9 1v16M1 9h16" />
        </svg>
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose a Template">
        {next && (
          <section className="mb-4">
            <h3 className={SECTION_TITLE}>Up Next</h3>
            <div className="grouped">
              <TemplateRow
                name={next.name}
                category={next.category}
                label={next.variant ?? next.name.slice(0, 1)}
                subtitle={["Next in the rotation", next.needs_signoff && "Needs physio sign-off"].filter(Boolean).join(" · ")}
                onPick={() => start(next.id)}
              />
            </div>
          </section>
        )}
        {groupByCategory(templates).map(([category, items]) => (
          <section key={category} className="mb-4">
            <h3 className={SECTION_TITLE}>{CATEGORY_LABELS[category] ?? "Other"}</h3>
            <div className="grouped">
              {items.map((t) => (
                <TemplateRow
                  key={t.id}
                  name={t.name}
                  category={t.category}
                  label={t.variant ?? t.name.slice(0, 1)}
                  subtitle={`${t.exerciseCount} exercises${t.estimated_minutes ? ` · ${t.estimated_minutes} min` : ""}`}
                  onPick={() => start(t.id)}
                />
              ))}
            </div>
          </section>
        ))}
      </Sheet>
    </>
  );
}

function TemplateRow({
  name,
  category,
  label,
  subtitle,
  onPick,
}: {
  name: string;
  category: string | null;
  label: string;
  subtitle: string;
  onPick: () => void;
}) {
  return (
    <button type="button" className="block w-full text-left active:bg-fill" onClick={onPick}>
      <Row leading={<Thumb category={category} label={label} />} title={name} subtitle={subtitle} chevron />
    </button>
  );
}
