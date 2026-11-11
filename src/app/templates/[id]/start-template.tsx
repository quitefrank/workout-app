"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { startWorkout } from "@/app/actions";
import { Button } from "@/components/button";

/**
 * Start a workout from this template: the app's filled blue button, pinned at the bottom 20pt from each side (Frank's
 * call, 2026-11-10). A two-floor exercise's floor is set on the exercise, in the workout.
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
      // a column, like every dock: a home screen app bottom-aligns its children down a column (html.standalone)
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[640px] flex-col"
      style={{ paddingBottom: "var(--dock-bottom)" }}
    >
      <Button variant="filled" disabled={pending} onClick={go} className="pointer-events-auto mx-5">
        {pending ? "Starting…" : "Start Workout"}
      </Button>
    </div>
  );
}
