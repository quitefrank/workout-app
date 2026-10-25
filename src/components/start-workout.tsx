"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { TemplateSummary } from "@/lib/data/queries";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";
import { Button, type ButtonStyle } from "./button";
import { PlayIcon } from "./icons";
import { Row, Thumb } from "./page";
import { Sheet } from "./sheet";

/** "Start a workout": a sheet of the day templates, grouped by category. Filled when it is the view's main action,
 *  gray beside a button that starts the next workout outright. */
export function StartWorkout({
  templates,
  label = "Start a Workout",
  variant = "filled",
}: {
  templates: TemplateSummary[];
  label?: string;
  variant?: ButtonStyle;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const groups = groupByCategory(templates);
  return (
    <>
      <Button variant={variant} className="w-full" onClick={() => setOpen(true)}>
        {variant === "filled" && <PlayIcon size={18} />}
        {label}
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Choose a Template"
        trailing={
          <button type="button" className="text-[17px] text-blue" onClick={() => setOpen(false)}>
            Cancel
          </button>
        }
      >
        {groups.map(([category, items]) => (
          <section key={category} className="mb-4">
            <h3 className="px-4 pb-1.5 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">
              {CATEGORY_LABELS[category] ?? "Other"}
            </h3>
            <div className="grouped">
              {items.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="block w-full text-left active:bg-fill"
                  onClick={() => router.push(`/templates/${t.id}?start=1`)}
                >
                  <Row
                    leading={<Thumb category={t.category} label={t.variant ?? t.name.slice(0, 1)} />}
                    title={t.name}
                    subtitle={`${t.exerciseCount} exercises${t.estimated_minutes ? ` · ${t.estimated_minutes} min` : ""}`}
                    chevron
                  />
                </button>
              ))}
            </div>
          </section>
        ))}
      </Sheet>
    </>
  );
}
