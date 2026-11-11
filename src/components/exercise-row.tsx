"use client";

import type { ReactNode } from "react";
import type { LibraryItem } from "@/lib/exercise-items";
import { displayWeight, EQUIPMENT_LABELS } from "@/lib/workout/format";
import { floorLabel } from "@/lib/workout/machine-location";
import { ExerciseArt } from "./exercise-art";
import { FigureIcon } from "./icons";
import { Row } from "./page";

/**
 * A library row in a `.grouped` list, in the Programs row's style: the 48pt image, the name, then its muscle group or
 * equipment and the last top set, and a chevron. Tapping opens its sheet.
 */
export function ExerciseRow({ item, art, showGroup, onOpen }: { item: LibraryItem; art: ReactNode; showGroup: boolean; onOpen: () => void }) {
  const last = item.last && `${displayWeight(item.last.weight, item.equipment, item.unit) || "BW"} × ${item.last.reps}`;
  return (
    <button type="button" onClick={onOpen} className="block w-full text-left active:bg-fill">
      <Row
        leading={
          <div className="size-12 shrink-0 overflow-hidden rounded-[10px] bg-[var(--muscle-tile)]">
            <ExerciseArt
              slug={item.slug}
              pad="p-1"
              art={
                art || (
                  <div className="grid size-full place-items-center text-ink-3">
                    <FigureIcon size={20} />
                  </div>
                )
              }
            />
          </div>
        }
        title={item.movement ?? item.name}
        subtitle={[showGroup && item.group, item.choices.length > 1 ? item.choices.join(", ") : EQUIPMENT_LABELS[item.equipment], last, floorLabel(item.last?.floor)]
          .filter(Boolean)
          .join(" · ")}
        chevron
      />
    </button>
  );
}
