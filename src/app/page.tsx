import Link from "next/link";
import { buttonLook } from "@/components/button";
import { GlassCircleLink } from "@/components/glass";
import { ChevronLeft, ChevronRight, GearIcon, ListIcon } from "@/components/icons";
import { Empty, hueStyle, LargeTitle, Row, Screen, SectionHeader, Thumb, tileGradient } from "@/components/page";
import { StartWorkout } from "@/components/start-workout";
import { cn } from "@/lib/cn";
import { getActiveProgramId, getLastCompleted, getMonthWorkouts, getProgram, listTemplates, type WorkoutListItem } from "@/lib/data/queries";
import { weeksLabel } from "@/lib/programs/label";
import { programToday } from "@/lib/programs/today";
import { timeZone } from "@/lib/supabase/server";
import {
  dayLabel,
  durationMinutes,
  formatYearMonth,
  localDate,
  monthGrid,
  monthTitle,
  parseYearMonth,
  shiftMonth,
} from "@/lib/workout/dates";
import { CATEGORY_LABELS } from "@/lib/workout/format";

/** "View summary" sits on the card's colour, so it takes the over-media style; the card itself is the link */
const veil = buttonLook("veil", "blue", true);

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const params = await searchParams;
  const today = localDate(new Date(), timeZone());
  const ym = parseYearMonth(params.m) ?? parseYearMonth(today.slice(0, 7))!;
  const selected = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;

  const [workouts, last, templates, activeId] = await Promise.all([
    getMonthWorkouts(ym),
    getLastCompleted(),
    listTemplates(),
    getActiveProgramId(),
  ]);
  const program = activeId ? await getProgram(activeId) : null;
  const upNext = program
    ? programToday({
        kind: program.kind,
        phases: program.phases.map((p) => ({ id: p.id, position: p.position, weekFrom: p.week_from, weekTo: p.week_to, templates: p.templates })),
        completions: program.completions,
        today,
        injuryDate: program.recovery?.injuryDate ?? null,
        clearances: program.clearances,
        chosenPosition: program.chosenPhasePosition,
      })
    : null;
  const upPhase = program?.phases.find((p) => p.id === upNext?.inForce.phase?.id) ?? null;
  // The programme's own rows carry the variant and the sign-off note the pure model does not need.
  const rowOf = new Map(program?.phases.flatMap((p) => p.templates.map((t) => [t.id, t] as const)) ?? []);
  const upTemplates = (upNext ? [...(upNext.kind === "recovery" ? upNext.rehab : []), ...(upNext.next ? [upNext.next] : [])] : [])
    .map((t) => rowOf.get(t.id))
    .filter((t) => t !== undefined);
  const doneToday = new Set(workouts.filter((w) => w.completedAt && w.day === today && w.templateId).map((w) => w.templateId!));
  const byDay = new Map<string, WorkoutListItem[]>();
  for (const w of workouts) byDay.set(w.day, [...(byDay.get(w.day) ?? []), w]);
  const selectedWorkouts = byDay.get(selected) ?? [];
  const monthCount = workouts.filter((w) => w.completedAt && w.day.startsWith(formatYearMonth(ym))).length;

  const href = (m: string, d?: string) => `/?m=${m}${d ? `&d=${d}` : ""}`;

  return (
    <Screen>
      <LargeTitle
        title={monthTitle(ym)}
        subtitle={`${monthCount} ${monthCount === 1 ? "workout" : "workouts"} this month`}
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

      <section aria-label="Month" className="mt-4 px-4">
        <div className="mb-2 flex items-center justify-between">
          <Link
            href={href(formatYearMonth(shiftMonth(ym, -1)))}
            aria-label="Previous month"
            className="grid size-9 place-items-center rounded-full text-blue active:bg-fill"
          >
            <ChevronLeft size={20} />
          </Link>
          <Link href="/" className="rounded-full px-3 py-1.5 text-[15px] font-medium text-blue active:bg-fill">
            Today
          </Link>
          <Link
            href={href(formatYearMonth(shiftMonth(ym, 1)))}
            aria-label="Next month"
            className="grid size-9 place-items-center rounded-full text-blue active:bg-fill"
          >
            <ChevronRight size={20} />
          </Link>
        </div>
        <div className="grid grid-cols-7 pb-1 text-center text-[13px] font-semibold text-ink-3">
          {WEEKDAYS.map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div role="grid" className="grid grid-cols-7 gap-y-1">
          {monthGrid(ym).flat().map((cell) => {
            const items = byDay.get(cell.date) ?? [];
            const isToday = cell.date === today;
            const isSelected = cell.date === selected;
            return (
              <Link
                key={cell.date}
                role="gridcell"
                href={href(formatYearMonth(ym), cell.date)}
                scroll={false}
                aria-label={`${dayLabel(cell.date)}${items.length ? `, ${items.length} workout${items.length > 1 ? "s" : ""}` : ""}`}
                aria-selected={isSelected}
                className="flex h-12 flex-col items-center justify-start gap-1 pt-1"
              >
                <span
                  className={cn(
                    "tabular grid size-8 place-items-center rounded-full text-[17px]",
                    !cell.inMonth && "text-ink-3",
                    isToday && !isSelected && "font-semibold text-red",
                    isSelected && (isToday ? "bg-red font-semibold text-white" : "bg-ink font-semibold text-bg"),
                  )}
                >
                  {cell.day}
                </span>
                <span className="flex h-1.5 gap-[3px]">
                  {items.slice(0, 3).map((w) => (
                    <span
                      key={w.id}
                      style={hueStyle(w.category)}
                      className={cn(
                        "size-1.5 rounded-full",
                        w.completedAt ? "bg-[hsl(var(--h)_70%_52%)]" : "ring-1 ring-[hsl(var(--h)_70%_52%)] ring-inset",
                      )}
                    />
                  ))}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="mt-5 px-4">
        <StartWorkout templates={templates} />
      </div>

      {program && upNext && (
        <>
          <SectionHeader title="Up Next" trailing={<Link href={`/programs/${program.id}`}>Programme</Link>} />
          <div className="grouped mx-4">
            <Link href={`/programs/${program.id}`} className="block active:bg-fill">
              <Row
                title={program.recovery?.label ?? program.name}
                subtitle={
                  upPhase
                    ? upNext.kind === "recovery"
                      ? `${upNext.day !== null ? `Day ${upNext.day} · ` : ""}Phase ${upPhase.position}, ${upPhase.label} · ${weeksLabel(upPhase.week_from, upPhase.week_to)}`
                      : [upPhase.label, upPhase.block].filter(Boolean).join(" · ")
                    : upNext.kind === "training" && upNext.finished
                      ? "Programme finished"
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

      <SectionHeader title={selected === today ? "Today" : dayLabel(selected)} />
      {selectedWorkouts.length ? (
        <div className="grouped mx-4">
          {selectedWorkouts.map((w) => (
            <Link key={w.id} href={w.completedAt ? `/workouts/${w.id}/summary` : `/workouts/${w.id}`} className="block active:bg-fill">
              <Row
                leading={<Thumb category={w.category} label={w.name.slice(0, 1)} />}
                title={w.name}
                subtitle={
                  w.completedAt
                    ? [CATEGORY_LABELS[w.category ?? ""], minutes(w)].filter(Boolean).join(" · ")
                    : w.startedAt
                      ? "In progress"
                      : "Scheduled"
                }
                chevron
              />
            </Link>
          ))}
        </div>
      ) : (
        <Empty title={selected === today ? "Nothing logged yet" : "No workout"}>
          {selected === today ? "Start one from a template above." : "Rest day."}
        </Empty>
      )}

      {last && (
        <>
          <SectionHeader title="Last Workout" trailing={<Link href="/workouts">History</Link>} />
          <Link
            href={`/workouts/${last.id}/summary`}
            style={hueStyle(last.category)}
            className={cn("relative mx-4 block overflow-hidden rounded-[26px] p-5 text-white", tileGradient)}
          >
            <div className="text-[13px] font-semibold uppercase tracking-[0.06em] text-white/75">
              {dayLabel(last.day, { year: true })}
            </div>
            <div className="mt-1 text-[28px] font-bold leading-tight tracking-[-0.01em]">{last.name}</div>
            <div className="mt-1 text-[15px] text-white/80">
              {[`${last.exerciseCount} exercises`, minutes(last)].filter(Boolean).join(" · ")}
            </div>
            <div {...veil} className={cn(veil.className, "mt-5 gap-1")}>
              View summary <ChevronRight size={16} />
            </div>
          </Link>
        </>
      )}
    </Screen>
  );
}

function minutes(w: WorkoutListItem): string | null {
  const m = durationMinutes(w.startedAt, w.completedAt);
  return m ? `${m} min` : null;
}
