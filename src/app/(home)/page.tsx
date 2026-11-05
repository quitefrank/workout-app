import Link from "next/link";
import { GlassCircleLink } from "@/components/glass";
import { CheckIcon, ChevronRight, GearIcon, ListIcon } from "@/components/icons";
import { Row, SectionHeader, Thumb } from "@/components/page";
import { getActiveProgramId, getMonthWorkouts, getProgram, listPrograms, type WorkoutListItem } from "@/lib/data/queries";
import { weeksLabel } from "@/lib/programs/label";
import { programHasEnded } from "@/lib/programs/today";
import { programTodayOf } from "@/lib/programs/up-next";
import { timeZone } from "@/lib/supabase/server";
import { dotsByDay } from "@/lib/workout/calendar";
import { durationMinutes, gridBounds, localDate, monthOf } from "@/lib/workout/dates";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { WeekCalendar } from "../week-calendar";
import { ProgramEmptyState } from "./program-empty-state";

export default async function HomePage({ searchParams }: { searchParams: Promise<{ d?: string }> }) {
  const params = await searchParams;
  const today = localDate(new Date(), timeZone());
  const selected = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;
  // the month is the selected day's, which seeds the strip and the panel; other weeks load as they come near
  const ym = monthOf(selected);

  const [workouts, activeId] = await Promise.all([getMonthWorkouts(ym), getActiveProgramId()]);
  const program = activeId ? await getProgram(activeId) : null;
  const followed = program ? programTodayOf(program, today) : null;
  // A program that has ended reads the same as following none
  const upNext = followed && !programHasEnded(followed) ? followed : null;
  const programs = upNext ? [] : await listPrograms();
  const upPhase = program?.phases.find((p) => p.id === upNext?.inForce.phase?.id) ?? null;
  // The program's own rows carry the variant and the sign-off note the pure model does not need.
  const rowOf = new Map(program?.phases.flatMap((p) => p.templates.map((t) => [t.id, t] as const)) ?? []);
  const upTemplates = (upNext ? [...(upNext.kind === "recovery" ? upNext.rehab : []), ...(upNext.next ? [upNext.next] : [])] : [])
    .map((t) => rowOf.get(t.id))
    .filter((t) => t !== undefined);
  const doneToday = new Set(workouts.filter((w) => w.completedAt && w.day === today && w.templateId).map((w) => w.templateId!));
  const byDay = new Map<string, WorkoutListItem[]>();
  for (const w of workouts) byDay.set(w.day, [...(byDay.get(w.day) ?? []), w]);
  const selectedWorkouts = byDay.get(selected) ?? [];
  const { from, to } = gridBounds(ym);
  const days = dotsByDay(workouts, from, to);

  return (
    <>
      <WeekCalendar
        selected={selected}
        today={today}
        days={days}
        trailing={
          <>
            <GlassCircleLink href="/workouts" label="History">
              <ListIcon size={20} />
            </GlassCircleLink>
            <GlassCircleLink href="/settings" label="Settings">
              <GearIcon size={20} />
            </GlassCircleLink>
          </>
        }
      />

      {selected !== today && (
        <div className="flex justify-end px-4 pt-1 text-[15px] text-blue">
          <Link href="/" scroll={false}>
            Today
          </Link>
        </div>
      )}

      {/* only a day with something logged has this section */}
      {selectedWorkouts.length > 0 && (
        <>
          <SectionHeader title="Workouts" className="pt-3" />
          <div className="flex flex-col gap-2.5 px-4">
            {selectedWorkouts.map((w) => (
              <DayCard key={w.id} workout={w} />
            ))}
          </div>
        </>
      )}

      {!upNext && programs.length > 0 && <ProgramEmptyState programs={programs} />}

      {program && upNext && (
        <>
          <SectionHeader title="Up Next" trailing={<Link href={`/programs/${program.id}`}>Program</Link>} />
          <div className="grouped mx-4">
            <Link href={`/programs/${program.id}`} className="block active:bg-fill">
              <Row
                title={program.recovery?.label ?? program.name}
                subtitle={
                  upPhase
                    ? upNext.kind === "recovery"
                      ? `${upNext.day !== null ? `Day ${upNext.day} · ` : ""}Phase ${upPhase.position}, ${upPhase.label} · ${weeksLabel(upPhase.week_from, upPhase.week_to)}`
                      : [upPhase.label, upPhase.block].filter(Boolean).join(" · ")
                    : undefined
                }
                chevron
              />
            </Link>
            {upTemplates.map((t) => (
              <Link key={t.id} href={`/templates/${t.id}`} className="block active:bg-fill">
                <Row
                  leading={<Thumb category={t.category} label={t.variant ?? t.name.slice(0, 1)} />}
                  title={t.name}
                  subtitle={[
                    doneToday.has(t.id) ? "Done today" : t.category === "rehab" ? "Rehab" : "Next in the rotation",
                    t.needs_signoff && "Needs physio sign-off",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                  chevron
                />
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}

/** A workout on the selected day, as Runna lists a day's sessions: it opens the workout itself (the summary when done) */
function DayCard({ workout: w }: { workout: WorkoutListItem }) {
  const status = w.completedAt ? "Done" : w.startedAt ? "In progress" : "Scheduled";
  return (
    <Link
      href={w.completedAt ? `/workouts/${w.id}/summary` : `/workouts/${w.id}`}
      className="flex items-center gap-3.5 rounded-[22px] bg-card p-3.5 active:opacity-80"
    >
      <Thumb category={w.category} label={w.name.slice(0, 1)} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[17px] font-semibold leading-[22px]">{w.name}</div>
        <div className="truncate text-[15px] text-ink-2">
          {[CATEGORY_LABELS[w.category ?? ""], `${w.exerciseCount} exercises`, minutes(w)].filter(Boolean).join(" · ")}
        </div>
      </div>
      {w.completedAt ? (
        <span aria-label={status} className="grid size-7 shrink-0 place-items-center rounded-full bg-green text-white">
          <CheckIcon size={16} strokeWidth={2.6} />
        </span>
      ) : (
        <span className="shrink-0 text-[15px] font-medium text-blue">{status}</span>
      )}
      <ChevronRight size={18} className="shrink-0 text-ink-3" />
    </Link>
  );
}

function minutes(w: WorkoutListItem): string | null {
  const m = durationMinutes(w.startedAt, w.completedAt);
  return m ? `${m} min` : null;
}
