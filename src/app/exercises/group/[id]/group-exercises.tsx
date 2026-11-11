"use client";

import { useState, type ReactNode } from "react";
import { ExerciseRow } from "@/components/exercise-row";
import { ExerciseSheet } from "@/components/exercise-sheet";
import type { LibraryItem } from "@/lib/exercise-items";

export function GroupExercises({ items, art }: { items: LibraryItem[]; art: ReactNode }) {
  const [open, setOpen] = useState<LibraryItem | null>(null);
  const [last, setLast] = useState<LibraryItem | null>(null);
  return (
    <>
      <ul className="grouped mx-4">
        {items.map((i) => (
          <li key={i.id}>
            <ExerciseRow
              item={i}
              art={art}
              showGroup={false}
              onOpen={() => {
                setOpen(i);
                setLast(i);
              }}
            />
          </li>
        ))}
      </ul>
      <ExerciseSheet open={open !== null} exerciseId={last?.id ?? null} slug={last?.slug} title={last?.title ?? last?.name ?? ""} art={art} onClose={() => setOpen(null)} />
    </>
  );
}
