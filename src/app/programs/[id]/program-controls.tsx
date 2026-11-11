"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followProgram, setProgramPhase } from "@/app/actions";
import { Button } from "@/components/button";
import { Sheet } from "@/components/sheet";

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

/**
 * Start this program, so Home's Up Next shows its next workout, or end it. Labelled Start and End Program, not Follow
 * (Frank's call, 2026-11-10); underneath it is still the followed program, `user_settings.active_program_id`.
 */
export function FollowButton({ programId, following, className }: { programId: string; following: boolean; className?: string }) {
  const [pending, run] = useAction();
  return following ? (
    <Button small variant="gray" className={className} disabled={pending} onClick={() => run(() => followProgram(null))}>
      End Program
    </Button>
  ) : (
    <Button small variant="filled" className={className} disabled={pending} onClick={() => run(() => followProgram(programId))}>
      Start Program
    </Button>
  );
}

/** The program's About text, behind a gray button beside Start Program, in a sheet fitted to the text (Frank's call, 2026-11-10). */
export function AboutButton({
  title,
  description,
  authorityNotes,
  citation,
  className,
}: {
  title: string;
  description: string | null;
  authorityNotes: string | null;
  citation: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button small variant="gray" className={className} onClick={() => setOpen(true)}>
        About
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title}>
        <div className="space-y-2 px-4 pb-4 text-[15px] leading-5 text-ink-2">
          {description && <p>{description}</p>}
          {authorityNotes && <p>{authorityNotes}</p>}
          {citation && <p className="text-[13px] leading-[18px]">{citation}</p>}
        </div>
      </Sheet>
    </>
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
