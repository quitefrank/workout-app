import Link from "next/link";
import type { ReactNode } from "react";
import { FigureIcon } from "@/components/icons";
import { Row } from "@/components/page";
import { WorkoutThumb } from "@/components/workout-thumb";
import type { ProgramSummary } from "@/lib/data/queries";

/** Notion's Muscle Groups gallery: a card opens the group's exercises. */
export function MuscleGroupGrid({ groups }: { groups: { id: string; name: string; art: ReactNode }[] }) {
  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 px-4">
      {groups.map((g) => (
        <Link key={g.id} href={`/exercises/group/${g.id}`} className="overflow-hidden rounded-[18px] bg-card ring-1 ring-[var(--sep)] active:opacity-80">
          <div className="aspect-square bg-[var(--muscle-tile)] p-2">{g.art}</div>
          <div className="flex items-center gap-1 px-2 py-2 text-[13px] font-semibold leading-[18px]">
            <FigureIcon size={13} className="shrink-0 opacity-60" />
            <span className="truncate">{g.name}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export function ProgramRows({ programs, activeId }: { programs: ProgramSummary[]; activeId: string | null }) {
  return (
    <div className="grouped mx-4">
      {programs.map((p) => (
        <Link key={p.id} href={`/programs/${p.id}`} className="block active:bg-fill">
          <Row
            leading={<WorkoutThumb category="full_body" label="P" slugs={p.slugs} />}
            title={p.name}
            subtitle={[p.id === activeId && "Following", `${p.phaseCount} weeks`, `${p.templateCount} workouts`].filter(Boolean).join(" · ")}
            chevron
          />
        </Link>
      ))}
    </div>
  );
}
