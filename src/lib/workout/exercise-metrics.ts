import { epley } from "./format";
import type { MachineLocation } from "./machine-location";

/** One completed workout's sets of one exercise, as the exercise sheet shows them. */
export type ExerciseSet = { number: number; warmUp: boolean; dropSet: boolean; weight: number | null; reps: number | null; seconds: number | null };
export type ExerciseSession = { workoutId: string; name: string; completedAt: string; floor: MachineLocation | null; sets: ExerciseSet[] };

/** The floor of the most recent session on one. */
export function latestFloor(sessions: readonly ExerciseSession[]): MachineLocation | null {
  return [...sessions].sort((a, b) => b.completedAt.localeCompare(a.completedAt)).find((s) => s.floor)?.floor ?? null;
}

/** The sessions on one floor. Metrics are only ever worked out over one floor's sessions, so PRs never mix. */
export function sessionsOnFloor(sessions: readonly ExerciseSession[], floor: MachineLocation | null): ExerciseSession[] {
  return sessions.filter((s) => s.floor === floor);
}

export type ExerciseMetric = "heaviest" | "e1rm";
export type MetricPoint = { at: string; value: number; weight: number; reps: number };

const VALUE: Record<ExerciseMetric, (weight: number, reps: number) => number> = {
  heaviest: (weight) => weight,
  e1rm: epley,
};

/** A session's best working set by a metric. Warm-ups, drop sets and sets without a weight and reps do not count. */
function bestSet(session: ExerciseSession, metric: ExerciseMetric): MetricPoint | null {
  let best: MetricPoint | null = null;
  for (const s of session.sets) {
    if (s.warmUp || s.dropSet || s.weight == null || !s.reps) continue;
    const value = VALUE[metric](s.weight, s.reps);
    if (!best || value > best.value) best = { at: session.completedAt, value, weight: s.weight, reps: s.reps };
  }
  return best;
}

/** One point per session that has a working set, in the order given. */
export function metricSeries(sessions: readonly ExerciseSession[], metric: ExerciseMetric): MetricPoint[] {
  return sessions.map((s) => bestSet(s, metric)).filter((p): p is MetricPoint => p !== null);
}

/** The all-time best by a metric; the earliest wins a tie, since that is when the record was set. */
export function metricBest(sessions: readonly ExerciseSession[], metric: ExerciseMetric): MetricPoint | null {
  return [...metricSeries(sessions, metric)]
    .sort((a, b) => a.at.localeCompare(b.at))
    .reduce<MetricPoint | null>((best, p) => (!best || p.value > best.value ? p : best), null);
}
