import Link from "next/link";
import { GlassCircleLink } from "@/components/glass";
import { ChevronLeft, ChevronRight, GearIcon, ListIcon } from "@/components/icons";
import { Empty, hueStyle, LargeTitle, Row, Screen, SectionHeader, Thumb, tileGradient } from "@/components/page";
import { StartWorkout } from "@/components/start-workout";
import { cn } from "@/lib/cn";
import { getLastCompleted, getMonthWorkouts, listTemplates, type WorkoutListItem } from "@/lib/data/queries";
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

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ m?: string; d?: string }> }) {
  const params = await searchParams;
  const today = localDate(new Date(), timeZone());
  const ym = parseYearMonth(params.m) ?? parseYearMonth(today.slice(0, 7))!;
  const selected = params.d && /^\d{4}-\d{2}-\d{2}$/.test(params.d) ? params.d : today;

  const [workouts, last, templates] = await Promise.all([getMonthWorkouts(ym), getLastCompleted(), listTemplates()]);
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
            <div className="glass mt-5 inline-flex h-11 items-center gap-1 pl-4 pr-3 text-[15px] font-semibold [--glass-ink:#fff]">
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
