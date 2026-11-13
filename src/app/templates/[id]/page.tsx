import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCircleLink } from "@/components/glass";
import { TopBar } from "@/components/top-bar";
import { ChevronLeft, FigureIcon, GearIcon } from "@/components/icons";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { ExerciseArt, exerciseImageSrc, hasExerciseImage } from "@/components/exercise-art";
import { hueStyle, Screen, SectionHeader, tileGradient } from "@/components/page";
import { cn } from "@/lib/cn";
import { getTemplate, getTemplateContext } from "@/lib/data/queries";
import { exerciseTitle } from "@/lib/workout/movements";
import { weeksLabel } from "@/lib/programs/label";
import { CATEGORY_LABELS, EQUIPMENT_LABELS, prescriptionFacts } from "@/lib/workout/format";
import { mainLift, workingSlugs } from "@/lib/workout/workout-art";
import { repTarget } from "@/lib/workout/active";
import { StartTemplate } from "./start-template";

/**
 * A workout before it starts. The hero shows the main lift on the screen's colour in place of the colour gradient,
 * with the program, or the category, in blue over the name, set as the active workout's header sets it. Each exercise
 * row shows its illustration where its number was, then leads with the active workout's rep target ("8–10x Standing Arnold Press") with its warm-ups and sets under it,
 * and Start Workout is the filled blue button pinned at the bottom (Frank's calls, 2026-11-10). There is no Tutorial
 * button: every exercise has its own demonstration (Frank's call, 2026-11-10).
 */
export default async function TemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [template, context] = await Promise.all([getTemplate(id), getTemplateContext(id)]);
  if (!template) notFound();

  const lift = mainLift(
    workingSlugs(template.rows.map((r) => ({ slug: r.exercises.slug, group: r.exercises.muscle_groups?.name }))),
    hasExerciseImage,
  );
  const label = context.program?.name ?? CATEGORY_LABELS[template.category ?? ""] ?? null;

  return (
    <Screen className="max-w-none">
      <TopBar
        edge={lift ? "soft" : "dim"}
        spacer={false}
        leading={
          <GlassCircleLink href={context.program ? `/programs/${context.program.id}` : "/library/workouts"} label="Back">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
        // Settings, for tuning the Start Workout edge on this page (Frank's call, 2026-11-12)
        trailing={
          <GlassCircleLink href="/settings" label="Settings">
            <GearIcon size={20} />
          </GlassCircleLink>
        }
      />
      <div
        style={hueStyle(template.category)}
        // With the main lift the hero is the screen's colour, light or dark, and its text the app's ink, as on the active
        // workout (Frank's call, 2026-11-10); with nothing drawn it keeps the colour tile and white text
        className={cn("relative overflow-hidden", lift ? "bg-bg text-ink" : cn("text-white", tileGradient))}
      >
        {lift ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- sized WebP, and the glass painter reads the element */}
            <img
              src={exerciseImageSrc(lift)}
              alt=""
              draggable={false}
              // the hero is the original height, shorter than the square, so the figure is centred in it
              className="absolute left-1/2 top-1/2 aspect-square w-full max-w-[480px] -translate-x-1/2 -translate-y-1/2"
            />
            {/* The illustration fades into the screen's colour under the text, as the active workout's header fade does */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(rgb(var(--bg-rgb) / 0) 12%, rgb(var(--bg-rgb) / 0.8) 40%, rgb(var(--bg-rgb) / 0.92) 70%, rgb(var(--bg-rgb)) 100%)",
              }}
            />
          </>
        ) : (
          <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.3),transparent_25%,transparent_45%,rgba(0,0,0,0.6))]" />
        )}
        <div className="relative mx-auto max-w-[640px] px-5 pb-5" style={{ paddingTop: "var(--bar-top)" }}>
          <div aria-hidden className="h-11" />
          {/* As the active workout's header, at the same place so starting is seamless (Frank's call, 2026-11-10): the
              blue line 78pt under --bar-top (its 44pt timer row, 24pt progress bar and 10pt to the set text), 3pt to
              the title, 6pt to the line under it */}
          <div className="mt-[34px] text-[15px] font-semibold leading-[25px] text-blue">
            {label ?? " "}
          </div>
          <h1 className="mt-[3px] text-[28px] font-extrabold leading-[30px] tracking-[-0.02em]">{template.name}</h1>
          {(template.rows.length > 0 || template.estimated_minutes) && (
            <div className={cn("mt-1.5 text-[15px] leading-[18px]", lift ? "text-ink-2" : "text-white/70")}>
              {[`${template.rows.length} exercises`, template.estimated_minutes && `${template.estimated_minutes} min`]
                .filter(Boolean)
                .join(" · ")}
            </div>
          )}
        </div>
      </div>

      <div className="mx-auto max-w-[640px]">
        {context.needsSignoff && (
          <p className="mx-4 mt-4 rounded-2xl bg-fill px-3 py-2.5 text-[15px] leading-5">
            <span className="font-semibold">Needs physio sign-off. </span>
            {context.needsSignoff}
          </p>
        )}
        {template.notes &&
          template.notes.split("\n\n").map((para) => (
            <p key={para} className="px-4 pt-4 text-[15px] text-ink-2">
              {para}
            </p>
          ))}
        {(context.phases.length > 0 || context.source) && (
          <div className="px-4 pt-3 text-[13px] leading-[18px] text-ink-2">
            {context.phases.length > 0 && (
              <p>
                {context.program?.kind === "recovery" ? "Runs in" : "Part of"}{" "}
                {context.program && (
                  <Link href={`/programs/${context.program.id}`} className="text-blue">
                    {context.program.kind === "recovery" ? "phase" : context.program.name}
                  </Link>
                )}{" "}
                {context.program?.kind === "recovery"
                  ? context.phases.map((p) => `${p.position} (${p.label}, ${weeksLabel(p.week_from, p.week_to).toLowerCase()})`).join(", ")
                  : ""}
              </p>
            )}
            {context.source && (
              <p className="mt-1">
                Source:{" "}
                {context.source.url ? (
                  <a href={context.source.url} target="_blank" rel="noreferrer" className="text-blue">
                    {context.source.citation}
                  </a>
                ) : (
                  context.source.citation
                )}
              </p>
            )}
          </div>
        )}
        <SectionHeader title={`${template.rows.length} Exercises`} />
        <div className="grouped mx-4">
          {template.rows.map((r) => {
            // The active workout header's rep target ("8–10x"), or a timed set's length ("30s")
            const target = repTarget(r, { kind: "work", reps: null, seconds: null });
            // Under it, the warm-ups and the set count; reps are in the target and rest is left out
            const dose = prescriptionFacts(r)
              .filter((f) => f.kind === "warm" || f.kind === "sets")
              .map((f) => f.label)
              .join(" · ");
            return (
              <Link key={r.id} href={`/exercises/${r.exercises.id}`} className="block active:bg-fill">
                {/* Row's layout with the lines flipped: the sets over the name, as the active workout's header has them */}
                <div className="flex min-h-11 items-center gap-3 px-4 py-2.5">
                  {/* the exercise's illustration, as the library's rows show it, in place of its number */}
                  <div className="size-12 shrink-0 overflow-hidden rounded-[10px] bg-[var(--muscle-tile)]">
                    <ExerciseArt
                      slug={r.exercises.slug}
                      pad="p-1"
                      art={
                        r.exercises.muscle_groups?.name ? (
                          <MuscleArt group={r.exercises.muscle_groups.name} />
                        ) : (
                          <div className="grid size-full place-items-center text-ink-3">
                            <FigureIcon size={20} />
                          </div>
                        )
                      }
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[15px] leading-5 text-ink-2">
                      {dose || (template.category === "rehab" ? "No dose given" : EQUIPMENT_LABELS[r.exercises.equipment_type])}
                    </div>
                    <div className="truncate text-[17px] leading-[22px]">
                      {target && <span className="text-blue">{target} </span>}
                      {exerciseTitle(r.exercises)}
                      {r.variant && <span className="text-ink-2"> · {r.variant}</span>}
                    </div>
                  </div>
                  <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden className="shrink-0 text-ink-3">
                    <path d="M1.5 1.5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </div>
                {r.notes && <p className="-mt-1.5 px-4 pb-2.5 pl-[76px] text-[13px] text-ink-2">{r.notes}</p>}
              </Link>
            );
          })}
        </div>
      </div>

      <StartTemplate templateId={template.id} />
    </Screen>
  );
}
