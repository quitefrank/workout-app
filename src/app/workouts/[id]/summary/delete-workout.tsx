"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteWorkout } from "@/app/actions";
import { Button } from "@/components/button";
import { GlassCircleButton } from "@/components/glass";
import { TrashIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";

/** A finished workout's Delete: the trash button in the top bar's trailing slot, where the active workout has Discard,
 *  opening a sheet that says what goes with it. */
export function DeleteWorkout({ workoutId, setCount }: { workoutId: string; setCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();

  const confirm = () =>
    start(async () => {
      try {
        await deleteWorkout(workoutId);
      } catch (e) {
        // redirect() throws to navigate; only real failures land here
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) toast.error(e.message);
        else throw e;
      }
    });

  return (
    <>
      <GlassCircleButton label="Delete workout" onClick={() => setConfirming(true)}>
        <TrashIcon size={19} />
      </GlassCircleButton>
      <Sheet open={confirming} onClose={() => setConfirming(false)} title="Delete Workout?">
        <p className="px-4 pb-4 text-[15px] text-ink-2">
          {setCount > 0 && `Its ${setCount === 1 ? "1 logged set goes" : `${setCount} logged sets go`} with it. `}
          It comes off your calendar, history and progress. This cannot be undone.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button variant="filled" tone="red" disabled={pending} onClick={confirm}>
            {pending ? "Deleting…" : "Delete Workout"}
          </Button>
          <Button variant="gray" onClick={() => setConfirming(false)}>
            Keep Workout
          </Button>
        </div>
      </Sheet>
    </>
  );
}
