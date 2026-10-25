"use client";

import Link from "next/link";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { GlassCircleButton } from "@/components/glass";
import { FigureIcon, SearchIcon, XIcon } from "@/components/icons";
import { Empty, LargeTitle, Row, SectionHeader } from "@/components/page";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/cn";
import { appScroller } from "@/lib/scroller";
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

// Recent searches stay on this device: a convenience, so an unreadable store just means no recents
const RECENTS_KEY = "library-recent-searches";
const RECENTS_MAX = 8;
function readRecents(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((t): t is string => typeof t === "string").slice(0, RECENTS_MAX) : [];
  } catch {
    return [];
  }
}
function writeRecents(list: string[]) {
  try {
    localStorage.setItem(RECENTS_KEY, JSON.stringify(list));
  } catch {}
}

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
  // Figma's search: a plain field under the title; tapping it puts a glass field at the top and the results under it
  const [searching, setSearching] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const [recents, setRecents] = useState<string[]>([]);
  // a search counts once it is submitted or one of its results is opened
  const remember = () => {
    const term = query.trim();
    if (!term) return;
    const next = [term, ...recents.filter((t) => t.toLowerCase() !== term.toLowerCase())].slice(0, RECENTS_MAX);
    setRecents(next);
    writeRecents(next);
  };
  const clearRecents = () => {
    setRecents([]);
    writeRecents([]);
  };

  const shown = useMemo(
    () =>
      items.filter(
        (i) =>
          // search mode searches the whole library; the muscle group filter is the resting screen's
          (searching || !group || i.groupId === group) &&
          (!q || i.name.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q)),
      ),
    [items, q, group, searching],
  );

  // the field is rendered and focused inside the tap itself, so iOS raises the keyboard
  const openSearch = () => {
    flushSync(() => {
      setSearching(true);
      setRecents(readRecents());
    });
    field.current?.focus();
    appScroller()?.scrollTo(0, 0);
  };
  const closeSearch = () => {
    field.current?.blur();
    setQuery("");
    setSearching(false);
    appScroller()?.scrollTo(0, 0);
  };

  return (
    <>
      {searching ? (
        <TopBar
          fill={
            <label className="glass flex h-11 min-w-0 flex-1 items-center gap-1.5 pl-3 pr-1.5 text-[17px]">
              <SearchIcon size={19} className="shrink-0 opacity-60" />
              <input
                ref={field}
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    remember();
                    e.currentTarget.blur();
                  }
                }}
                placeholder="Search"
                aria-label="Search exercises"
                className="min-w-0 flex-1 bg-transparent font-medium outline-none placeholder:text-[var(--glass-ink)] placeholder:opacity-50 [&::-webkit-search-cancel-button]:hidden"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    setQuery("");
                    field.current?.focus();
                  }}
                  className="grid size-8 place-items-center opacity-60"
                >
                  <XIcon size={16} />
                </button>
              )}
            </label>
          }
          trailing={
            <GlassCircleButton label="Close search" onClick={closeSearch}>
              <XIcon size={18} />
            </GlassCircleButton>
          }
        />
      ) : (
        <>
          <LargeTitle title="Library" subtitle={`${items.length} exercises`} />
          {/* at rest the field is plain content, painted and scrolled with the page; the glass one is search mode's */}
          <div className="px-4 pb-2 pt-3">
            <button
              type="button"
              onClick={openSearch}
              className="flex h-11 w-full items-center gap-1.5 rounded-full bg-fill pl-3 text-left text-[17px] font-medium text-ink-2"
            >
              <SearchIcon size={19} className="shrink-0 opacity-60" />
              Search
            </button>
          </div>
        </>
      )}

      {/* Notion's Muscle Groups gallery: tap a card to filter, tap it again to clear */}
      {!searching && (
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
      )}

      {searching && q && (
        <div className="px-4 pb-2 pt-1 text-[15px] font-semibold text-ink-2">
          {shown.length === 1 ? "1 result" : `${shown.length} results`}
        </div>
      )}

      {searching && !q ? (
        // an empty field in search mode shows the recent searches, as Figma does
        recents.length > 0 && (
          <>
            <SectionHeader
              title="Recents"
              className="pt-2"
              trailing={
                <button type="button" onClick={clearRecents}>
                  Clear
                </button>
              }
            />
            <ul className="px-4">
              {recents.map((t) => (
                <li key={t}>
                  <button
                    type="button"
                    onClick={() => {
                      setQuery(t);
                      field.current?.blur();
                    }}
                    className="flex h-12 w-full items-center gap-3 text-left text-[17px] active:opacity-60"
                  >
                    <SearchIcon size={22} className="shrink-0 text-blue" />
                    <span className="truncate">{t}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )
      ) : shown.length === 0 ? (
        <Empty title="No matches">Try another name or muscle group.</Empty>
      ) : (
        <div className="grouped mx-4">
          {shown.map((i) => (
            <Link key={i.id} href={`/exercises/${i.id}`} onClick={remember} className="block active:bg-fill">
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
