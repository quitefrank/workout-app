"use client";

import { useState, type ReactNode } from "react";
import { ExerciseRow } from "@/components/exercise-row";
import { ExerciseSheet } from "@/components/exercise-sheet";
import { SectionHeader } from "@/components/page";
import type { LibraryItem } from "@/lib/exercise-items";
import { cn } from "@/lib/cn";

type Section = { id: string; name: string; art: ReactNode; items: LibraryItem[] };

/**
 * A card holding more than one muscle group gets a section per group and pills that filter to one (as Equinox+'s
 * Movement Library and the Library's search pills); a card of one group is a plain list.
 */
export function GroupExercises({ sections }: { sections: Section[] }) {
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [last, setLast] = useState<LibraryItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const many = sections.length > 1;
  const shown = picked ? sections.filter((s) => s.id === picked) : sections;
  const artOf = new Map(sections.map((s) => [s.id, s.art]));
  return (
    <>
      {many && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ id: null, name: "All" }, ...sections].map((s) => {
            const on = picked === s.id;
            return (
              <button
                key={s.id ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(s.id)}
                className={cn(
                  "h-[34px] shrink-0 rounded-full border px-4 text-[16px] font-medium",
                  on ? "border-transparent bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--sep)] text-ink-2",
                )}
              >
                {s.name}
              </button>
            );
          })}
        </div>
      )}
      {shown.map((s) => (
        <section key={s.id}>
          {many && <SectionHeader title={`${s.name} (${s.items.length})`} className="pt-4" />}
          <ul className="grouped mx-4">
            {s.items.map((i) => (
              <li key={i.id}>
                <ExerciseRow
                  item={i}
                  art={s.art}
                  showGroup={false}
                  onOpen={() => {
                    setOpen(i);
                    setLast(i);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ExerciseSheet
        open={open !== null}
        exerciseId={last?.id ?? null}
        slug={last?.slug}
        title={last?.title ?? last?.name ?? ""}
        art={(last?.groupId && artOf.get(last.groupId)) || null}
        onClose={() => setOpen(null)}
      />
    </>
  );
}
