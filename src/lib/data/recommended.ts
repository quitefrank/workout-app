import { getHeatWorkouts, getWorkoutsBetween, listRecommendTemplates } from "@/lib/data/queries";
import { timeZone } from "@/lib/supabase/server";
import { localDate } from "@/lib/workout/dates";
import { addDays } from "@/lib/workout/heat";
import { topRecommendations, type RecommendedWorkout } from "@/lib/workout/start-sheet";

/** The first of Home's Recommended, for the dock's sheet when no program is followed (same ranking, same reason) */
export async function getTopRecommendation(): Promise<RecommendedWorkout | null> {
  const today = localDate(new Date(), timeZone());
  const [candidates, heat, recent] = await Promise.all([
    listRecommendTemplates(),
    getHeatWorkouts(today),
    getWorkoutsBetween(addDays(today, -1), today),
  ]);
  return topRecommendations(candidates, heat, recent, today, 1)[0] ?? null;
}
