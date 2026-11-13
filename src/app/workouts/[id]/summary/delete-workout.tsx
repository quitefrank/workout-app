"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteWorkout } from "@/app/actions";
import { GlassCircleButton } from "@/components/glass";
import { TrashIcon } from "@/components/icons";
import { ActionSheet } from "@/components/pop-up-menu";
import { deleteAsk } from "@/lib/workout/confirm";

/** A finished workout's Delete: the trash button in the top bar's trailing slot, asking in an action sheet grown from
 *  it that says what goes with it (Frank's call, 2026-11-13: confirmations are action sheets, never a sheet). */
export function DeleteWorkout({ workoutId, setCount }: { workoutId: string; setCount: number }) {
  const [from, setFrom] = useState<DOMRect | null>(null);
  const [pending, start] = useTransition();
  const ask = deleteAsk(setCount);

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
      <GlassCircleButton label="Delete workout" disabled={pending} onClick={(e) => setFrom(e.currentTarget.getBoundingClientRect())}>
        <TrashIcon size={19} />
      </GlassCircleButton>
      {from && (
        <ActionSheet
          rect={from}
          title={ask.title}
          message={ask.message}
          actions={[{ label: ask.delete, destructive: true, onPick: confirm }]}
          onClose={() => setFrom(null)}
        />
      )}
    </>
  );
}
