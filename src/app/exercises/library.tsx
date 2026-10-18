"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  groups: { id: string; name: string }[];
  unit: WeightUnit;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState<string | null>(null);
  const [onlyLogged, setOnlyLogged] = useState(false);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) =>
        (!group || i.groupId === group) &&
        (!onlyLogged || i.last) &&
        (!q || i.name.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q)),
    );
  }, [items, query, group, onlyLogged]);

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

      <div className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        <ChipButton on={onlyLogged} onClick={() => setOnlyLogged(!onlyLogged)}>
          Logged
        </ChipButton>
        <ChipButton on={!group} onClick={() => setGroup(null)}>
          All
        </ChipButton>
        {groups.map((g) => (
          <ChipButton key={g.id} on={group === g.id} onClick={() => setGroup(group === g.id ? null : g.id)}>
            {g.name}
          </ChipButton>
        ))}
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

function ChipButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[15px] font-medium",
        on ? "bg-ink text-bg" : "bg-fill text-ink",
      )}
    >
      {children}
    </button>
  );
}
