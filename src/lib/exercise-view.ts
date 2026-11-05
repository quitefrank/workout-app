import { getExercise, getExerciseSessions, getSettings, type ExerciseDetail } from "@/lib/data/queries";
import type { ExerciseSession } from "@/lib/workout/exercise-metrics";
import type { WeightUnit } from "@/lib/workout/format";

/** What the exercise's Summary, History and How to tabs show, in the sheet and on its own page alike. */
export type ExerciseView = { exercise: ExerciseDetail; sessions: ExerciseSession[]; unit: WeightUnit };

export async function getExerciseView(id: string): Promise<ExerciseView | null> {
  const [exercise, sessions, settings] = await Promise.all([getExercise(id), getExerciseSessions(id), getSettings()]);
  return exercise ? { exercise, sessions, unit: settings.weight_unit } : null;
}
