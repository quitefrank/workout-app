"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { ExerciseView } from "@/lib/exercise-view";
import { ExerciseDetailTabs } from "./exercise-detail";
import { Sheet } from "./sheet";

/** The exercise's bottom sheet. Loads when it opens; an alternate opens in place. */
export function ExerciseSheet({ open, exerciseId, title, art, onClose }: { open: boolean; exerciseId: string | null; title: string; art: ReactNode; onClose: () => void }) {
  const [shown, setShown] = useState<string | null>(null);
  const [view, setView] = useState<ExerciseView | null>(null);
  const [failed, setFailed] = useState(false);
  const [prevId, setPrevId] = useState(exerciseId);
  if (exerciseId !== prevId) {
    setPrevId(exerciseId);
    setShown(exerciseId);
  }
  const id = shown ?? exerciseId;

  useEffect(() => {
    if (!open || !id) return;
    let live = true;
    fetch(`/api/exercises/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v: ExerciseView) => {
        if (!live) return;
        setView(v);
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, id]);

  const current = view && view.exercise.id === id ? view : null;
  return (
    <Sheet open={open} onClose={onClose} title={current?.exercise.name ?? title}>
      {current ? (
        <ExerciseDetailTabs key={current.exercise.id} view={current} art={art} onAlternate={setShown} />
      ) : (
        <p className="py-10 text-center text-[15px] text-ink-2">{failed ? "Could not load this exercise." : "Loading…"}</p>
      )}
    </Sheet>
  );
}
