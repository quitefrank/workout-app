"use client";

import type { ReactNode } from "react";
import type { LibraryItem } from "@/lib/exercise-items";
import { displayWeight, EQUIPMENT_LABELS } from "@/lib/workout/format";
import { floorLabel } from "@/lib/workout/machine-location";
import { ExerciseArt } from "./exercise-art";
import { FigureIcon } from "./icons";

/** A library row: the image, the name, then its muscle group or equipment and the last top set. Tapping opens its sheet. */
export function ExerciseRow({ item, art, showGroup, onOpen }: { item: LibraryItem; art: ReactNode; showGroup: boolean; onOpen: () => void }) {
  const last = item.last && `${displayWeight(item.last.weight, item.equipment, item.unit) || "BW"} × ${item.last.reps}`;
  return (
    <button type="button" onClick={onOpen} className="flex w-full items-center gap-4 py-2 text-left active:opacity-60">
      <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-[var(--muscle-tile)] ring-1 ring-[var(--sep)]">
        <ExerciseArt
          slug={item.slug}
          art={
            art || (
              <div className="grid size-full place-items-center text-ink-3">
                <FigureIcon size={22} />
              </div>
            )
          }
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-medium">{item.movement ?? item.name}</div>
        <div className="truncate text-[15px] text-ink-2">{[showGroup && item.group, (item.choices.length > 1 ? item.choices.join(", ") : EQUIPMENT_LABELS[item.equipment]), last, floorLabel(item.last?.floor)].filter(Boolean).join(" · ")}</div>
      </div>
    </button>
  );
}
