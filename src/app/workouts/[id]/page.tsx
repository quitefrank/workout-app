import { notFound, redirect } from "next/navigation";
import { getSettings, getWorkout } from "@/lib/data/queries";
import { ActiveWorkout } from "./active-workout";

export const metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workout, settings] = await Promise.all([getWorkout(id), getSettings()]);
  if (!workout) notFound();
  if (workout.completed_at) redirect(`/workouts/${id}/summary`);
  return <ActiveWorkout workout={workout} settings={settings} />;
}
