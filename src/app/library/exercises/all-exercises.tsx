"use client";

import { useState, type ReactNode } from "react";
import { ExerciseRow } from "@/components/exercise-row";
import { ExerciseSheet } from "@/components/exercise-sheet";
import { FigureIcon } from "@/components/icons";
import type { LibraryItem } from "@/lib/exercise-items";

/** Every exercise as rows with their muscle group; a row opens the exercise's sheet. */
export function AllExercises({ items, arts }: { items: LibraryItem[]; arts: Record<string, ReactNode> }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<LibraryItem | null>(null);
  const artOf = (i: LibraryItem | null) =>
    (i?.groupId && arts[i.groupId]) || (
      <div className="grid size-full place-items-center text-ink-3">
        <FigureIcon size={40} />
      </div>
    );
  return (
    <>
      <ul className="grouped mx-4">
        {items.map((i) => (
          <li key={i.id}>
            <ExerciseRow
              item={i}
              art={i.groupId ? arts[i.groupId] : undefined}
              showGroup
              onOpen={() => {
                setLast(i);
                setOpen(true);
              }}
            />
          </li>
        ))}
      </ul>
      <ExerciseSheet open={open} exerciseId={last?.id ?? null} slug={last?.slug} title={last?.title ?? last?.name ?? ""} art={artOf(last)} onClose={() => setOpen(false)} />
    </>
  );
}
