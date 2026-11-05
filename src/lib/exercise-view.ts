import { getExercise, getExerciseSessions, getMovementOptions, getSettings, type ExerciseDetail } from "@/lib/data/queries";
import type { ExerciseSession } from "@/lib/workout/exercise-metrics";
import type { WeightUnit } from "@/lib/workout/format";
import type { MovementOption } from "@/lib/workout/movements";

/** What the exercise's Summary, History and How to tabs show, in the sheet and on its own page alike. */
export type ExerciseView = { exercise: ExerciseDetail; sessions: ExerciseSession[]; unit: WeightUnit; options: MovementOption[] };

export async function getExerciseView(id: string): Promise<ExerciseView | null> {
  const [exercise, sessions, settings] = await Promise.all([getExercise(id), getExerciseSessions(id), getSettings()]);
  if (!exercise) return null;
  const options = exercise.movement ? ((await getMovementOptions([exercise.movement]))[exercise.movement] ?? []) : [];
  return { exercise, sessions, unit: settings.weight_unit, options };
}
