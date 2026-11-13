"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { ExerciseView } from "@/lib/exercise-view";
import { ExerciseArt } from "./exercise-art";
import { exerciseFacts, ExerciseDetailTabs, type ExerciseTab } from "./exercise-detail";
import { Sheet } from "./sheet";

/** One exercise in the sheet's stack, with the tab and scroll to come back to */
type Step = { id: string; tab: ExerciseTab; scroll: number };

/**
 * The exercise's bottom sheet. Loads when it opens. An alternate is a step inside the sheet: it opens on top, Back goes
 * one step back, and Back is gone at the exercise the sheet opened on. A version (equipment, position, variation) replaces
 * the exercise in place with no Back (Frank's calls, 2026-11-13, https://claude.ai/artifact/NhAD3QmuzrigseuXLTvxXR). The
 * step's content slides in from the side it came from.
 */
export function ExerciseSheet({
  open,
  exerciseId,
  slug,
  title,
  art,
  onClose,
  initialTab = "Summary",
}: {
  open: boolean;
  exerciseId: string | null;
  slug: string | null | undefined;
  title: string;
  art: ReactNode;
  onClose: () => void;
  /** the tab the exercise it opens on starts at */
  initialTab?: ExerciseTab;
}) {
  const rootStep = (): Step[] => (exerciseId ? [{ id: exerciseId, tab: initialTab, scroll: 0 }] : []);
  const [steps, setSteps] = useState<Step[]>(rootStep);
  /** loaded views by exercise id, so a step back shows at once */
  const [views, setViews] = useState<Record<string, ExerciseView>>({});
  /** what is on screen: the previous view stays until the next one arrives */
  const [display, setDisplay] = useState<{ view: ExerciseView; depth: number } | null>(null);
  const [dir, setDir] = useState<"forward" | "back" | null>(null);
  const [failed, setFailed] = useState(false);
  // every opening, and every new exercise, starts from the exercise it opens on
  const [prev, setPrev] = useState({ exerciseId, open });
  if (prev.exerciseId !== exerciseId || prev.open !== open) {
    setPrev({ exerciseId, open });
    if (prev.exerciseId !== exerciseId || open) {
      setSteps(rootStep());
      setDir(null);
      setDisplay(null);
      setFailed(false);
    }
  }
  const top = steps[steps.length - 1] ?? null;
  const id = top?.id ?? null;
  const loaded = id ? views[id] : undefined;
  if (loaded && (display?.view !== loaded || display.depth !== steps.length)) setDisplay({ view: loaded, depth: steps.length });

  useEffect(() => {
    if (!open || !id) return;
    let live = true;
    fetch(`/api/exercises/${id}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v: ExerciseView) => {
        if (!live) return;
        setViews((cur) => ({ ...cur, [id]: v }));
        setFailed(false);
      })
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [open, id]);

  // A step lands at the top of its content; a step back where it was left
  const wrap = useRef<HTMLDivElement>(null);
  const depth = display?.depth ?? 0;
  const restore = useRef<number | null>(null);
  useLayoutEffect(() => {
    const scroller = wrap.current?.closest<HTMLElement>(".sheet-body");
    if (!scroller || restore.current === null) return;
    scroller.scrollTop = restore.current;
    restore.current = null;
  }, [depth]);

  const scrollTop = () => wrap.current?.closest<HTMLElement>(".sheet-body")?.scrollTop ?? 0;
  const pushAlternate = (next: string) => {
    const scroll = scrollTop();
    setSteps((s) => [...s.slice(0, -1), { ...s[s.length - 1], scroll }, { id: next, tab: "Summary", scroll: 0 }]);
    setDir("forward");
    restore.current = 0;
  };
  const back = () => {
    if (steps.length < 2) return;
    restore.current = steps[steps.length - 2].scroll;
    setSteps((s) => s.slice(0, -1));
    setDir("back");
  };
  const replaceVersion = (next: string) => setSteps((s) => [...s.slice(0, -1), { id: next, tab: "Summary", scroll: 0 }]);
  const setTab = (tab: ExerciseTab) => setSteps((s) => [...s.slice(0, -1), { ...s[s.length - 1], tab }]);

  const current = display?.view ?? null;
  // a step whose exercise could not load says so; a version that could not load keeps the one on screen
  const stepFailed = failed && !loaded && (!current || depth !== steps.length);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      onBack={steps.length > 1 ? back : undefined}
      title={current && !stepFailed ? (current.exercise.title ?? current.exercise.name) : title}
      thumbnail={<ExerciseArt slug={current && !stepFailed ? current.exercise.slug : slug} art={art} pad="p-1" />}
      subtitle={current && !stepFailed ? exerciseFacts(current.exercise) : undefined}
    >
      <div ref={wrap} key={depth} className={dir === "forward" && depth > 1 ? "sheet-step-forward" : dir === "back" ? "sheet-step-back" : undefined}>
        {current && !stepFailed ? (
          <ExerciseDetailTabs
            key={current.exercise.id}
            view={current}
            initialTab={steps[depth - 1]?.id === current.exercise.id ? steps[depth - 1].tab : "Summary"}
            onTabChange={setTab}
            onVersion={replaceVersion}
            onAlternate={pushAlternate}
          />
        ) : (
          <p className="py-10 text-center text-[15px] text-ink-2">{failed ? "Could not load this exercise." : "Loading…"}</p>
        )}
      </div>
    </Sheet>
  );
}
