"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useState } from "react";
import { FigureIcon, SearchIcon, XIcon } from "@/components/icons";
import { Empty, Row } from "@/components/page";
import { cn } from "@/lib/cn";
import { displayWeight, EQUIPMENT_LABELS, type EquipmentType, type WeightUnit } from "@/lib/workout/format";

export type LibraryItem = {
  id: string;
  name: string;
  group: string | null;
  groupId: string | null;
  equipment: EquipmentType;
  location: "upstairs" | "downstairs" | null;
  last: { weight: number; reps: number; at: string } | null;
};

export function ExerciseLibrary({
  items,
  groups,
  unit,
}: {
  items: LibraryItem[];
  groups: { id: string; name: string; art: ReactNode }[];
  unit: WeightUnit;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!group || i.groupId === group) &&
        (!q || i.name.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q)),
    );
  }, [items, query, group]);

  return (
    <>
      {/* The kit's search pill, pinned as the list scrolls under it */}
      <div className="sticky top-0 z-[31] px-4 pb-2 pt-3" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
        <label className="glass flex h-11 items-center gap-1.5 pl-3 pr-1.5 text-[17px]">
          <SearchIcon size={19} className="shrink-0 opacity-60" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-[var(--glass-ink)] placeholder:opacity-50 [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery("")} className="grid size-8 place-items-center opacity-60">
              <XIcon size={16} />
            </button>
          )}
        </label>
      </div>

      {/* Notion's Muscle Groups gallery: tap a card to filter, tap it again to clear */}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(104px,1fr))] gap-2.5 px-4 pb-4">
        {groups.map((g) => {
          const on = group === g.id;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => setGroup(on ? null : g.id)}
              className={cn(
                "overflow-hidden rounded-[18px] bg-card text-left ring-1 ring-[var(--sep)] transition-shadow active:opacity-80",
                on && "ring-2 ring-blue",
              )}
            >
              <div className="aspect-square bg-[var(--muscle-tile)] p-2">{g.art}</div>
              <div className="flex items-center gap-1 px-2 py-2 text-[13px] font-semibold leading-[18px]">
                <FigureIcon size={13} className="shrink-0 opacity-60" />
                <span className="truncate">{g.name}</span>
              </div>
            </button>
          );
        })}
      </div>

      {shown.length === 0 ? (
        <Empty title="No matches">Try another name or muscle group.</Empty>
      ) : (
        <div className="grouped mx-4">
          {shown.map((i) => (
            <Link key={i.id} href={`/exercises/${i.id}`} className="block active:bg-fill">
              <Row
                title={
                  <>
                    {i.name}
                    {i.location && <span className="text-ink-2"> {i.location === "upstairs" ? "↑" : "↓"}</span>}
                  </>
                }
                subtitle={
                  <>
                    {i.group && (
                      <>
                        <FigureIcon size={13} className="mr-1 inline align-[-2px] opacity-70" />
                        {i.group} ·{" "}
                      </>
                    )}
                    {EQUIPMENT_LABELS[i.equipment]}
                  </>
                }
                value={i.last ? `${displayWeight(i.last.weight, i.equipment, unit) || "BW"} × ${i.last.reps}` : undefined}
                chevron
              />
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
