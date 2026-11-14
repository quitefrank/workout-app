"use client";

import { useRouter } from "next/navigation";
import { startTransition, useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { beginWorkout, discardWorkout } from "@/app/actions";
import { startAsk } from "@/lib/workout/start-sheet";
import { ActionSheet } from "./pop-up-menu";
import type { InProgress } from "./tab-bar";

type Startable = { id: string; name: string };

/**
 * Starting a workout from a Start button, shared by the dock's Choose a Workout sheet and Home's Recommended: with
 * nothing in progress it calls beginWorkout and pushes the workout; with one in progress it asks first, in an action
 * sheet grown from the Start tapped (Exit Early and Start, or Resume). `starting` is the template being started, so
 * every Start reads Starting… or is disabled until the workout screen arrives. When the caller unmounts after a start
 * (the workout screen replaced it), a toast offers Undo for 5 seconds.
 */
export function useStartWorkout(inProgress: InProgress): {
  starting: string | null;
  /** The workout in progress as the caller should show it: frozen while a start is underway */
  busy: InProgress;
  start: (w: Startable, rect: DOMRect) => void;
  resume: (id: string) => void;
  /** The in-progress question, rendered by the caller beside its content */
  ask: ReactNode;
} {
  const router = useRouter();
  /** Starting with a workout in progress: the pick and the Start it came from, which the action sheet grows out of */
  const [asking, setAsking] = useState<{ pick: Startable; rect: DOMRect } | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  /** The workout in progress as it was when a start began: the refresh after it shows the new one, which is not "in progress" here */
  const [frozen, setFrozen] = useState<InProgress | undefined>(undefined);
  const busy = frozen !== undefined ? frozen : inProgress;
  /** The workout just started, for the toast offered once the workout screen has replaced the caller */
  const started = useRef<{ id: string; name: string } | null>(null);

  useEffect(
    () => () => {
      const s = started.current;
      if (!s) return;
      toast(`Started ${s.name}`, {
        duration: 5000,
        action: { label: "Undo", onClick: () => undo(s.id) },
      });
    },
    [],
  );

  const go = async (w: Startable, replacing: string | null) => {
    setFrozen(busy);
    setStarting(w.id);
    try {
      const { id } = await beginWorkout(w.id, replacing);
      started.current = { id, name: w.name };
      router.push(`/workouts/${id}`);
    } catch (e) {
      started.current = null;
      setStarting(null);
      setFrozen(undefined);
      toast.error(e instanceof Error ? e.message : "Could not start the workout");
    }
  };

  const start = (w: Startable, rect: DOMRect) => {
    if (starting) return;
    if (!startAsk(busy, w.name)) return void go(w, null);
    setAsking({ pick: w, rect });
  };

  const resume = (id: string) => router.push(`/workouts/${id}`);
  const q = asking && startAsk(busy, asking.pick.name);

  const ask =
    asking && q && busy ? (
      <ActionSheet
        rect={asking.rect}
        title={q.title}
        message={q.message}
        actions={[
          { label: q.discard, destructive: true, onPick: () => go(asking.pick, busy.id) },
          { label: q.resume, onPick: () => resume(busy.id) },
        ]}
        onClose={() => setAsking(null)}
      />
    ) : null;

  return { starting, busy, start, resume, ask };
}

/** Undo from the toast: the existing discard, which deletes the workout and replaces the route with Home */
function undo(id: string) {
  startTransition(async () => {
    try {
      await discardWorkout(id);
    } catch (e) {
      // redirect() throws to navigate; only real failures land here
      if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
      toast.error(e instanceof Error ? e.message : "Could not undo");
    }
  });
}
