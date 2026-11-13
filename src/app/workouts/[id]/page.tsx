import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getSettings, getWorkout } from "@/lib/data/queries";
import { journalGlassFrom } from "@/lib/workout-layout";
import { ActiveWorkout } from "./active-workout";

export const metadata = { title: "Workout" };

export default async function WorkoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [workout, settings, jar] = await Promise.all([getWorkout(id), getSettings(), cookies()]);
  if (!workout) notFound();
  if (workout.completed_at) redirect(`/workouts/${id}/summary`);
  const cookie = (name: string) => jar.get(name)?.value;
  return (
    <ActiveWorkout
      workout={workout}
      settings={settings}
      // Version 2 and Glass Steppers left Settings (Frank's call, 2026-11-12); their cookies are no longer read
      version={1}
      glassSteppers={false}
      journalGlass={journalGlassFrom(cookie)}
    />
  );
}
