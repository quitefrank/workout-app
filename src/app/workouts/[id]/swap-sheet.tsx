"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { getSwapLibrary, getSwapPicks, swapExercise, type LibraryPick, type SwapPick } from "@/app/actions";
import { Button } from "@/components/button";
import { ExerciseArt } from "@/components/exercise-art";
import { SearchIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { cn } from "@/lib/cn";
import type { WorkoutExerciseRow } from "@/lib/data/queries";
import { exerciseTitle } from "@/lib/workout/movements";

/**
 * Swap, when a machine is taken (Frank's pick from the teardown, 2026-11-08): a carousel of the closest exercises, the
 * program's subs first, ending on a card that opens search over the whole library. A swap changes today's workout; the
 * finish sheet asks whether the template keeps it. Undo puts the old exercise back.
 */
export function SwapSheet({ we, onClose }: { we: WorkoutExerciseRow | null; onClose: () => void }) {
  const [picks, setPicks] = useState<SwapPick[] | null>(null);
  const [library, setLibrary] = useState<LibraryPick[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [pending, start] = useTransition();
  const track = useRef<HTMLDivElement>(null);
  const weId = we?.id ?? null;
  const name = we ? exerciseTitle(we.exercises) : "";

  // the parent keys the sheet per opening, so state starts fresh; this only fetches the picks
  useEffect(() => {
    if (!weId) return;
    let live = true;
    getSwapPicks(weId)
      .then((p) => live && setPicks(p))
      .catch(() => live && setPicks([]));
    return () => {
      live = false;
    };
  }, [weId]);

  const openSearch = () => {
    setSearching(true);
    if (!library) getSwapLibrary().then(setLibrary).catch(() => setLibrary([]));
  };

  const swap = (id: string, label: string) => {
    if (!we) return;
    const from = name;
    start(async () => {
      try {
        const res = await swapExercise(we.id, id);
        onClose();
        toast(label, {
          description: res.mode === "replaced" ? `For today, in place of ${from}` : `Added after ${from}, which keeps its logged sets`,
          action:
            res.mode === "replaced"
              ? {
                  label: "Undo",
                  onClick: () => {
                    swapExercise(we.id, res.previousExerciseId).catch(() => toast.error("Could not undo the swap"));
                  },
                }
              : undefined,
        });
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not swap");
      }
    });
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = library ?? [];
    return q ? list.filter((e) => e.name.toLowerCase().includes(q) || e.group?.toLowerCase().includes(q)) : list;
  }, [library, query]);

  const count = (picks?.length ?? 0) + 1;
  const onSeeAll = picks != null && index >= picks.length;

  return (
    <Sheet open={!!we} onClose={onClose} title={searching ? "Swap for Any Exercise" : "Swap"}>
      {!searching ? (
        <>
          <p className="px-4 pb-3 text-center text-[15px] text-ink-2">{name}</p>
          <div
            ref={track}
            onScroll={(e) => {
              const el = e.currentTarget;
              const card = el.firstElementChild as HTMLElement | null;
              const stride = card ? card.offsetWidth + 12 : 252;
              setIndex(Math.round(el.scrollLeft / stride));
            }}
            className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-[calc(50%-120px)] pb-2 [scrollbar-width:none]"
          >
            {picks == null && <div className="grid h-[290px] w-[240px] shrink-0 place-items-center text-[15px] text-ink-3">Finding swaps…</div>}
            {picks?.map((p) => (
              <div key={p.id} className="grid w-[240px] shrink-0 snap-center content-start gap-1 text-center">
                <div className="aspect-[1.15] overflow-hidden rounded-[24px] bg-fill">
                  <ExerciseArt slug={p.slug} art={null} />
                </div>
                <span className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-blue">{p.kind}</span>
                <span className="text-[17px] font-bold leading-tight">{p.name}</span>
              </div>
            ))}
            {picks != null && (
              <div className="grid w-[240px] shrink-0 snap-center content-start gap-1 text-center">
                <button type="button" onClick={openSearch} className="grid aspect-[1.15] place-items-center content-center gap-1.5 rounded-[24px] bg-fill text-[15px] font-semibold">
                  <SearchIcon size={34} className="text-blue" />
                  See all exercises
                </button>
                <span className="mt-1.5 text-[11px] font-bold uppercase tracking-[0.06em] text-blue">Library</span>
                <span className="text-[17px] font-bold leading-tight">Something else</span>
              </div>
            )}
          </div>
          <div className="flex justify-center gap-1.5 py-2" aria-hidden>
            {Array.from({ length: picks == null ? 1 : count }, (_, i) => (
              <i key={i} className={cn("size-1.5 rounded-full", i === index ? "bg-ink" : "bg-ink-3/50")} />
            ))}
          </div>
          <div className="flex flex-col gap-1.5 pt-2">
            {onSeeAll ? (
              <Button variant="filled" onClick={openSearch}>
                See All Exercises
              </Button>
            ) : (
              <Button
                variant="filled"
                disabled={pending || !picks?.length}
                onClick={() => {
                  const p = picks?.[index];
                  if (p) swap(p.id, p.name);
                }}
              >
                Replace Exercise
              </Button>
            )}
            <button type="button" onClick={onClose} className="h-11 text-[17px] font-semibold text-blue">
              Not Now
            </button>
          </div>
        </>
      ) : (
        <>
          <label className="mb-3 flex h-11 items-center gap-2 rounded-xl bg-fill px-3 text-ink-3">
            <SearchIcon size={18} />
            <input
              data-live
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search exercises"
              className="w-full bg-transparent text-[17px] text-ink outline-none placeholder:text-ink-3"
            />
          </label>
          {library == null ? (
            <p className="py-8 text-center text-[15px] text-ink-3">Loading the library…</p>
          ) : results.length === 0 ? (
            <p className="py-8 text-center text-[15px] text-ink-3">No exercise matches “{query}”.</p>
          ) : (
            <div className="grouped">
              {results.slice(0, 120).map((e) => (
                <button key={e.id} type="button" disabled={pending} onClick={() => swap(e.id, e.name)} className="flex w-full items-center gap-3 px-4 py-2 text-left">
                  <span className="size-11 shrink-0 overflow-hidden rounded-[10px] bg-fill">
                    <ExerciseArt slug={e.slug} art={null} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[17px]">{e.name}</span>
                    {e.group && <span className="block text-[13px] text-ink-2">{e.group}</span>}
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}
