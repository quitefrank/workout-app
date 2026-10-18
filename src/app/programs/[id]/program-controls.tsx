"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { followProgram, setProgramPhase } from "@/app/actions";
import { Button } from "@/components/button";

function useAction() {
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong.");
      }
    });
  return [pending, run] as const;
}

/** Follow this program, so the calendar shows its next workout, or stop. */
export function FollowButton({ programId, following }: { programId: string; following: boolean }) {
  const [pending, run] = useAction();
  return following ? (
    <Button small variant="gray" disabled={pending} onClick={() => run(() => followProgram(null))}>
      Stop Following
    </Button>
  ) : (
    <Button small variant="filled" disabled={pending} onClick={() => run(() => followProgram(programId))}>
      Follow
    </Button>
  );
}

/** Set the phase by hand, or give it back to the app. Following the program is implied. */
export function PhaseButton({
  programId,
  position,
  current,
  chosen,
}: {
  programId: string;
  position: number;
  /** This is the phase in force. */
  current: boolean;
  /** The phase in force was set by hand. */
  chosen: boolean;
}) {
  const [pending, run] = useAction();
  if (current && chosen) {
    return (
      <Button small variant="gray" disabled={pending} onClick={() => run(() => setProgramPhase(programId, null))}>
        Let the App Decide
      </Button>
    );
  }
  if (current) return null;
  return (
    <Button small variant="tinted" disabled={pending} onClick={() => run(() => setProgramPhase(programId, position))}>
      Set as My Phase
    </Button>
  );
}
