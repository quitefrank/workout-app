"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { startWorkout } from "@/app/actions";

/**
 * Start a workout from this template: the dock's blue Glass Prominent pill, in the place the active workout's pill
 * holds (67pt, 20pt from each side, 26pt corners). A two-floor exercise's floor is set on the exercise, in the workout.
 */
export function StartTemplate({ templateId }: { templateId: string }) {
  const [pending, start] = useTransition();

  const go = () =>
    start(async () => {
      try {
        await startWorkout(templateId);
      } catch (e) {
        // redirect() throws to navigate; only real failures land here
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) toast.error(e.message);
        else throw e;
      }
    });

  return (
    <div
      data-glass-unit="dock"
      // a column, like every dock: a home screen app bottom-aligns its children down a column (html.standalone)
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[640px] flex-col"
      style={{ paddingBottom: "var(--dock-bottom)" }}
    >
      <button
        type="button"
        data-glass-skip
        disabled={pending}
        onClick={go}
        className="glass glass-prominent pointer-events-auto mx-5 flex h-[67px] items-center justify-center text-[17px] font-semibold leading-[22px] tracking-[-0.43px] text-white transition-transform [--r:26px] active:scale-[1.02] disabled:opacity-60"
      >
        {pending ? "Starting…" : "Start Workout"}
      </button>
    </div>
  );
}
