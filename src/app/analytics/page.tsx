import Link from "next/link";
import { TrendChart, WeeklyBars } from "@/components/charts";
import { TrophyIcon } from "@/components/icons";
import { Chip, Empty, LargeTitle, Row, Screen, SectionHeader } from "@/components/page";
import {
  getSettings,
  getTopSets,
  getWeeklyMuscleSets,
  getWeeklyWorkouts,
  listExercises,
  listMuscleGroups,
} from "@/lib/data/queries";
import { timeZone } from "@/lib/supabase/server";
import { dayLabel, localDate, weekStarts } from "@/lib/workout/dates";
import { displayWeight, epley, formatNumber } from "@/lib/workout/format";
import { prs } from "@/lib/workout/progress";

export const metadata = { title: "Progress" };

const short = (date: string) => dayLabel(date).replace(/^\w+, /, "");

export default async function ProgressPage({ searchParams }: { searchParams: Promise<{ exercise?: string }> }) {
  const { exercise: picked } = await searchParams;
  const today = localDate(new Date(), timeZone());
  const weeks = weekStarts(today, 12);

  const [tops, exercises, groups, weekly, muscle, settings] = await Promise.all([
    getTopSets(),
    listExercises(),
    listMuscleGroups(),
    getWeeklyWorkouts(weeks[0]),
    getWeeklyMuscleSets(weekStarts(today, 4)[0]),
    getSettings(),
  ]);
  const byId = new Map(exercises.map((e) => [e.id, e]));

  // Exercises with history, most logged first
  const counts = new Map<string, number>();
  for (const t of tops) counts.set(t.exercise_id, (counts.get(t.exercise_id) ?? 0) + 1);
  const logged = [...counts.entries()].filter(([id]) => byId.has(id)).sort((a, b) => b[1] - a[1]);
  const exerciseId = picked && counts.has(picked) ? picked : logged[0]?.[0];
  const exercise = exerciseId ? byId.get(exerciseId) : undefined;
  const series = exerciseId ? tops.filter((t) => t.exercise_id === exerciseId) : [];
  const w = (n: number) => (exercise ? displayWeight(n, exercise.equipment_type, settings.weight_unit) : formatNumber(n)) || "BW";

  const perWeek = new Map(weekly.map((r) => [r.week, r.count]));
  const muscleTotals = new Map<string, number>();
  for (const r of muscle) muscleTotals.set(r.muscleGroupId, (muscleTotals.get(r.muscleGroupId) ?? 0) + r.count);
  const muscleRows = groups
    .map((g) => ({ name: g.name, sets: muscleTotals.get(g.id) ?? 0 }))
    .filter((r) => r.sets > 0)
    .sort((a, b) => b.sets - a.sets);
  const maxSets = Math.max(1, ...muscleRows.map((r) => r.sets));

  const since = new Date(Date.parse(today) - 30 * 86400000).toISOString();
  const recentPrs = prs(tops)
    .filter((p) => p.completed_at >= since && byId.has(p.exercise_id))
    .reverse();

  if (tops.length === 0) {
    return (
      <Screen>
        <LargeTitle title="Progress" />
        <div className="mt-6">
          <Empty title="No history yet">Finish a workout and your charts start here.</Empty>
        </div>
      </Screen>
    );
  }

  return (
    <Screen>
      <LargeTitle title="Progress" subtitle={`${counts.size} exercises with history`} />

      <SectionHeader title="Workouts per Week" />
      <div className="mx-4 rounded-[26px] bg-card px-2 pb-2 pt-4">
        <WeeklyBars
          points={weeks.map((wk) => ({
            label: short(wk),
            value: perWeek.get(wk) ?? 0,
            detail: `${perWeek.get(wk) ?? 0} workouts, week of ${short(wk)}`,
          }))}
        />
      </div>

      <SectionHeader title="Exercise" />
      <nav aria-label="Pick an exercise" className="no-scrollbar flex gap-2 overflow-x-auto px-4 pb-3">
        {logged.slice(0, 16).map(([id]) => (
          <Chip key={id} href={`/analytics?exercise=${id}`} on={id === exerciseId}>
            {byId.get(id)!.name}
          </Chip>
        ))}
      </nav>
      {exercise && series.length > 0 && (
        <div className="mx-4 flex flex-col gap-2.5">
          <div className="rounded-[26px] bg-card px-2 pb-3 pt-3">
            <div className="flex items-baseline justify-between px-2 pb-1">
              <h3 className="text-[17px] font-semibold">Top set</h3>
              <Link href={`/exercises/${exercise.id}`} className="text-[15px] text-blue">
                {exercise.name}
              </Link>
            </div>
            <TrendChart
              points={series.map((t) => ({
                label: short(localDate(t.completed_at)),
                value: t.weight,
                detail: `${w(t.weight)} × ${t.reps}`,
              }))}
            />
          </div>
          <div className="rounded-[26px] bg-card px-2 pb-3 pt-3">
            <h3 className="px-2 pb-1 text-[17px] font-semibold">Estimated 1RM</h3>
            <TrendChart
              points={series.map((t) => ({
                label: short(localDate(t.completed_at)),
                value: Math.round(epley(t.weight, t.reps) * 10) / 10,
                detail: w(epley(t.weight, t.reps)),
              }))}
            />
          </div>
        </div>
      )}

      <SectionHeader title="Sets by Muscle" trailing={<span className="text-ink-2">Last 4 weeks</span>} />
      {muscleRows.length ? (
        <ul className="mx-4 flex flex-col gap-2 rounded-[26px] bg-card px-4 py-4">
          {muscleRows.map((r) => (
            <li key={r.name} className="grid grid-cols-[96px_1fr_36px] items-center gap-3 text-[15px]">
              <span className="truncate">{r.name}</span>
              <span className="h-2 rounded-full bg-fill">
                <span className="block h-2 rounded-full bg-blue" style={{ width: `${(r.sets / maxSets) * 100}%` }} />
              </span>
              <span className="tabular text-right text-ink-2">{r.sets}</span>
            </li>
          ))}
        </ul>
      ) : (
        <Empty title="No working sets in the last 4 weeks" />
      )}

      <SectionHeader title="Recent PRs" trailing={<span className="text-ink-2">30 days</span>} />
      {recentPrs.length ? (
        <div className="grouped mx-4">
          {recentPrs.map((p) => {
            const e = byId.get(p.exercise_id)!;
            const ww = (n: number) => displayWeight(n, e.equipment_type, settings.weight_unit) || "BW";
            return (
              <Link key={`${p.workout_id}-${p.exercise_id}`} href={`/exercises/${e.id}`} className="block active:bg-fill">
                <Row
                  leading={<TrophyIcon size={20} className="shrink-0 text-orange" />}
                  title={e.name}
                  subtitle={`${ww(p.weight)} × ${p.reps} · ${dayLabel(localDate(p.completed_at))}`}
                  value={`+${formatNumber(p.e1rm - p.previous)} e1RM`}
                  chevron
                />
              </Link>
            );
          })}
        </div>
      ) : (
        <Empty title="No PRs in the last 30 days" />
      )}
    </Screen>
  );
}
