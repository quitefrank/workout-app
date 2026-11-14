"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followProgram } from "@/app/actions";
import { Button } from "@/components/button";
import { Row, SectionHeader } from "@/components/page";
import { WorkoutThumb } from "@/components/workout-thumb";
import { Sheet } from "@/components/sheet";
import { HeroArt, StartCapsule } from "@/components/start-workout";
import type { InProgress } from "@/components/tab-bar";
import { useStartWorkout } from "@/components/use-start-workout";
import type { ProgramSummary } from "@/lib/data/queries";

export type RecommendedWorkout = { id: string; name: string; category: string | null; slugs: string[]; reason: string };

/**
 * Home's slot when no program is followed (Frank's calls, 2026-11-11 and 2026-11-13, option E2 of the Recommended Card
 * Lab, https://claude.ai/artifact/MNr5o88RgkRkg2cdtJWuAG): one card holding the three recommendations, as the HIG's
 * Layout page groups related items, with the top pick as a hero (main lift art, name, reason, the view's one filled
 * button) and the runners-up as the Start sheet's split rows under a hairline, each with its reason. Choose Program
 * changes how Home works, so it sits outside the card as a tinted button. Start Workout and the Start capsules begin
 * the workout at once (useStartWorkout, as the + sheet does); the hero and the row bodies open the workout's page.
 * With no workout to suggest it is the plain No Program card.
 */
export function ProgramEmptyState({
  programs,
  recommended,
  inProgress,
}: {
  programs: ProgramSummary[];
  recommended: RecommendedWorkout[];
  inProgress: InProgress;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startFollow] = useTransition();
  const { starting, start, ask } = useStartWorkout(inProgress);
  const [top, ...rest] = recommended;

  const choose = (id: string) =>
    startFollow(async () => {
      try {
        await followProgram(id);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not follow the program");
      }
    });

  const chooseButton = programs.length > 0 && (
    <Button small variant="tinted" onClick={() => setOpen(true)}>
      Choose Program
    </Button>
  );

  return (
    <>
      {top ? (
        <>
          <SectionHeader title="Recommended" />
          <div className="grouped mx-4">
            <div>
              <Link href={`/templates/${top.id}`} className="block active:bg-fill">
                <HeroArt slugs={top.slugs} />
                <div className="px-4 pb-3.5 pt-3">
                  <div className="truncate text-[22px] font-bold leading-7 tracking-[-0.26px]">{top.name}</div>
                  <div className="truncate text-[15px] leading-5 text-ink-2">{top.reason}</div>
                </div>
              </Link>
              <div className="px-4 pb-4">
                <Button variant="filled" className="w-full" disabled={!!starting} onClick={(e) => start(top, e.currentTarget.getBoundingClientRect())}>
                  {starting === top.id ? "Starting…" : "Start Workout"}
                </Button>
              </div>
            </div>
            {rest.map((r) => (
              <div key={r.id} className="relative">
                <Link href={`/templates/${r.id}`} className="block active:bg-fill">
                  <Row
                    leading={<WorkoutThumb category={r.category} label={r.name.slice(0, 1)} slugs={r.slugs} />}
                    title={r.name}
                    subtitle={r.reason}
                    // room for the capsule, 16pt from the trailing edge with a 12pt gap
                    className="pr-[107px]"
                  />
                </Link>
                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                  <StartCapsule label={`Start ${r.name}`} pending={starting === r.id} disabled={!!starting} onClick={(rect) => start(r, rect)} />
                </div>
              </div>
            ))}
          </div>
          {programs.length > 0 && (
            <div className="mx-4 mt-3">
              <Button variant="tinted" className="w-full" onClick={() => setOpen(true)}>
                Choose Program
              </Button>
            </div>
          )}
          {ask}
        </>
      ) : (
        <>
          <SectionHeader title="Up Next" />
          {/* the card's fill and corners without .grouped, whose row separators drew a line above the button */}
          <div className="mx-4 flex flex-col items-center gap-3 overflow-hidden rounded-[26px] bg-card px-4 py-5 text-center">
            <div>
              <div className="text-[17px] font-semibold leading-[22px]">No Program</div>
              <p className="mt-0.5 text-[15px] leading-5 text-ink-2">Choose a program to see your next workout here.</p>
            </div>
            {chooseButton}
          </div>
        </>
      )}
      <Sheet open={open} onClose={() => setOpen(false)} title="Choose Program">
        <div className="grouped mb-4">
          {programs.map((p) => (
            <button
              key={p.id}
              type="button"
              disabled={pending}
              onClick={() => choose(p.id)}
              className="block w-full text-left active:bg-fill disabled:opacity-50"
            >
              <Row
                leading={<WorkoutThumb category="full_body" label="P" slugs={p.slugs} />}
                title={p.name}
                subtitle={`${p.phaseCount} weeks · ${p.templateCount} workouts`}
              />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
