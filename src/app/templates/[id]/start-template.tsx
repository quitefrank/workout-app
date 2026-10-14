"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { startWorkout } from "@/app/actions";
import { PlayIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import type { MachineLocation } from "@/lib/workout/machine-location";
import { Button } from "@/components/button";

/**
 * Start a workout from this template. When the template has machines,
 * ask which floor first, so upstairs and downstairs rows swap to the
 * right machine before the first set.
 */
export function StartTemplate({
  templateId,
  askLocation,
  defaultLocation,
  autoOpen,
}: {
  templateId: string;
  askLocation: boolean;
  defaultLocation: MachineLocation | null;
  autoOpen: boolean;
}) {
  const [open, setOpen] = useState(autoOpen && askLocation);
  const [pending, start] = useTransition();

  const go = (location: MachineLocation | null) =>
    start(async () => {
      try {
        await startWorkout(templateId, location);
      } catch (e) {
        // redirect() throws to navigate; only real failures land here
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) toast.error(e.message);
        else throw e;
      }
    });

  return (
    <>
      <Button variant="white" disabled={pending} onClick={() => (askLocation ? setOpen(true) : go(null))} className="flex-1">
        <PlayIcon size={18} />
        {pending ? "Starting…" : "Start Workout"}
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Where are you training?">
        <p className="px-4 pb-3 text-[15px] text-ink-2">
          Machines with an upstairs and a downstairs version switch to the floor you pick. You can change it during the workout.
        </p>
        <div className="grouped">
          {(
            [
              ["upstairs", "Upstairs"],
              ["downstairs", "Downstairs"],
              [null, "Skip"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              disabled={pending}
              onClick={() => go(value)}
              className="flex h-11 w-full items-center justify-between px-4 text-left text-[17px] active:bg-fill"
            >
              <span className={value ? "" : "text-ink-2"}>{label}</span>
              {value && value === defaultLocation && <span className="text-[15px] text-ink-2">Default</span>}
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
