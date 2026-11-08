"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { followProgram } from "@/app/actions";
import { Button } from "@/components/button";
import { Row, SectionHeader, Thumb } from "@/components/page";
import { Sheet } from "@/components/sheet";
import type { ProgramSummary } from "@/lib/data/queries";

/** Up Next when no program is followed: choosing one is optional, and any workout can still start from the + button. */
export function ProgramEmptyState({ programs }: { programs: ProgramSummary[] }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();

  const choose = (id: string) =>
    start(async () => {
      try {
        await followProgram(id);
        setOpen(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not follow the program");
      }
    });

  return (
    <>
      <SectionHeader title="Up Next" />
      {/* the card's fill and corners without .grouped, whose row separators drew a line above the button */}
      <div className="mx-4 flex flex-col overflow-hidden rounded-[26px] bg-card items-center gap-3 px-4 py-5 text-center">
        <div>
          <div className="text-[17px] font-semibold leading-[22px]">No Program</div>
          <p className="mt-0.5 text-[15px] leading-5 text-ink-2">Choose a program to see your next workout here.</p>
        </div>
        <Button small variant="tinted" onClick={() => setOpen(true)}>
          Choose Program
        </Button>
      </div>
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
                leading={<Thumb category="full_body" label="P" />}
                title={p.name}
                subtitle={`${p.phaseCount} weeks · ${p.templateCount} templates`}
              />
            </button>
          ))}
        </div>
      </Sheet>
    </>
  );
}
