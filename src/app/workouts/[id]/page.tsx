import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSettings, getWorkout } from "@/lib/data/queries";
import { WORKOUT_LAYOUT_COOKIE, workoutLayoutFrom } from "@/lib/workout-layout";
import { ActiveWorkout } from "./active-workout";

export const metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workout, settings, jar] = await Promise.all([getWorkout(id), getSettings(), cookies()]);
  if (!workout) notFound();
  if (workout.completed_at) redirect(`/workouts/${id}/summary`);
  const layout = workoutLayoutFrom(jar.get(WORKOUT_LAYOUT_COOKIE)?.value);
  return <ActiveWorkout workout={workout} settings={settings} layout={layout} />;
}
