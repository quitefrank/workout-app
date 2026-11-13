"use client";

import { useState, type ReactNode } from "react";
import { ExerciseRow } from "@/components/exercise-row";
import { ExerciseSheet } from "@/components/exercise-sheet";
import { SectionHeader } from "@/components/page";
import { cn } from "@/lib/cn";
import type { LibraryItem } from "@/lib/exercise-items";

export type GroupSection = { key: string; name: string; items: LibraryItem[] };

/**
 * A card's sections, each headed when there is more than one, with All and per-section pills that filter (as
 * Equinox+'s Movement Library and the Library's search pills). A card with one section is a plain list.
 */
export function GroupExercises({ sections, art }: { sections: GroupSection[]; art: Record<string, ReactNode> }) {
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [last, setLast] = useState<LibraryItem | null>(null);
  const [picked, setPicked] = useState<string | null>(null);
  const many = sections.length > 1;
  const shown = picked ? sections.filter((s) => s.key === picked) : sections;
  const artOf = (i: LibraryItem | null) => (i?.group && art[i.group]) || null;
  return (
    <>
      {many && (
        <div className="flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {[{ key: null, name: "All" }, ...sections].map((s) => {
            const on = picked === s.key;
            return (
              <button
                key={s.key ?? "all"}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(s.key)}
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
        <section key={s.key}>
          {many && <SectionHeader title={`${s.name} (${s.items.length})`} className="pt-4" />}
          <ul className="grouped mx-4">
            {s.items.map((i) => (
              <li key={i.id}>
                <ExerciseRow
                  item={i}
                  art={artOf(i)}
                  showGroup={s.key === "secondary"}
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
      <ExerciseSheet open={open !== null} exerciseId={last?.id ?? null} slug={last?.slug} title={last?.title ?? last?.name ?? ""} art={artOf(last)} onClose={() => setOpen(null)} />
    </>
  );
}
