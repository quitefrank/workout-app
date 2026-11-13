"use server";

import { revalidatePath } from "next/cache";
import { redirect, RedirectType } from "next/navigation";
import { getActiveProgramId, getProgram } from "@/lib/data/queries";
import { programHasEnded } from "@/lib/programs/today";
import { programTodayOf } from "@/lib/programs/up-next";
import { db, timeZone, userId } from "@/lib/supabase/server";
import { localDate } from "@/lib/workout/dates";
import { swappedFrom } from "@/lib/workout/active";
import { midpoint } from "@/lib/workout/format";
import { FIRST_FLOOR, FLOORS, type MachineLocation } from "@/lib/workout/machine-location";
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
    .select("id, completed_at")
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

/** The floor each exercise was last done on. */
async function lastFloors(exerciseIds: string[]): Promise<Map<string, MachineLocation>> {
  const out = new Map<string, MachineLocation>();
  if (exerciseIds.length === 0) return out;
  const { data, error } = await db()
    .from("v_workout_exercise_top_set")
    .select("exercise_id, machine_location")
    .eq("user_id", userId())
    .in("exercise_id", exerciseIds)
    .not("machine_location", "is", null)
    .not("workout_completed_at", "is", null)
    .order("workout_completed_at", { ascending: false })
    .limit(exerciseIds.length * 20);
  fail(error);
  for (const r of data ?? []) if (r.exercise_id && r.machine_location && !out.has(r.exercise_id)) out.set(r.exercise_id, r.machine_location);
  return out;
}

// ------------------------------------------------------------
// Starting and finishing
// ------------------------------------------------------------

export async function startWorkout(templateId: string): Promise<void> {
  const { data: rows, error: rowsError } = await db()
    .from("template_exercises")
    .select("*, exercises(id, has_floors)")
    .eq("template_id", templateId)
    .order("position");
  fail(rowsError);

  const now = new Date();
  const { data: workout, error } = await db()
    .from("workouts")
    .insert({
      user_id: userId(),
      template_id: templateId,
      scheduled_for: localDate(now, timeZone()),
      started_at: now.toISOString(),
    })
    .select("id")
    .single();
  fail(error);

  // A two-floor exercise starts on the floor it was last done on; setExerciseFloor changes it from there
  const floors = await lastFloors((rows ?? []).filter((r) => r.exercises?.has_floors).map((r) => r.exercise_id));
  const inserts = (rows ?? []).map((r) => {
    const notes = [r.variant, r.notes].filter(Boolean).join(" · ") || null;
    return {
      workout_id: workout!.id,
      exercise_id: r.exercise_id,
      machine_location: r.exercises?.has_floors ? (floors.get(r.exercise_id) ?? FIRST_FLOOR) : null,
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

/**
 * Finish the workout. With keepSwaps, each exercise swapped today replaces the one it swapped out on the template, so
 * the next time starts on it; without, the template is untouched.
 */
export async function completeWorkout(workoutId: string, input: { keepSwaps: boolean }): Promise<void> {
  await ownedWorkout(workoutId);
  if (input.keepSwaps) await keepSwapsInTemplate(workoutId);
  const { error } = await db().from("workouts").update({ completed_at: new Date().toISOString() }).eq("id", workoutId);
  fail(error);
  await stopFollowingIfEnded();
  refreshWorkout(workoutId);
  // replace, so the finished workout is not one step back: it redirects to its summary, so Back there did nothing
  redirect(`/workouts/${workoutId}/summary`, RedirectType.replace);
}

async function keepSwapsInTemplate(workoutId: string): Promise<void> {
  const { data: w, error } = await db()
    .from("workouts")
    .select("template_id, workout_exercises(position, exercise_id, swapped_from_exercise_id)")
    .eq("id", workoutId)
    .single();
  fail(error);
  const workout = w as unknown as { template_id: string | null; workout_exercises: { position: number; exercise_id: string; swapped_from_exercise_id: string | null }[] };
  if (!workout.template_id) return;
  const swaps = workout.workout_exercises.filter((r) => r.swapped_from_exercise_id);
  if (swaps.length === 0) return;
  const { data: rows, error: rowsError } = await db()
    .from("template_exercises")
    .select("id, position, exercise_id")
    .eq("template_id", workout.template_id);
  fail(rowsError);
  const taken = new Set<string>();
  for (const s of swaps) {
    // the template row that held the old exercise, the nearest by position when it appears more than once
    const match = (rows ?? [])
      .filter((r) => r.exercise_id === s.swapped_from_exercise_id && !taken.has(r.id))
      .sort((a, b) => Math.abs(a.position - s.position) - Math.abs(b.position - s.position))[0];
    if (!match) continue;
    taken.add(match.id);
    const { error: upError } = await db().from("template_exercises").update({ exercise_id: s.exercise_id }).eq("id", match.id);
    fail(upError);
  }
  revalidatePath("/templates", "layout");
  revalidatePath("/library", "layout");
}

/** The workout that finishes a program takes the app back to following none. It never blocks finishing the workout. */
async function stopFollowingIfEnded(): Promise<void> {
  try {
    const activeId = await getActiveProgramId();
    const program = activeId ? await getProgram(activeId) : null;
    if (program && programHasEnded(programTodayOf(program, localDate(new Date(), timeZone())))) await followProgram(null);
  } catch (e) {
    console.error("Could not check whether the program ended", e);
  }
}

export async function discardWorkout(workoutId: string): Promise<void> {
  const w = await ownedWorkout(workoutId);
  if (w.completed_at) throw new Error("A completed workout cannot be discarded here.");
  const { error } = await db().from("workouts").delete().eq("id", workoutId);
  fail(error);
  revalidatePath("/", "layout");
  // replace, so history going back never opens the discarded workout
  redirect("/", RedirectType.replace);
}

/** Delete a finished workout, with its exercises and sets. One still in progress goes through discardWorkout. */
export async function deleteWorkout(workoutId: string): Promise<void> {
  const w = await ownedWorkout(workoutId);
  if (!w.completed_at) throw new Error("This workout is still in progress. Discard it from the workout instead.");
  const { error } = await db().from("workouts").delete().eq("id", workoutId);
  fail(error);
  revalidatePath("/", "layout");
  redirect("/workouts");
}

/**
 * The floor of one exercise in a workout. The workout's other two-floor exercises with nothing logged follow it, since
 * they are probably on the same floor; anything already logged keeps its own.
 */
/**
 * Another way of doing the same movement, on a row in the workout: other equipment or another technique. The row and
 * its sets move to that library row, and the template is untouched, so next time starts on what it prescribes.
 */
export async function setExerciseOption(workoutExerciseId: string, exerciseId: string): Promise<void> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { data: row, error: rowError } = await db().from("workout_exercises").select("exercise_id, swapped_from_exercise_id, machine_location, exercises(movement)").eq("id", workoutExerciseId).single();
  fail(rowError);
  const { data: next, error: nextError } = await db().from("exercises").select("id, movement, has_floors").eq("id", exerciseId).maybeSingle();
  fail(nextError);
  const current = row as unknown as { exercise_id: string; swapped_from_exercise_id: string | null; machine_location: MachineLocation | null; exercises: { movement: string | null } | null };
  const movement = current.exercises?.movement;
  if (!next || !movement || next.movement !== movement) throw new Error("That is not the same movement.");
  const floors = next.has_floors && !current.machine_location ? await lastFloors([next.id]) : null;
  const { error } = await db()
    .from("workout_exercises")
    .update({
      exercise_id: next.id,
      machine_location: next.has_floors ? (current.machine_location ?? floors?.get(next.id) ?? FIRST_FLOOR) : null,
      swapped_from_exercise_id: swappedFrom({ exerciseId: current.exercise_id, swappedFrom: current.swapped_from_exercise_id }, next.id),
    })
    .eq("id", workoutExerciseId);
  fail(error);
  refreshWorkout(we.workout_id);
}

export type SwapResult = { mode: "replaced"; previousExerciseId: string } | { mode: "added" };

/**
 * Swap a row in the workout for any exercise, when a machine is taken. With nothing logged the row becomes the new
 * exercise; once sets are logged they stay with the exercise they were done on, and the new exercise is added straight
 * after with the same prescription. Either way the row remembers what it replaced, for "Keep swaps in template".
 */
export async function swapExercise(workoutExerciseId: string, exerciseId: string): Promise<SwapResult> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { data: row, error: rowError } = await db()
    .from("workout_exercises")
    .select("*, sets(count)")
    .eq("id", workoutExerciseId)
    .single();
  fail(rowError);
  const current = row as unknown as Record<string, unknown> & { exercise_id: string; swapped_from_exercise_id: string | null; position: number; machine_location: MachineLocation | null; sets: { count: number }[] };
  if (current.exercise_id === exerciseId) return { mode: "replaced", previousExerciseId: exerciseId };
  const { data: next, error: nextError } = await db().from("exercises").select("id, has_floors").eq("id", exerciseId).maybeSingle();
  fail(nextError);
  if (!next) throw new Error("No such exercise.");
  const floors = next.has_floors ? await lastFloors([next.id]) : null;
  const floor = next.has_floors ? (floors?.get(next.id) ?? current.machine_location ?? FIRST_FLOOR) : null;

  if ((current.sets?.[0]?.count ?? 0) === 0) {
    const { error } = await db()
      .from("workout_exercises")
      .update({
        exercise_id: next.id,
        machine_location: floor,
        swapped_from_exercise_id: swappedFrom({ exerciseId: current.exercise_id, swappedFrom: current.swapped_from_exercise_id }, next.id),
      })
      .eq("id", workoutExerciseId);
    fail(error);
    refreshWorkout(we.workout_id);
    return { mode: "replaced", previousExerciseId: current.exercise_id };
  }

  await shiftPositions(we.workout_id, current.position);
  const { error } = await db().from("workout_exercises").insert({
    workout_id: we.workout_id,
    exercise_id: next.id,
    machine_location: floor,
    position: current.position + 1,
    prescribed_sets_min: current.prescribed_sets_min as number | null,
    prescribed_sets_max: current.prescribed_sets_max as number | null,
    prescribed_reps_min: current.prescribed_reps_min as number | null,
    prescribed_reps_max: current.prescribed_reps_max as number | null,
    prescribed_rir_min: current.prescribed_rir_min as number | null,
    prescribed_rir_max: current.prescribed_rir_max as number | null,
    prescribed_seconds_min: current.prescribed_seconds_min as number | null,
    prescribed_seconds_max: current.prescribed_seconds_max as number | null,
    prescribed_rest_seconds: current.prescribed_rest_seconds as number | null,
    prescribed_rpe: current.prescribed_rpe as string | null,
    warm_up_sets_min: current.warm_up_sets_min as number | null,
    warm_up_sets_max: current.warm_up_sets_max as number | null,
    notes: current.notes as string | null,
    swapped_from_exercise_id: current.swapped_from_exercise_id ?? current.exercise_id,
  });
  fail(error);
  refreshWorkout(we.workout_id);
  return { mode: "added" };
}

/** Make room after `position` by moving every later row down one. */
async function shiftPositions(workoutId: string, position: number): Promise<void> {
  const { data, error } = await db().from("workout_exercises").select("id, position").eq("workout_id", workoutId).gt("position", position).order("position", { ascending: false });
  fail(error);
  for (const r of data ?? []) {
    const { error: e } = await db().from("workout_exercises").update({ position: r.position + 1 }).eq("id", r.id);
    fail(e);
  }
}

/** Do Later (to the end), Move Up or Move Down. Positions are rewritten 1..n in the new order. */
export async function moveWorkoutExercise(workoutExerciseId: string, to: "up" | "down" | "end"): Promise<void> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { data, error } = await db().from("workout_exercises").select("id, position").eq("workout_id", we.workout_id).order("position");
  fail(error);
  const order = (data ?? []).map((r) => r.id);
  const i = order.indexOf(workoutExerciseId);
  if (i < 0) return;
  order.splice(i, 1);
  const j = to === "end" ? order.length : to === "up" ? Math.max(0, i - 1) : Math.min(order.length, i + 1);
  order.splice(j, 0, workoutExerciseId);
  const before = new Map((data ?? []).map((r) => [r.id, r.position]));
  for (const [k, id] of order.entries()) {
    if (before.get(id) === k + 1) continue;
    const { error: e } = await db().from("workout_exercises").update({ position: k + 1 }).eq("id", id);
    fail(e);
  }
  refreshWorkout(we.workout_id);
}

/** Take an exercise out of today's workout, with any sets logged on it. The template is untouched. */
export async function removeWorkoutExercise(workoutExerciseId: string): Promise<void> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { error } = await db().from("workout_exercises").delete().eq("id", workoutExerciseId);
  fail(error);
  refreshWorkout(we.workout_id);
}

export type SwapPick = { id: string; name: string; slug: string | null; kind: "Program sub" | "Same movement" | "Same muscle" };

/**
 * The swap carousel's picks, closest first: the exercise's alternates (a program's substitutions), then the other
 * versions of its movement you have done, then the most-done exercises in its muscle group. Exercises already in the
 * workout are left out.
 */
export async function getSwapPicks(workoutExerciseId: string): Promise<SwapPick[]> {
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { data: row, error } = await db()
    .from("workout_exercises")
    .select("exercise_id, exercises(id, movement, muscle_group_id)")
    .eq("id", workoutExerciseId)
    .single();
  fail(error);
  const cur = (row as unknown as { exercise_id: string; exercises: { id: string; movement: string | null; muscle_group_id: string | null } }).exercises;
  const { data: inWorkout } = await db().from("workout_exercises").select("exercise_id").eq("workout_id", we.workout_id);
  const skip = new Set((inWorkout ?? []).map((r) => r.exercise_id));

  const { data: alts } = await db()
    .from("exercise_alternates")
    .select("position, alternate:exercises!exercise_alternates_alternate_exercise_id_fkey(id, name, title, slug)")
    .eq("exercise_id", cur.id)
    .order("position");
  const family = cur.movement
    ? ((await db().from("exercises").select("id, name, title, slug").eq("movement", cur.movement).order("option_rank", { nullsFirst: false })).data ?? [])
    : [];
  const muscle = cur.muscle_group_id
    ? ((await db().from("exercises").select("id, name, title, slug, movement").eq("muscle_group_id", cur.muscle_group_id)).data ?? []).filter((e) => !cur.movement || e.movement !== cur.movement)
    : [];

  // how often each candidate has been done, so the ones you know come first
  const ids = [...new Set([...family, ...muscle].map((e) => e.id))];
  const done = new Map<string, number>();
  if (ids.length) {
    const { data: tops } = await db().from("v_workout_exercise_top_set").select("exercise_id").eq("user_id", userId()).in("exercise_id", ids).not("workout_completed_at", "is", null);
    for (const t of tops ?? []) if (t.exercise_id) done.set(t.exercise_id, (done.get(t.exercise_id) ?? 0) + 1);
  }

  const out: SwapPick[] = [];
  const seen = new Set<string>(skip);
  const add = (e: { id: string; name: string; title: string | null; slug: string | null }, kind: SwapPick["kind"]) => {
    if (seen.has(e.id)) return;
    seen.add(e.id);
    out.push({ id: e.id, name: e.title ?? e.name, slug: e.slug, kind });
  };
  for (const a of (alts ?? []) as unknown as { alternate: { id: string; name: string; title: string | null; slug: string | null } | null }[]) if (a.alternate) add(a.alternate, "Program sub");
  for (const e of family.filter((f) => done.has(f.id)).slice(0, 4)) add(e, "Same movement");
  for (const e of muscle.filter((m) => done.has(m.id)).sort((a, b) => (done.get(b.id) ?? 0) - (done.get(a.id) ?? 0)).slice(0, 4)) add(e, "Same muscle");
  return out;
}

export type LibraryPick = { id: string; name: string; slug: string | null; group: string | null };

/** Every exercise, for the swap sheet's See all search. */
export async function getSwapLibrary(): Promise<LibraryPick[]> {
  const { data, error } = await db().from("exercises").select("id, name, title, slug, muscle_groups(name)").order("name").limit(1000);
  fail(error);
  return ((data ?? []) as unknown as { id: string; name: string; title: string | null; slug: string | null; muscle_groups: { name: string } | null }[]).map((e) => ({
    id: e.id,
    name: e.title ?? e.name,
    slug: e.slug,
    group: e.muscle_groups?.name ?? null,
  }));
}

export async function setExerciseFloor(workoutExerciseId: string, floor: MachineLocation): Promise<void> {
  if (!FLOORS.some((f) => f.value === floor)) throw new Error("Unknown floor");
  const we = await ownedWorkoutExercise(workoutExerciseId);
  const { error } = await db().from("workout_exercises").update({ machine_location: floor }).eq("id", workoutExerciseId);
  fail(error);
  const { data: rows, error: rowsError } = await db()
    .from("workout_exercises")
    .select("id, exercises(has_floors), sets(count)")
    .eq("workout_id", we.workout_id);
  fail(rowsError);
  const followers = ((rows ?? []) as unknown as { id: string; exercises: { has_floors: boolean } | null; sets: { count: number }[] }[])
    .filter((r) => r.exercises?.has_floors && (r.sets?.[0]?.count ?? 0) === 0)
    .map((r) => r.id);
  if (followers.length) {
    const { error: followError } = await db().from("workout_exercises").update({ machine_location: floor }).in("id", followers);
    fail(followError);
  }
  refreshWorkout(we.workout_id);
}

// ------------------------------------------------------------
// Sets
// ------------------------------------------------------------

export type SetInput = {
  weight: number | null;
  reps: number | null;
  /** Time, incline (%), speed (km/h) and distance (km), for the measures that record them (migration 0027) */
  seconds?: number | null;
  incline?: number | null;
  speed?: number | null;
  distance?: number | null;
  isWarmUp: boolean;
  isDropSet: boolean;
  allowEmpty?: boolean;
};

const nonNegative = (v: number | null | undefined, max = Infinity) =>
  v != null && Number.isFinite(v) && v >= 0 && v <= max ? v : null;
const wholeNonNegative = (v: number | null | undefined) => (v != null && Number.isInteger(v) && v >= 0 ? v : null);

function cleanSet(input: SetInput) {
  const weight = nonNegative(input.weight);
  const reps = wholeNonNegative(input.reps);
  const seconds = wholeNonNegative(input.seconds);
  const incline = nonNegative(input.incline, 40);
  const speed = nonNegative(input.speed, 40);
  const distance = nonNegative(input.distance);
  if ([weight, reps, seconds, incline, speed, distance].every((v) => v == null) && !input.allowEmpty)
    throw new Error("Enter a weight or reps.");
  return { weight, reps, seconds, incline, speed, distance, is_warm_up: input.isWarmUp, is_drop_set: input.isDropSet && !input.isWarmUp };
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
  // The Weight string cannot say which sets were drop sets, so they keep their place
  const { data: before, error: beforeError } = await db()
    .from("sets")
    .select("is_drop_set")
    .eq("workout_exercise_id", workoutExerciseId)
    .order("set_number");
  fail(beforeError);
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
        is_drop_set: !s.isWarmUp && (before?.[i]?.is_drop_set ?? false),
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
  heatWindow: "rolling" | "week";
}): Promise<void> {
  const rest = Math.round(input.defaultRestSeconds);
  if (!Number.isFinite(rest) || rest < 0 || rest > 1800) throw new Error("Rest must be between 0 and 30 minutes.");
  const { error } = await db()
    .from("user_settings")
    .upsert({
      user_id: userId(),
      weight_unit: input.weightUnit === "kg" ? "kg" : "lbs",
      default_rest_seconds: rest,
      heat_window: input.heatWindow === "week" ? "week" : "rolling",
    });
  fail(error);
  revalidatePath("/", "layout");
}

// ------------------------------------------------------------
// Programs
// ------------------------------------------------------------

/** Follow a program, or stop following with null. A new program starts with the phase worked out, not set by hand. */
export async function followProgram(programId: string | null): Promise<void> {
  if (programId) {
    const { data, error } = await db().from("programs").select("id").eq("id", programId).maybeSingle();
    fail(error);
    if (!data) throw new Error("No such program.");
  }
  const { error } = await db()
    .from("user_settings")
    .upsert({ user_id: userId(), active_program_id: programId, program_phase_position: null });
  fail(error);
  revalidatePath("/", "layout");
}

/** Set the phase of the program you follow by hand, or hand it back to the app with null. */
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
