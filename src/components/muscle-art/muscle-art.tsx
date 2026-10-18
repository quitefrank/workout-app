import { cn } from "@/lib/cn";
import { FigureIcon } from "../icons";
import { artFor } from "./lookup";
import { MUSCLE_ART_SIZE } from "./paths";

/** A muscle group's diagram from Notion, in the theme's muscle tones. Groups with no art show the figure icon. */
export function MuscleArt({ group, className }: { group: string; className?: string }) {
  const art = artFor(group);
  if (!art) {
    return (
      <div className={cn("grid size-full place-items-center text-[var(--muscle-body)]", className)}>
        <FigureIcon size={44} />
      </div>
    );
  }
  return (
    <svg viewBox={`0 0 ${MUSCLE_ART_SIZE} ${MUSCLE_ART_SIZE}`} className={cn("size-full", className)} aria-hidden="true">
      <path d={art.body} fill="var(--muscle-body)" fillRule="evenodd" />
      {art.hit && <path d={art.hit} fill="var(--muscle-hit)" fillRule="evenodd" />}
      <path d={art.line} fill="var(--muscle-line)" fillRule="evenodd" />
    </svg>
  );
}
