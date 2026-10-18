import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { prescriptionFacts, type Prescription, type PrescriptionFact } from "@/lib/workout/format";
import { ClockIcon, FlameIcon, HashIcon, RepeatIcon, type IconProps } from "./icons";

const ICON: Partial<Record<PrescriptionFact["kind"], (p: IconProps) => ReactNode>> = {
  warm: FlameIcon,
  sets: RepeatIcon,
  reps: HashIcon,
  time: ClockIcon,
  rest: ClockIcon,
};

/** A prescription as Notion's Sessions columns read it: each value behind its column icon. */
export function PrescriptionLine({ p, empty, className }: { p: Prescription; empty?: ReactNode; className?: string }) {
  const facts = prescriptionFacts(p);
  if (facts.length === 0) return <>{empty}</>;
  return (
    <span className={cn("inline-flex max-w-full items-center gap-x-2.5 overflow-hidden align-bottom", className)}>
      {facts.map((f) => {
        const Icon = ICON[f.kind];
        return (
          <span key={f.kind} className="tabular inline-flex shrink-0 items-center gap-1">
            {Icon && <Icon size={14} role="img" aria-hidden={false} aria-label={f.label} className="shrink-0 opacity-70" />}
            <span aria-hidden={Icon ? true : undefined}>{f.text}</span>
          </span>
        );
      })}
    </span>
  );
}
