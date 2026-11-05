"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { startWorkout } from "@/app/actions";
import { PlayIcon } from "@/components/icons";
import { Button } from "@/components/button";

/** Start a workout from this template. A two-floor exercise's floor is set on the exercise, in the workout. */
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
    <Button variant="white" disabled={pending} onClick={go} className="flex-1">
      <PlayIcon size={18} />
      {pending ? "Starting…" : "Start Workout"}
    </Button>
  );
}
