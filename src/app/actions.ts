"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, timeZone, userId } from "@/lib/supabase/server";
import { localDate } from "@/lib/workout/dates";
import { midpoint } from "@/lib/workout/format";
import { siblingFor, type MachineLocation } from "@/lib/workout/machine-location";
import { parseWeightCsv } from "../../scripts/parse-weight-csv";

/**
 * Every write the screens make. Each one checks the row belongs to the
 * app's user before touching it, because the service-role client
 * bypasses RLS.
 */

function fail(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

async function ownedWorkout(workoutId: string) {
  const { data, error } = await db()
    .from("workouts")
    .select("id, machine_location, completed_at")
    .eq("id", workoutId)
    .eq("user_id", userId())
    .maybeSingle();
  fail(error);
  if (!data) throw new Error("Workout not found");
  return data;
}

async function ownedWorkoutExercise(workoutExerciseId: string) {
  const { data, error } = await db()
    .from("workout_exercises")
    .select("id, workout_id, warm_up_sets_max, prescribed_reps_min, prescribed_reps_max, workouts!inner(user_id)")
    .eq("id", workoutExerciseId)
    .eq("workouts.user_id", userId())
    .maybeSingle();
  fail(error);
  if (!data) throw new Error("Exercise not found in your workouts");
  return data;
}

async function ownedSet(setId: string) {
  const { data, error } = await db()
    .from("sets")
    .select("id, workout_exercise_id, workout_exercises!inner(workout_id, workouts!inner(user_id))")
    .eq("id", setId)
    .eq("workout_exercises.workouts.user_id", userId())
    .maybeSingle();
  fail(error);
  if (!data) throw new Error("Set not found");
  return data as unknown as { id: string; workout_exercise_id: string; workout_exercises: { workout_id: string } };
}

function refreshWorkout(workoutId: string) {
  revalidatePath(`/workouts/${workoutId}`);
  revalidatePath("/", "layout");
}

async function machineLibrary() {
  const { data, error } = await db()
    .from("exercises")
    .select("id, name, machine_location")
    .not("machine_location", "is", null);
  fail(error);
  return data ?? [];
}

// ------------------------------------------------------------
// Starting and finishing
// ------------------------------------------------------------

export async function startWorkout(templateId: string, location: MachineLocation | null): Promise<void> {
  const { data: rows, error: rowsError } = await db()
    .from("template_exercises")
    .select("*, exercises(id, name, machine_location)")
    .eq("template_id", templateId)
    .order("position");
  fail(rowsError);

  const now = new Date();
  const { data: workout, error } = await db()
    .from("workouts")
    .insert({
      user_id: userId(),
      template_id: templateId,
      machine_location: location,
      scheduled_for: localDate(now, timeZone()),
      started_at: now.toISOString(),
    })
    .select("id")
    .single();
  fail(error);

  const library = location ? await machineLibrary() : [];
  const inserts = (rows ?? []).map((r) => {
    const ex = r.exercises ? siblingFor(r.exercises, location, library) : null;
    const notes = [r.variant, r.notes].filter(Boolean).join(" · ") || null;
    return {
      workout_id: workout!.id,
      exercise_id: ex?.id ?? r.exercise_id,
      position: r.position,
      prescribed_sets_min: r.prescribed_sets_min,
      prescribed_sets_max: r.prescribed_sets_max,
      prescribed_reps_min: r.prescribed_reps_min,
      prescribed_reps_max: r.prescribed_reps_max,
      prescribed_rir_min: r.prescribed_rir_min,
      prescribed_rir_max: r.prescribed_rir_max,
      prescribed_seconds_min: r.prescribed_seconds_min,
      prescribed_seconds_max: r.prescribed_seconds_max,
      prescribed_rest_seconds: r.prescribed_rest_seconds,
      prescribed_rpe: r.prescribed_rpe,
      warm_up_sets_min: r.warm_up_sets_min,
      warm_up_sets_max: r.warm_up_sets_max,
      notes,
    };
  });
  if (inserts.length) {
    const { error: insError } = await db().from("workout_exercises").insert(inserts);
    if (insError) {
      await db().from("workouts").delete().eq("id", workout!.id);
      fail(insError);
    }
  }
  revalidatePath("/", "layout");
  redirect(`/workouts/${workout!.id}`);
}

export async function completeWorkout(
  workoutId: string,
  input: { perceivedEffort: number | null; notes: string | null },
): Promise<void> {
  await ownedWorkout(workoutId);
  const effort = input.perceivedEffort != null && input.perceivedEffort >= 1 && input.perceivedEffort <= 10 ? input.perceivedEffort : null;
  const { error } = await db()
    .from("workouts")
    .update({ completed_at: new Date().toISOString(), perceived_effort: effort, notes: input.notes?.trim() || null })
    .eq("id", workoutId);
  fail(error);
  refreshWorkout(workoutId);
  redirect(`/workouts/${workoutId}/summary`);
}

export async function discardWorkout(workoutId: string): Promise<void> {
  const w = await ownedWorkout(workoutId);
  if (w.completed_at) throw new Error("A completed workout cannot be discarded here.");
  const { error } = await db().from("workouts").delete().eq("id", workoutId);
  fail(error);
  revalidatePath("/", "layout");
  redirect("/");
}

/** Switch floors: every machine row with nothing logged moves to its sibling. */
export async function setMachineLocation(workoutId: string, location: MachineLocation | null): Promise<void> {
  await ownedWorkout(workoutId);
  const { error } = await db().from("workouts").update({ machine_location: location }).eq("id", workoutId);
  fail(error);
  if (location) {
    const { data: rows, error: rowsError } = await db()
      .from("workout_exercises")
      .select("id, exercises(id, name, machine_location), sets(count)")
      .eq("workout_id", workoutId);
    fail(rowsError);
    const library = await machineLibrary();
    for (const r of (rows ?? []) as unknown as {
      id: string;
      exercises: { id: string; name: string; machine_location: MachineLocation | null } | null;
      sets: { count: number }[];
    }[]) {
      if (!r.exercises || (r.sets?.[0]?.count ?? 0) > 0) continue;
      const next = siblingFor(r.exercises, location, library);
      if (next.id !== r.exercises.id) {
        const { error: upError } = await db().from("workout_exercises").update({ exercise_id: next.id }).eq("id", r.id);
        fail(upError);
      }
    }
  }
  refreshWorkout(workoutId);
}

// ------------------------------------------------------------
// Sets
// ------------------------------------------------------------

export type SetInput = { weight: number | null; reps: number | null; isWarmUp: boolean };

function cleanSet(input: SetInput) {
  const weight = input.weight != null && Number.isFinite(input.weight) && input.weight >= 0 ? input.weight : null;
  const reps = input.reps != null && Number.isInteger(input.reps) && input.reps >= 0 ? input.reps : null;
  if (weight == null && reps == null) throw new Error("Enter a weight or reps.");
  return { weight, reps, is_warm_up: input.isWarmUp };
}

export async function logSet(workoutExerciseId: string, input: SetInput): Promise<void> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { data: last, error: lastError } = await db()
    .from("sets")
    .select("set_number")
    .eq("workout_exercise_id", workoutExerciseId)
    .order("set_number", { ascending: false })
    .limit(1);
  fail(lastError);
  const { error } = await db()
    .from("sets")
    .insert({
      workout_exercise_id: workoutExerciseId,
      set_number: (last?.[0]?.set_number ?? 0) + 1,
      completed_at: new Date().toISOString(),
      ...cleanSet(input),
    });
  fail(error);
  refreshWorkout(we.workout_id);
}

export async function updateSet(setId: string, input: SetInput): Promise<void> {
  const s = await ownedSet(setId);
  const { error } = await db().from("sets").update(cleanSet(input)).eq("id", setId);
  fail(error);
  refreshWorkout(s.workout_exercises.workout_id);
}

export async function deleteSet(setId: string): Promise<void> {
  const s = await ownedSet(setId);
  const { error } = await db().from("sets").delete().eq("id", setId);
  fail(error);
  refreshWorkout(s.workout_exercises.workout_id);
}

/**
 * Notion-style entry: "50, 70, 90, 100(5), 100(4)" replaces every set on
 * the exercise. The first values are warm-ups, as many as the
 * prescription's upper warm-up bound, exactly as the Notion seed reads it.
 */
export async function quickLog(
  workoutExerciseId: string,
  csv: string,
): Promise<{ ok: true } | { ok: false; errors: string[] }> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const reps =
    we.prescribed_reps_min != null || we.prescribed_reps_max != null
      ? { min: we.prescribed_reps_min ?? we.prescribed_reps_max!, max: we.prescribed_reps_max ?? we.prescribed_reps_min! }
      : null;
  const parsed = parseWeightCsv({
    weightCsv: csv,
    warmUpMax: we.warm_up_sets_max,
    prescribedReps: reps,
    fallbackReps: midpoint(we.prescribed_reps_min, we.prescribed_reps_max),
  });
  if (parsed.errors.length) {
    return { ok: false, errors: parsed.errors.map((e) => `Set ${e.setNumber}: "${e.token}" ${e.reason}`) };
  }
  if (parsed.sets.length === 0) return { ok: false, errors: ["Nothing to log."] };
  const { error: delError } = await db().from("sets").delete().eq("workout_exercise_id", workoutExerciseId);
  fail(delError);
  const now = new Date().toISOString();
  const { error } = await db()
    .from("sets")
    .insert(
      parsed.sets.map((s, i) => ({
        workout_exercise_id: workoutExerciseId,
        set_number: i + 1,
        is_warm_up: s.isWarmUp,
        weight: s.weight,
        reps: s.reps,
        completed_at: now,
      })),
    );
  fail(error);
  refreshWorkout(we.workout_id);
  return { ok: true };
}

// ------------------------------------------------------------
// Settings
// ------------------------------------------------------------

export async function saveSettings(input: {
  weightUnit: "lbs" | "kg";
  defaultRestSeconds: number;
  defaultMachineLocation: MachineLocation | null;
}): Promise<void> {
  const rest = Math.round(input.defaultRestSeconds);
  if (!Number.isFinite(rest) || rest < 0 || rest > 1800) throw new Error("Rest must be between 0 and 30 minutes.");
  const { error } = await db()
    .from("user_settings")
    .upsert({
      user_id: userId(),
      weight_unit: input.weightUnit === "kg" ? "kg" : "lbs",
      default_rest_seconds: rest,
      default_machine_location: input.defaultMachineLocation,
    });
  fail(error);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------
// Programmes
// ------------------------------------------------------------

/** Follow a programme, or stop following with null. A new programme starts with the phase worked out, not set by hand. */
export async function followProgram(programId: string | null): Promise<void> {
  if (programId) {
    const { data, error } = await db().from("programs").select("id").eq("id", programId).maybeSingle();
    fail(error);
    if (!data) throw new Error("No such programme.");
  }
  const { error } = await db()
    .from("user_settings")
    .upsert({ user_id: userId(), active_program_id: programId, program_phase_position: null });
  fail(error);
  revalidatePath("/", "layout");
}

/** Set the phase of the programme you follow by hand, or hand it back to the app with null. */
export async function setProgramPhase(programId: string, position: number | null): Promise<void> {
  if (position !== null) {
    const { data, error } = await db()
      .from("program_phases")
      .select("id")
      .eq("program_id", programId)
      .eq("position", position)
      .maybeSingle();
    fail(error);
    if (!data) throw new Error("No such phase.");
  }
  const { error } = await db()
    .from("user_settings")
    .upsert({ user_id: userId(), active_program_id: programId, program_phase_position: position });
  fail(error);
  revalidatePath("/", "layout");
}
