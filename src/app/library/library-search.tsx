"use client";

import Link from "next/link";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ExerciseRow } from "@/components/exercise-row";
import { ExerciseSheet } from "@/components/exercise-sheet";
import { GlassCircleButton } from "@/components/glass";
import { FigureIcon, SearchIcon, XIcon } from "@/components/icons";
import { Empty, Row, SectionHeader } from "@/components/page";
import { WorkoutThumb } from "@/components/workout-thumb";
import { TopBar } from "@/components/top-bar";
import { cn } from "@/lib/cn";
import { primaryPart, type CardPart } from "@/lib/workout/library-cards";
import type { LibraryItem } from "@/lib/exercise-items";
import { appScroller } from "@/lib/scroller";
import { byEntryName, oneEntryPerMovement } from "@/lib/workout/movements";

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

export type SearchWorkout = { id: string; name: string; category: string | null; slugs: string[]; exerciseCount: number };
export type SearchProgram = { id: string; name: string; slugs: string[]; weeks: number };

/**
 * The Library tab's search: one field over the whole Library (Frank's call, 2026-11-11), under the large title (`header`)
 * and above the sections (`children`). Results come in the Library's order: exercises (with muscle group pills, each
 * opening the exercise's sheet), then workouts, then programs. Search is a screen of its own, so it hides the rest of
 * the tab while it is up.
 */
export function LibrarySearch({
  groups,
  cards,
  workouts,
  programs,
  header,
  children,
}: {
  /** Every muscle group's drawing by id, for the result rows */
  groups: { id: string; name: string; art: ReactNode }[];
  /** The Library's cards, which the pills follow (`libraryCards`) */
  cards: { id: string; name: string; parts: CardPart[] }[];
  workouts: SearchWorkout[];
  programs: SearchProgram[];
  header: ReactNode;
  children: ReactNode;
}) {
  const [items, setItems] = useState<LibraryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [sheet, setSheet] = useState<LibraryItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const returnTo = useRef(0);
  const [query, setQuery] = useState("");
  // Figma's search: a plain field in the section; tapping it puts a glass field at the top and the results under it
  const [searching, setSearching] = useState(false);
  const field = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const [recents, setRecents] = useState<string[]>([]);
  // search mode is its own screen: the dock steps away until it closes (or the page goes)
  useEffect(() => {
    document.documentElement.classList.toggle("dock-hidden", searching);
    return () => document.documentElement.classList.remove("dock-hidden");
  }, [searching]);
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

  // search mode has its own muscle group pills, as Figma's results have Folders and Files
  const [pick, setPick] = useState<string | null>(null);
  const matches = useMemo(
    () => (items ?? []).filter((i) => !q || i.name.toLowerCase().includes(q) || i.title?.toLowerCase().includes(q) || i.movement?.toLowerCase().includes(q) || i.group?.toLowerCase().includes(q)),
    [items, q],
  );
  // the Library's cards the typed text finds, so a pill never leads to nothing; a pill holds its card's primary rows
  const pills = useMemo(() => cards.filter((c) => matches.some((i) => primaryPart(c, i))), [cards, matches]);
  const pickedCard = pills.find((c) => c.id === pick);
  const picked = pickedCard ? pickedCard.id : null;
  const results = byEntryName(oneEntryPerMovement(pickedCard ? matches.filter((i) => primaryPart(pickedCard, i)) : matches));
  const artOf = useMemo(() => new Map(groups.map((g) => [g.id, g.art])), [groups]);
  // workouts and programs match by name; the muscle group pills filter exercises only
  const workoutHits = q && !picked ? workouts.filter((w) => w.name.toLowerCase().includes(q)) : [];
  const programHits = q && !picked ? programs.filter((p) => p.name.toLowerCase().includes(q)) : [];

  // the field is rendered and focused inside the tap itself, so iOS raises the keyboard
  const openSearch = () => {
    returnTo.current = appScroller()?.scrollTop ?? 0;
    flushSync(() => {
      setSearching(true);
      setRecents(readRecents());
    });
    field.current?.focus();
    appScroller()?.scrollTo(0, 0);
    if (!items) {
      setFailed(false);
      fetch("/api/exercises")
        .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
        .then((d: { items: LibraryItem[] }) => setItems(d.items))
        .catch(() => setFailed(true));
    }
  };
  const closeSearch = () => {
    field.current?.blur();
    setQuery("");
    setPick(null);
    flushSync(() => setSearching(false));
    appScroller()?.scrollTo(0, returnTo.current);
  };

  return (
    <>
      <div className={searching ? "hidden" : undefined}>
        {header}
        {/* at rest the field is plain content, painted and scrolled with the page; the glass one is search mode's */}
        <div className="px-4">
          <button
            type="button"
            onClick={openSearch}
            className="flex h-11 w-full items-center gap-1.5 rounded-full bg-fill pl-3 text-left text-[17px] font-medium text-ink-2"
          >
            <SearchIcon size={19} className="shrink-0 opacity-60" />
            Search
          </button>
        </div>
        {children}
      </div>

      {searching && (
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
                aria-label="Search the Library"
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
                  className="grid size-8 shrink-0 place-items-center"
                >
                  {/* iOS's xmark.circle.fill: a filled disc in the glass ink, the cross cut out of it */}
                  <span className="grid size-[19px] place-items-center rounded-full bg-[var(--glass-ink)] opacity-45">
                    <XIcon size={11} className="text-[var(--bg)] [.ctx-dark_&]:text-black [.ctx-light_&]:text-white" />
                  </span>
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
      ) : searching ? (
        // Figma's results: filter pills, a counted header, rows with a thumbnail
        <>
          {pills.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 pb-1 pt-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {pills.map((g) => {
                const on = picked === g.id;
                return (
                  <button
                    key={g.id}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setPick(on ? null : g.id)}
                    className={cn(
                      "h-[34px] shrink-0 rounded-full border px-4 text-[16px] font-medium",
                      on ? "border-transparent bg-[var(--ink)] text-[var(--bg)]" : "border-[var(--sep)] text-ink-2",
                    )}
                  >
                    {g.name}
                  </button>
                );
              })}
            </div>
          )}
          {(results.length > 0 || workoutHits.length + programHits.length === 0) && (
            <SectionHeader title={`Exercises (${results.length === 1 ? "1 result" : `${results.length} results`})`} className="pt-4" />
          )}
          {!items ? (
            <p className="py-10 text-center text-[15px] text-ink-2">{failed ? "Could not load the exercises." : "Loading…"}</p>
          ) : results.length === 0 ? (
            workoutHits.length + programHits.length === 0 && <Empty title="No matches">Try another name or muscle group.</Empty>
          ) : (
            <ul className="grouped mx-4">
              {results.map((i) => (
                <li key={i.id}>
                  <ExerciseRow
                    item={i}
                    art={i.groupId && artOf.get(i.groupId)}
                    showGroup
                    onOpen={() => {
                      remember();
                      field.current?.blur();
                      setSheet(i);
                      setSheetOpen(true);
                    }}
                  />
                </li>
              ))}
            </ul>
          )}
          {workoutHits.length > 0 && (
            <>
              <SectionHeader title={`Workouts (${workoutHits.length})`} />
              <div className="grouped mx-4">
                {workoutHits.map((w) => (
                  <Link key={w.id} href={`/templates/${w.id}`} onClick={remember} className="block active:bg-fill">
                    <Row
                      leading={<WorkoutThumb category={w.category} label={w.name.slice(0, 1)} slugs={w.slugs} />}
                      title={w.name}
                      subtitle={`${w.exerciseCount} ${w.exerciseCount === 1 ? "exercise" : "exercises"}`}
                      chevron
                    />
                  </Link>
                ))}
              </div>
            </>
          )}
          {programHits.length > 0 && (
            <>
              <SectionHeader title={`Programs (${programHits.length})`} />
              <div className="grouped mx-4">
                {programHits.map((p) => (
                  <Link key={p.id} href={`/programs/${p.id}`} onClick={remember} className="block active:bg-fill">
                    <Row leading={<WorkoutThumb category="full_body" label="P" slugs={p.slugs} />} title={p.name} subtitle={`${p.weeks} weeks`} chevron />
                  </Link>
                ))}
              </div>
            </>
          )}
        </>
      ) : null}

      <ExerciseSheet
        open={sheetOpen}
        exerciseId={sheet?.id ?? null}
        slug={sheet?.slug}
        title={sheet?.title ?? sheet?.name ?? ""}
        art={(sheet?.groupId && artOf.get(sheet.groupId)) || <div className="grid size-full place-items-center text-ink-3"><FigureIcon size={40} /></div>}
        onClose={() => setSheetOpen(false)}
      />
    </>
  );
}
