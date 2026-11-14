"use client";

import { useState } from "react";
import type { TemplatePreview } from "@/app/api/templates/[id]/route";
import type { TemplateSummary } from "@/lib/data/queries";
import type { NextTemplate } from "@/lib/programs/up-next";
import { CATEGORY_LABELS, formatClock } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";
import { heroOf, rowSubtitle, type HeroTemplate, type RecommendedWorkout } from "@/lib/workout/start-sheet";
import { mainLift } from "@/lib/workout/workout-art";
import { Button } from "./button";
import { ExerciseArt, exerciseImageSrc, hasExerciseImage } from "./exercise-art";
import { FigureIcon, PlayIcon } from "./icons";
import { Row } from "./page";
import { Sheet } from "./sheet";
import { useElapsed, type InProgress } from "./tab-bar";
import { useStartWorkout } from "./use-start-workout";
import { WorkoutThumb } from "./workout-thumb";

const SECTION_TITLE = "px-4 pb-1.5 pt-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2";

/** What a row, the hero or the preview step needs to show and start a workout */
type Pick = { id: string; name: string; category: string | null; label: string; slugs: string[]; subtitle: string };

const pickOf = (t: HeroTemplate, subtitle: string): Pick => ({
  id: t.id,
  name: t.name,
  category: t.category,
  label: t.variant ?? t.name.slice(0, 1),
  slugs: t.slugs,
  subtitle,
});

/**
 * The dock's + button, beside the tab bar: Apple's Glass Prominent symbol button (iOS 27 kit, 5522:11867; material in
 * prominentMaterial, src/glass/presets.ts). A 62pt circle, as tall as the bar and 8pt from it, the dock's own layout on
 * the phone (the kit's button is 50pt), with a white plus. It lives in the root layout, so a pick has to close the sheet
 * itself.
 *
 * The sheet (Frank's calls, 2026-11-13, https://claude.ai/artifact/NhAD3QmuzrigseuXLTvxXR, "Split row"): a workout in
 * progress first with Resume, then the hero card (the program's Up Next, else Home's first Recommended) with the view's
 * one filled button, then the day templates by category. A list row whose job is an action carries a trailing button,
 * never a chevron: the gray Start capsule starts, and the row body opens a preview step inside the sheet with Back.
 * Starting calls beginWorkout from here and pushes the workout; the sheet stays up showing Starting… until the workout
 * screen arrives (the tab bar, and this with it, unmounts there), then a toast offers Undo for 5 seconds. With a workout
 * in progress a start asks first, in an action sheet grown from the Start tapped, over this sheet; a tap outside cancels.
 */
export function StartWorkout({
  templates,
  next,
  recommended,
  inProgress,
}: {
  templates: TemplateSummary[];
  next: NextTemplate | null;
  recommended: RecommendedWorkout | null;
  inProgress: InProgress;
}) {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Pick | null>(null);
  const [previews, setPreviews] = useState<Record<string, TemplatePreview | "error">>({});
  const { starting, busy, start, resume, ask } = useStartWorkout(inProgress);

  const hero = heroOf(next, recommended);
  const heroPick = hero && pickOf(hero.template, rowSubtitle(hero.template.exerciseCount, null));

  const openSheet = () => {
    setPreview(null);
    setOpen(true);
  };

  const showPreview = (p: Pick) => {
    setPreview(p);
    if (previews[p.id] && previews[p.id] !== "error") return;
    fetch(`/api/templates/${p.id}`)
      .then((r) => (r.ok ? (r.json() as Promise<TemplatePreview>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => setPreviews((m) => ({ ...m, [p.id]: data })))
      .catch(() => setPreviews((m) => ({ ...m, [p.id]: "error" })));
  };

  return (
    <>
      <button
        type="button"
        aria-label="Start a Workout"
        // it keeps its blue whatever is behind it, so the context rule leaves it out of the dock's unit
        data-glass-skip
        onClick={openSheet}
        className="glass glass-prominent pointer-events-auto relative grid size-[62px] shrink-0 place-items-center transition-transform active:scale-[1.06]"
      >
        <svg width={18} height={18} viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d="M9 1v16M1 9h16" />
        </svg>
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={preview ? preview.name : "Choose a Workout"}
        onBack={preview ? () => setPreview(null) : undefined}
      >
        {preview ? (
          <PreviewStep pick={preview} data={previews[preview.id]} starting={starting} onStart={(rect) => start(preview, rect)} />
        ) : (
          <>
            {busy && (
              <section className="mb-4">
                <h3 className={SECTION_TITLE}>In Progress</h3>
                <div className="grouped">
                  <InProgressRow workout={busy} onResume={() => resume(busy.id)} />
                </div>
              </section>
            )}
            {hero && heroPick && (
              <section className="mb-4 overflow-hidden rounded-[26px] bg-card">
                <button type="button" className="block w-full text-left active:bg-fill" onClick={() => showPreview(heroPick)}>
                  <HeroArt slugs={hero.template.slugs} />
                  <div className="px-4 pb-3.5 pt-3">
                    <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-blue">{hero.title}</div>
                    <div className="truncate text-[22px] font-bold leading-7 tracking-[-0.26px]">{hero.template.name}</div>
                    <div className="truncate text-[15px] leading-5 text-ink-2">{hero.subtitle}</div>
                  </div>
                </button>
                <div className="px-4 pb-4">
                  <Button variant="filled" className="w-full" disabled={!!starting} onClick={(e) => start(heroPick, e.currentTarget.getBoundingClientRect())}>
                    {starting === heroPick.id ? "Starting…" : "Start Workout"}
                  </Button>
                </div>
              </section>
            )}
            {groupByCategory(templates).map(([category, items]) => (
              <section key={category} className="mb-4">
                <h3 className={SECTION_TITLE}>{CATEGORY_LABELS[category] ?? "Other"}</h3>
                <div className="grouped">
                  {items.map((t) => {
                    const p = pickOf({ ...t, slugs: t.slugs ?? [] }, rowSubtitle(t.exerciseCount, t.estimated_minutes));
                    return (
                      <SplitRow key={t.id} pick={p} starting={starting} onPreview={() => showPreview(p)} onStart={(rect) => start(p, rect)} />
                    );
                  })}
                </div>
              </section>
            ))}
          </>
        )}
      </Sheet>
      {ask}
    </>
  );
}

/** The kit's Medium Bordered content button with play.fill: gray, the blue label, 34pt, its touch area 44pt */
export function StartCapsule({ label, pending, disabled, onClick }: { label: string; pending: boolean; disabled: boolean; onClick: (rect: DOMRect) => void }) {
  return (
    <Button compact variant="gray" disabled={disabled} onClick={(e) => onClick(e.currentTarget.getBoundingClientRect())} aria-label={pending ? undefined : label}>
      {pending ? (
        "Starting…"
      ) : (
        <>
          <PlayIcon size={13} aria-hidden />
          Start
        </>
      )}
    </Button>
  );
}

/** A day template: the body opens the preview step, the trailing capsule starts it (kit Row Tall, 68pt) */
function SplitRow({ pick, starting, onPreview, onStart }: { pick: Pick; starting: string | null; onPreview: () => void; onStart: (rect: DOMRect) => void }) {
  return (
    <div className="relative">
      <button type="button" className="block w-full text-left active:bg-fill" onClick={onPreview}>
        <Row
          leading={<WorkoutThumb category={pick.category} label={pick.label} slugs={pick.slugs} />}
          title={pick.name}
          subtitle={pick.subtitle}
          // room for the capsule, 16pt from the trailing edge with a 12pt gap
          className="pr-[107px]"
        />
      </button>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <StartCapsule label={`Start ${pick.name}`} pending={starting === pick.id} disabled={!!starting} onClick={onStart} />
      </div>
    </div>
  );
}

function InProgressRow({ workout, onResume }: { workout: NonNullable<InProgress>; onResume: () => void }) {
  const elapsed = useElapsed(workout.startedAt);
  return (
    <div className="relative">
      <button type="button" className="block w-full text-left active:bg-fill" onClick={onResume}>
        <Row
          leading={<WorkoutThumb category={workout.category} label={workout.name.slice(0, 1)} slugs={workout.slugs} />}
          title={workout.name}
          subtitle={<span className="tabular text-green">{elapsed != null ? `${formatClock(elapsed)} so far` : "In progress"}</span>}
          className="pr-[107px]"
        />
      </button>
      <div className="absolute right-4 top-1/2 -translate-y-1/2">
        <Button compact variant="gray" onClick={onResume} aria-label={`Resume ${workout.name}`}>
          Resume
        </Button>
      </div>
    </div>
  );
}

/** The hero's main lift, 150pt tall on the inside-a-card colour; nothing drawn, no art */
export function HeroArt({ slugs }: { slugs: string[] }) {
  const lift = mainLift(slugs, hasExerciseImage);
  if (!lift) return null;
  return (
    <div className="flex h-[150px] justify-center overflow-hidden bg-[var(--exercise-tile)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- sized WebP, and the glass painter reads the element */}
      <img src={exerciseImageSrc(lift)} alt="" className="aspect-square h-[150px]" />
    </div>
  );
}

/** The preview step: the workout's exercises as its page words them, and Start Workout at the end */
function PreviewStep({
  pick,
  data,
  starting,
  onStart,
}: {
  pick: Pick;
  data: TemplatePreview | "error" | undefined;
  starting: string | null;
  onStart: (rect: DOMRect) => void;
}) {
  return (
    <div className="pb-2">
      <p className="px-4 pb-3 text-[15px] text-ink-2">{pick.subtitle}</p>
      <div className="grouped">
        {data === undefined && <Row title={<span className="text-ink-2">Loading…</span>} />}
        {data === "error" && <Row title={<span className="text-ink-2">Could not load the exercises</span>} />}
        {data &&
          data !== "error" &&
          data.rows.map((r) => (
            <div key={r.id} className="flex min-h-11 items-center gap-3 px-4 py-2.5">
              <div className="size-12 shrink-0 overflow-hidden rounded-[10px] bg-[var(--muscle-tile)]">
                <ExerciseArt
                  slug={r.slug}
                  pad="p-1"
                  art={
                    <div className="grid size-full place-items-center text-ink-3">
                      <FigureIcon size={20} />
                    </div>
                  }
                />
              </div>
              <div className="min-w-0 flex-1">
                {r.dose && <div className="truncate text-[15px] leading-5 text-ink-2">{r.dose}</div>}
                <div className="truncate text-[17px] leading-[22px]">
                  {r.target && <span className="text-blue">{r.target} </span>}
                  {r.title}
                </div>
              </div>
            </div>
          ))}
      </div>
      <Button variant="filled" className="mt-4 w-full" disabled={!!starting} onClick={(e) => onStart(e.currentTarget.getBoundingClientRect())}>
        {starting === pick.id ? "Starting…" : "Start Workout"}
      </Button>
    </div>
  );
}
