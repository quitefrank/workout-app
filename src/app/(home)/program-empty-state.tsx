"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followProgram } from "@/app/actions";
import { Button, ButtonLink } from "@/components/button";
import { Row, SectionHeader } from "@/components/page";
import { WorkoutThumb } from "@/components/workout-thumb";
import { Sheet } from "@/components/sheet";
import type { ProgramSummary } from "@/lib/data/queries";

export type RecommendedWorkout = { id: string; name: string; category: string | null; slugs: string[]; reason: string };

/**
 * Home's slot when no program is followed (Frank's call, 2026-11-11): Recommended, the workout whose muscles have rested
 * longest with the reason, two runners-up, and Choose Program. Following a program stays optional; any workout can still
 * start from the + button. With no workout to suggest it is the plain No Program card.
 */
export function ProgramEmptyState({ programs, recommended }: { programs: ProgramSummary[]; recommended: RecommendedWorkout[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [top, ...rest] = recommended;

  const choose = (id: string) =>
    start(async () => {
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
          <div className="mx-4 flex flex-col gap-3.5 rounded-[26px] bg-card p-4">
            <Link href={`/templates/${top.id}`} className="flex items-center gap-3.5 active:opacity-70">
              <WorkoutThumb category={top.category} label={top.name.slice(0, 1)} slugs={top.slugs} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[17px] font-semibold leading-[22px]">{top.name}</div>
                <div className="truncate text-[15px] leading-5 text-ink-2">{top.reason}</div>
              </div>
            </Link>
            <ButtonLink href={`/templates/${top.id}`} variant="filled">
              Start
            </ButtonLink>
            <div className="flex flex-wrap gap-2">
              {rest.map((r) => (
                <ButtonLink key={r.id} href={`/templates/${r.id}`} small variant="gray" className="pr-4" style={{ color: "var(--ink)" }}>
                  {r.name}
                </ButtonLink>
              ))}
              {chooseButton}
            </div>
          </div>
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
