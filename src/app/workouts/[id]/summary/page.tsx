import Link from "next/link";
import { notFound } from "next/navigation";
import { GlassCircleLink } from "@/components/glass";
import { TopBar } from "@/components/top-bar";
import { ChevronLeft, TrophyIcon } from "@/components/icons";
import { hueStyle, Screen, tileGradient } from "@/components/page";
import { cn } from "@/lib/cn";
import { getSettings, getTopSets, getWorkout } from "@/lib/data/queries";
import { dayLabel, durationMinutes } from "@/lib/workout/dates";
import { displayWeight, formatNumber, isRawReading } from "@/lib/workout/format";
import { prs } from "@/lib/workout/progress";

export const metadata = { title: "Summary" };

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workout, settings] = await Promise.all([getWorkout(id), getSettings()]);
  if (!workout) notFound();

  // PRs this workout set: compare against every earlier session of the same exercises
  const exerciseIds = new Set(workout.exercises.map((e) => e.exercises.id));
  const history = (await getTopSets()).filter((t) => exerciseIds.has(t.exercise_id));
  const prSet = new Set(prs(history).filter((p) => p.workout_id === id).map((p) => p.exercise_id));

  const minutes = durationMinutes(workout.started_at, workout.completed_at);
  const working = workout.exercises.flatMap((e) => e.sets.filter((s) => !s.is_warm_up));
  const unit = settings.weight_unit;

  return (
    <Screen className="max-w-none">
      <TopBar
        edge="dim"
        spacer={false}
        leading={
          <GlassCircleLink href="/workouts" label="Back to history">
            <ChevronLeft size={20} />
          </GlassCircleLink>
        }
      />
      <div style={hueStyle(workout.templates?.category)} className={cn("relative text-white", tileGradient)}>
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.3),transparent_30%,rgba(0,0,0,0.55))]" />
        <div className="relative mx-auto max-w-[640px] px-4 pb-5" style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 8px)" }}>
          <div aria-hidden className="h-11" />
          <div className="mt-10 text-[15px] font-medium text-white/75">{workout.day && dayLabel(workout.day, { year: true })}</div>
          <h1 className="text-[34px] font-bold leading-[41px] tracking-[-0.01em]">{workout.templates?.name ?? "Workout"}</h1>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            <Stat label="Time" value={minutes != null ? (minutes < 1 ? "<1m" : `${minutes}m`) : "–"} />
            <Stat label="Sets" value={String(working.length)} />
            <Stat label="Effort" value={workout.perceived_effort ? `${workout.perceived_effort}/10` : "–"} />
          </div>
        </div>
      </div>

      <div className="mx-auto flex max-w-[640px] flex-col gap-2.5 px-4 pt-4">
        {!workout.completed_at && (
          <Link href={`/workouts/${id}`} className="rounded-[20px] bg-card px-4 py-3 text-[15px] text-blue">
            This workout is still in progress. Resume it.
          </Link>
        )}
        {workout.notes && <p className="rounded-[20px] bg-card px-4 py-3 text-[15px] text-ink-2">{workout.notes}</p>}
        {workout.exercises.map((we) => {
          const raw = isRawReading(we.exercises.equipment_type);
          const tonnage = we.sets
            .filter((s) => !s.is_warm_up && s.weight != null && s.reps != null)
            .reduce((n, s) => n + Number(s.weight) * s.reps!, 0);
          return (
            <section key={we.id} className="rounded-[26px] bg-card px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <Link href={`/exercises/${we.exercises.id}`} className="min-w-0">
                  <h2 className="truncate text-[17px] font-semibold">{we.exercises.name}</h2>
                </Link>
                {prSet.has(we.exercises.id) && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-orange/15 px-2 py-0.5 text-[13px] font-semibold text-orange">
                    <TrophyIcon size={14} /> PR
                  </span>
                )}
              </div>
              {we.sets.length === 0 ? (
                <p className="text-[15px] text-ink-3">Nothing logged</p>
              ) : (
                <p className="tabular mt-0.5 text-[15px] leading-6 text-ink-2">
                  {we.sets.map((s, i) => (
                    <span key={s.id} className={s.is_warm_up ? "text-ink-3" : ""}>
                      {i > 0 && ", "}
                      {formatNumber(s.weight) || "BW"}
                      {s.reps != null && `×${s.reps}`}
                    </span>
                  ))}
                </p>
              )}
              {tonnage > 0 && !raw && (
                <p className="mt-1 text-[13px] text-ink-3">Volume {displayWeight(tonnage, we.exercises.equipment_type, unit)}</p>
              )}
            </section>
          );
        })}
      </div>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center rounded-[20px] bg-white/15 py-2.5">
      <span className="tabular text-[22px] font-bold leading-7">{value}</span>
      <span className="text-[11px] font-semibold uppercase tracking-[0.06em] opacity-75">{label}</span>
    </div>
  );
}
