import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCircleLink } from "@/components/glass";
import { TopBar } from "@/components/top-bar";
import { ChevronLeft } from "@/components/icons";
import { hasExerciseImage } from "@/components/exercise-art";
import { getTemplate, getTemplateContext } from "@/lib/data/queries";
import { exerciseTitle } from "@/lib/workout/movements";
import { weeksLabel } from "@/lib/programs/label";
import { CATEGORY_LABELS, EQUIPMENT_LABELS, prescriptionFacts } from "@/lib/workout/format";
import { mainLift, workingSlugs } from "@/lib/workout/workout-art";
import { StartTemplate } from "./start-template";

/**
 * A workout before it starts, laid out as the active workout is (Ladder's, Frank's call, 2026-11-10, Figma
 * ZD41TUAEBtLJI7t0qChNup 61:5): the back arrow where the timer sits, the name, every exercise under it as Ladder lists a
 * block ("3x Barbell Bench Press", its dose under it), the main lift's illustration behind, and Start Workout in blue
 * where the pill sits. No timer, no progress bar. The list scrolls over the illustration, which stays put.
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
  const meta = [`${template.rows.length} exercises`, template.estimated_minutes && `${template.estimated_minutes} min`]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <TopBar
        spacer={false}
        leading={
          <GlassCircleLink href={context.program ? `/programs/${context.program.id}` : "/templates"} label="Back">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />

      {/* The main lift, pinned behind the list: the screen's width, square and centred, as the active workout places
          it, under a veil in the screen's colour so the list reads over it. First in the DOM so the list paints over. */}
      {lift && (
        <div aria-hidden className="pointer-events-none fixed inset-0 grid place-items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- sized WebP, and the glass painter reads the element */}
          <img
            src={`/exercises/${lift}.webp`}
            alt=""
            draggable={false}
            className="aspect-square w-full max-w-[640px] object-contain drop-shadow-[0_24px_30px_var(--art-shadow)]"
          />
          <div className="absolute inset-0" style={{ background: "rgb(var(--bg-rgb) / 0.7)" }} />
        </div>
      )}

      <main
        className="relative mx-auto w-full max-w-[640px] flex-1 text-ink"
        style={{
          paddingTop: "calc(var(--bar-top) + 44px + 18px)",
          paddingBottom: "calc(var(--dock-bottom) + 67px + 32px)",
        }}
      >
        <header className="px-5">
          {label && <div className="text-[15px] font-semibold leading-[25px] text-blue">{label}</div>}
          <h1 className="mt-[3px] text-[28px] font-extrabold leading-[30px] tracking-[-0.02em]">{template.name}</h1>
          <div className="mt-1.5 flex items-center gap-3 text-[15px] leading-[18px] text-ink-2">
            <span>{meta}</span>
            {template.tutorial_url && (
              <a href={template.tutorial_url} target="_blank" rel="noreferrer" className="font-semibold text-blue">
                Tutorial
              </a>
            )}
          </div>
        </header>

        <ol className="mt-4">
          {template.rows.map((r) => {
            const facts = prescriptionFacts(r);
            const sets = facts.find((f) => f.kind === "sets");
            const dose = facts
              .filter((f) => f.kind !== "sets")
              .map((f) => f.label)
              .join(" · ");
            return (
              <li key={r.id}>
                <Link href={`/exercises/${r.exercises.id}`} className="block px-5 py-2.5 active:bg-fill">
                  <div className="text-[17px] font-semibold leading-[22px] tracking-[-0.43px]">
                    {sets && <span className="text-blue">{sets.text}x </span>}
                    {exerciseTitle(r.exercises)}
                    {r.variant && <span className="text-ink-2"> · {r.variant}</span>}
                  </div>
                  <div className="tabular mt-0.5 text-[15px] leading-[20px] text-ink-2">
                    {dose || (template.category === "rehab" ? "No dose given" : EQUIPMENT_LABELS[r.exercises.equipment_type])}
                  </div>
                  {r.notes && <p className="mt-1 text-[13px] leading-[18px] text-ink-2">{r.notes}</p>}
                </Link>
              </li>
            );
          })}
        </ol>

        {(template.notes || context.needsSignoff || context.phases.length > 0 || context.source) && (
          <div className="space-y-2 px-5 pt-5 text-[13px] leading-[18px] text-ink-2">
            {context.needsSignoff && (
              <p>
                <span className="font-semibold text-ink">Needs physio sign-off. </span>
                {context.needsSignoff}
              </p>
            )}
            {template.notes?.split("\n\n").map((para) => <p key={para}>{para}</p>)}
            {context.program?.kind === "recovery" && context.phases.length > 0 && (
              <p>
                Runs in phase{" "}
                {context.phases.map((p) => `${p.position} (${p.label}, ${weeksLabel(p.week_from, p.week_to).toLowerCase()})`).join(", ")}
              </p>
            )}
            {context.source && (
              <p>
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
      </main>

      <StartTemplate templateId={template.id} />
    </>
  );
}
