import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCircleLink } from "@/components/glass";
import { ChevronLeft } from "@/components/icons";
import { LargeTitle, Row, Screen, SectionHeader, Thumb } from "@/components/page";
import { getProgram, type ProgramPhaseRow, type ProgramTemplateRow } from "@/lib/data/queries";
import type { ProgramPhase } from "@/lib/programs/next";
import { weeksLabel } from "@/lib/programs/label";
import { programToday } from "@/lib/programs/today";
import { timeZone } from "@/lib/supabase/server";
import { dayLabel, localDate } from "@/lib/workout/dates";
import { FollowButton, PhaseButton } from "./program-controls";

export const metadata = { title: "Program" };

export default async function ProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const program = await getProgram(id);
  if (!program) notFound();
  const today = localDate(new Date(), timeZone());

  const phases: ProgramPhase[] = program.phases.map((p) => ({
    id: p.id,
    position: p.position,
    weekFrom: p.week_from,
    weekTo: p.week_to,
    templates: p.templates,
  }));
  const now = programToday({
    kind: program.kind,
    phases,
    completions: program.completions,
    today,
    injuryDate: program.recovery?.injuryDate ?? null,
    clearances: program.clearances,
    chosenPosition: program.chosenPhasePosition,
  });
  const inForce = program.phases.find((p) => p.id === now.inForce.phase?.id) ?? null;
  const lastDone = new Map<string, string>();
  for (const c of program.completions) {
    const day = localDate(new Date(c.completedAt), timeZone());
    if ((lastDone.get(c.templateId) ?? "") < day) lastDone.set(c.templateId, day);
  }
  const phaseAt = (position: number | null) => program.phases.find((p) => p.position === position) ?? null;

  const title = program.recovery?.label ?? program.name;

  return (
    <Screen>
      <LargeTitle
        title={title}
        subtitle={program.recovery ? program.name : program.kind === "recovery" ? "Recovery program" : `${program.phases.length} weeks`}
        leading={
          <GlassCircleLink href="/templates" label="Back to templates">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />
      <div className="mt-3 flex items-center gap-3 px-4">
        <FollowButton programId={program.id} following={program.following} />
        {program.following && <span className="text-[15px] text-ink-2">Its next workout shows on the calendar.</span>}
      </div>

      <SectionHeader title="Today" />
      <div className="grouped mx-4">
        {now.kind === "recovery" && (
          <div className="px-4 py-3">
            {now.day !== null && (
              <div className="tabular text-[15px] font-medium text-ink-2">
                Day {now.day} · Week {now.week}
              </div>
            )}
            <div className="text-[20px] font-semibold leading-tight">
              {inForce ? `${inForce.label}` : "No phase"}
            </div>
            {inForce && (
              <div className="text-[15px] text-ink-2">
                Phase {inForce.position} · {weeksLabel(inForce.week_from, inForce.week_to)}
                {inForce.load_pct !== null && ` · ${inForce.load_pct}% load`}
                {inForce.gate && ` · Gate: ${inForce.gate}`}
              </div>
            )}
            <p className="mt-2 text-[13px] leading-[18px] text-ink-2">
              {reasonText(now.inForce.reason, now.logStale, phaseAt(now.inForce.loggedPosition), phaseAt(now.inForce.calendarPosition))}
              {now.weekBehindPosition !== null &&
                ` Counted a week behind the straight count, you would be in phase ${now.weekBehindPosition}, ${phaseAt(now.weekBehindPosition)?.label}. If that fits, set it below.`}
            </p>
          </div>
        )}
        {now.kind === "training" && (
          <div className="px-4 py-3">
            <div className="text-[20px] font-semibold leading-tight">
              {now.finished ? "Program finished" : inForce ? phaseTitle(inForce) : "Not started"}
            </div>
            <p className="mt-1 text-[13px] leading-[18px] text-ink-2">
              {now.inForce.reason === "chosen"
                ? "Week set by hand."
                : now.last
                  ? `Next after the last day you completed, on ${dayLabel(localDate(new Date(now.last.completedAt), timeZone()))}.`
                  : "Starts at the first day of the first week."}
            </p>
          </div>
        )}
      </div>

      {now.kind === "recovery" && now.rehab.length > 0 && (
        <>
          <SectionHeader title="Rehab" />
          <p className="-mt-1 px-4 pb-2 text-[13px] leading-[18px] text-ink-2">
            Listed every day and never scheduled: neither the physio&apos;s sheet nor the handout says how often.
          </p>
          <TemplateList templates={now.rehab} lastDone={lastDone} />
        </>
      )}

      {now.next && (
        <>
          <SectionHeader title="Up Next" />
          <TemplateList templates={[now.next]} lastDone={lastDone} start />
        </>
      )}

      {inForce && inForce.guidance.length > 0 && (
        <>
          <SectionHeader title="This Phase" />
          <div className="grouped mx-4 px-4 py-3">
            {inForce.guidance.map((g) => (
              <div key={g.heading} className="py-1.5">
                <div className="text-[13px] font-semibold uppercase tracking-[0.04em] text-ink-2">{g.heading}</div>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-[15px] leading-5">
                  {g.items.map((it) => (
                    <li key={it}>{it}</li>
                  ))}
                </ul>
              </div>
            ))}
            {inForce.flag && (
              <p className="mt-2 rounded-2xl bg-fill px-3 py-2.5 text-[13px] leading-[18px]">
                <span className="font-semibold">Watch this: </span>
                {inForce.flag}
              </p>
            )}
          </div>
        </>
      )}

      <SectionHeader title={program.kind === "recovery" ? "Phases" : "Weeks"} />
      <div className="space-y-3 px-4">
        {program.phases.map((p) => {
          const current = p.id === inForce?.id;
          return (
            <details key={p.id} open={current} className="grouped group">
              <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 px-4 py-2.5 [&::-webkit-details-marker]:hidden">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[17px] leading-[22px]">
                    {program.kind === "recovery" ? `${p.position}. ${p.label}` : phaseTitle(p)}
                  </div>
                  <div className="truncate text-[15px] leading-5 text-ink-2">
                    {[program.kind === "recovery" && weeksLabel(p.week_from, p.week_to), `${p.templates.length} templates`, current && "You are here"]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <svg width="8" height="13" viewBox="0 0 8 13" aria-hidden className="shrink-0 text-ink-3 transition-transform group-open:rotate-90">
                  <path d="M1.5 1.5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </summary>
              <div>
                {p.templates.map((t) => (
                  <TemplateRow key={t.id} t={t} last={lastDone.get(t.id)} />
                ))}
                <div className="flex justify-end px-4 py-2.5">
                  <PhaseButton
                    programId={program.id}
                    position={p.position}
                    current={current}
                    chosen={now.inForce.reason === "chosen"}
                  />
                </div>
              </div>
            </details>
          );
        })}
      </div>

      {(program.description || program.citation || program.authority_notes) && (
        <>
          <SectionHeader title="About" />
          <div className="space-y-2 px-4 text-[15px] leading-5 text-ink-2">
            {program.description && <p>{program.description}</p>}
            {program.authority_notes && <p>{program.authority_notes}</p>}
            {program.citation && <p className="text-[13px] leading-[18px]">{program.citation}</p>}
          </div>
        </>
      )}
    </Screen>
  );
}

function phaseTitle(p: Pick<ProgramPhaseRow, "position" | "label" | "block">): string {
  return [p.label, p.block].filter(Boolean).join(" · ");
}

function reasonText(
  reason: string,
  stale: boolean,
  logged: ProgramPhaseRow | null,
  calendar: ProgramPhaseRow | null,
): string {
  switch (reason) {
    case "chosen":
      return `Set by hand.${calendar ? ` The calendar from day 0 says phase ${calendar.position}.` : ""}`;
    case "log":
      return `From your clearance log.${calendar && calendar.position !== logged?.position ? ` The calendar from day 0 says phase ${calendar.position}.` : ""}`;
    case "calendar":
      return `Counted straight from day 0.${
        logged
          ? stale
            ? ` Your clearance log last named phase ${logged.position} and has gone stale, so it is not used.`
            : ""
          : " No clearance names a phase yet."
      }`;
    default:
      return "Starts at the first phase.";
  }
}

function TemplateList({
  templates,
  lastDone,
  start,
}: {
  templates: { id: string }[];
  lastDone: Map<string, string>;
  start?: boolean;
}) {
  return (
    <div className="grouped mx-4">
      {templates.map((t) => (
        <TemplateRow key={t.id} t={t as ProgramTemplateRow} last={lastDone.get(t.id)} start={start} />
      ))}
    </div>
  );
}

function TemplateRow({ t, last, start }: { t: Pick<ProgramTemplateRow, "id" | "name" | "category"> & Partial<ProgramTemplateRow>; last?: string; start?: boolean }) {
  return (
    <Link href={`/templates/${t.id}${start ? "?start=1" : ""}`} className="block active:bg-fill">
      <Row
        leading={<Thumb category={t.category} label={t.variant ?? t.name.slice(0, 1)} />}
        title={t.name}
        subtitle={
          <>
            {t.needs_signoff && <span className="font-medium text-ink">Needs physio sign-off · </span>}
            {[t.exerciseCount !== undefined && `${t.exerciseCount} exercises`, last && `Last ${dayLabel(last)}`].filter(Boolean).join(" · ")}
          </>
        }
        chevron
      />
    </Link>
  );
}
