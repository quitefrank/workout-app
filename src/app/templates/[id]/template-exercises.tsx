"use client";

import { useState, type ReactNode } from "react";
import { ExerciseSheet } from "@/components/exercise-sheet";

export type TemplateExerciseItem = {
  key: string;
  exerciseId: string;
  slug: string | null;
  title: string;
  /** the muscle group's art, for an exercise without its own illustration */
  art: ReactNode;
  /** the row's content, rendered on the server */
  row: ReactNode;
};

/**
 * The workout's exercise rows. A tap opens the exercise's bottom sheet over the page, as in the Library, rather than
 * pushing its page (Frank's call, 2026-11-13): the workout page is pushed with the tab bar hidden and Start Workout
 * pinned, and an exercise is a look you dismiss back to it. One sheet from a pushed page, per the HIG's Sheets page
 * ("Display only one sheet at a time from the main interface") and as Hevy opens an exercise from a routine.
 */
export function TemplateExercises({ items }: { items: TemplateExerciseItem[] }) {
  const [open, setOpen] = useState(false);
  const [last, setLast] = useState<TemplateExerciseItem | null>(null);
  return (
    <>
      <div className="grouped mx-4">
        {items.map((i) => (
          <button
            key={i.key}
            type="button"
            onClick={() => {
              setLast(i);
              setOpen(true);
            }}
            className="block w-full text-left active:bg-fill"
          >
            {i.row}
          </button>
        ))}
      </div>
      <ExerciseSheet open={open} exerciseId={last?.exerciseId ?? null} slug={last?.slug} title={last?.title ?? ""} art={last?.art} onClose={() => setOpen(false)} />
    </>
  );
}
