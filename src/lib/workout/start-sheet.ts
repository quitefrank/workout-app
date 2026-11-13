import { addDays, lastTrained, recommend, recommendReason, type HeatWorkout, type RecommendCandidate } from "./heat";

/**
 * The pure parts of the dock's Choose a Workout sheet (src/components/start-workout.tsx) and Home's Recommended: which
 * workouts to suggest, what the hero card at the top of the sheet shows, and whether a start has to ask first because a
 * workout is in progress (Frank's calls, 2026-11-13, https://claude.ai/artifact/NhAD3QmuzrigseuXLTvxXR).
 */

export type RecommendedWorkout = {
  id: string;
  name: string;
  category: string | null;
  slugs: string[];
  exerciseCount: number;
  reason: string;
};

type Completed = { completedAt: string | null; templateId: string | null; day: string };

/** The templates done today or yesterday, which Recommended leaves out */
export function recentTemplateIds(workouts: Completed[], today: string): Set<string> {
  const yesterday = addDays(today, -1);
  return new Set(workouts.filter((w) => w.completedAt && w.templateId && (w.day === today || w.day === yesterday)).map((w) => w.templateId!));
}

/** Home's Recommended and the sheet's hero when no program is followed: the top `n` of `recommend`, with the reason */
export function topRecommendations<T extends RecommendCandidate & { slugs: string[]; exerciseCount: number }>(
  candidates: T[],
  heatWorkouts: HeatWorkout[],
  workouts: Completed[],
  today: string,
  n = 3,
): RecommendedWorkout[] {
  return recommend(candidates, lastTrained(heatWorkouts, today), today, recentTemplateIds(workouts, today))
    .slice(0, n)
    .map((r) => ({
      id: r.template.id,
      name: r.template.name,
      category: r.template.category,
      slugs: r.template.slugs,
      exerciseCount: r.template.exerciseCount,
      reason: recommendReason(r.group, r.days),
    }));
}

export type HeroTemplate = { id: string; name: string; category: string | null; variant?: string | null; slugs: string[]; exerciseCount: number };

export type Hero = { kind: "up-next" | "recommended"; title: string; template: HeroTemplate; subtitle: string };

const exercises = (n: number) => `${n} ${n === 1 ? "exercise" : "exercises"}`;

/** The followed program's next workout, else the top recommendation, else no card */
export function heroOf(next: HeroTemplate | null, recommended: RecommendedWorkout | null): Hero | null {
  if (next) return { kind: "up-next", title: "Up Next", template: next, subtitle: `Next in the rotation · ${exercises(next.exerciseCount)}` };
  if (recommended) return { kind: "recommended", title: "Recommended", template: recommended, subtitle: recommended.reason };
  return null;
}

/** A row's line under its name: the exercise count, and the template's own estimate when it has one */
export function rowSubtitle(exerciseCount: number, minutes: number | null | undefined): string {
  return [exercises(exerciseCount), minutes ? `${minutes} min` : null].filter(Boolean).join(" · ");
}

export type StartAsk = { message: string; discard: string; resume: string };

/** Starting while a workout is in progress asks first; with none it starts straight away (null) */
export function startAsk(inProgress: { name: string } | null, starting: string): StartAsk | null {
  if (!inProgress) return null;
  return {
    message: `${inProgress.name} is still in progress. Discard it to start ${starting}?`,
    discard: `Discard and Start ${starting}`,
    resume: `Resume ${inProgress.name}`,
  };
}

/**
 * The server's guard on starting: one workout in progress at a time. A start names the in-progress workout it replaces
 * (after the person chose Discard and Start); anything else is refused while one is open.
 */
export function startDecision(inProgressId: string | null, replacingId: string | null | undefined): "start" | "replace" | "refuse" {
  if (!inProgressId) return "start";
  return replacingId === inProgressId ? "replace" : "refuse";
}
