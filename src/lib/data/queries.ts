import "server-only";
import { db, selectAll, timeZone, userId } from "@/lib/supabase/server";
import { gridBounds, workoutDay, type YearMonth } from "@/lib/workout/dates";
import type { EquipmentType, WeightUnit } from "@/lib/workout/format";
import type { TopSet } from "@/lib/workout/progress";

/** Server-side reads for the screens. Every per-user query filters by the app's one user. */

function check<T>(res: { data: T; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

/** A list query's rows, never null. */
function rows<T>(res: { data: T[] | null; error: { message: string } | null }): T[] {
  return check(res) ?? [];
}

const EXERCISE_FIELDS = "id, name, equipment_type, machine_location, video_url, notes, muscle_group_id, muscle_groups(name)";

export type Settings = {
  weight_unit: WeightUnit;
  default_rest_seconds: number;
  default_machine_location: "upstairs" | "downstairs" | null;
};

export async function getSettings(): Promise<Settings> {
  const row = check(
    await db()
      .from("user_settings")
      .select("weight_unit, default_rest_seconds, default_machine_location")
      .eq("user_id", userId())
      .maybeSingle(),
  );
  return row ?? { weight_unit: "lbs", default_rest_seconds: 180, default_machine_location: null };
}

// ------------------------------------------------------------
// Calendar and history
// ------------------------------------------------------------

export type WorkoutListItem = {
  id: string;
  day: string;
  name: string;
  category: string | null;
  templateId: string | null;
  startedAt: string | null;
  completedAt: string | null;
  exerciseCount: number;
};

type WorkoutRow = {
  id: string;
  template_id: string | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  templates: { name: string; category: string | null } | null;
  workout_exercises: { count: number }[];
};

const WORKOUT_LIST_FIELDS =
  "id, template_id, scheduled_for, started_at, completed_at, created_at, templates(name, category), workout_exercises(count)";

function toListItem(w: WorkoutRow, tz: string): WorkoutListItem {
  return {
    id: w.id,
    day: workoutDay(w, tz) ?? "",
    name: w.templates?.name ?? "Workout",
    category: w.templates?.category ?? null,
    templateId: w.template_id,
    startedAt: w.started_at,
    completedAt: w.completed_at,
    exerciseCount: w.workout_exercises?.[0]?.count ?? 0,
  };
}

/** Workouts whose day falls inside the month grid (neighbouring days included). */
export async function getMonthWorkouts(ym: YearMonth): Promise<WorkoutListItem[]> {
  const { from, to } = gridBounds(ym);
  const tz = timeZone();
  // Pad the instant window by a day either side; the day is settled in the zone below.
  const fromTs = new Date(Date.parse(from) - 86400000).toISOString();
  const toTs = new Date(Date.parse(to) + 2 * 86400000).toISOString();
  const found = check(
    await db()
      .from("workouts")
      .select(WORKOUT_LIST_FIELDS)
      .eq("user_id", userId())
      .or(
        [
          `and(scheduled_for.gte.${from},scheduled_for.lte.${to})`,
          `and(scheduled_for.is.null,completed_at.gte.${fromTs},completed_at.lt.${toTs})`,
          `and(scheduled_for.is.null,completed_at.is.null,started_at.gte.${fromTs},started_at.lt.${toTs})`,
        ].join(","),
      ),
  ) as unknown as WorkoutRow[];
  return found
    .map((w) => toListItem(w, tz))
    .filter((w) => w.day >= from && w.day <= to)
    .sort((a, b) => (a.completedAt ?? a.startedAt ?? "").localeCompare(b.completedAt ?? b.startedAt ?? ""));
}

export async function getHistory(templateId?: string | null): Promise<WorkoutListItem[]> {
  const tz = timeZone();
  const found = (await selectAll((a, b) => {
    let q = db()
      .from("workouts")
      .select(WORKOUT_LIST_FIELDS)
      .eq("user_id", userId())
      .not("completed_at", "is", null);
    if (templateId) q = q.eq("template_id", templateId);
    return q.order("completed_at", { ascending: false }).range(a, b);
  })) as unknown as WorkoutRow[];
  return found.map((w) => toListItem(w, tz));
}

export async function getLastCompleted(): Promise<WorkoutListItem | null> {
  const found = check(
    await db()
      .from("workouts")
      .select(WORKOUT_LIST_FIELDS)
      .eq("user_id", userId())
      .not("completed_at", "is", null)
      .order("completed_at", { ascending: false })
      .limit(1),
  ) as unknown as WorkoutRow[];
  return found[0] ? toListItem(found[0], timeZone()) : null;
}

/** A workout that was started and never completed or discarded. */
export async function getInProgress(): Promise<WorkoutListItem | null> {
  const found = check(
    await db()
      .from("workouts")
      .select(WORKOUT_LIST_FIELDS)
      .eq("user_id", userId())
      .not("started_at", "is", null)
      .is("completed_at", null)
      .order("started_at", { ascending: false })
      .limit(1),
  ) as unknown as WorkoutRow[];
  return found[0] ? toListItem(found[0], timeZone()) : null;
}

// ------------------------------------------------------------
// Templates
// ------------------------------------------------------------

export type TemplateSummary = {
  id: string;
  name: string;
  category: string | null;
  variant: string | null;
  estimated_minutes: number | null;
  exerciseCount: number;
};

/** The day templates you pick from freestyle: the Notion ones, not programme weeks. */
export async function listTemplates(): Promise<TemplateSummary[]> {
  const found = check(
    await db()
      .from("templates")
      .select("id, name, category, variant, estimated_minutes, template_exercises(count)")
      .is("program_id", null)
      .order("name"),
  ) as unknown as (Omit<TemplateSummary, "exerciseCount"> & { template_exercises: { count: number }[] })[];
  return found.map(({ template_exercises, ...t }) => ({ ...t, exerciseCount: template_exercises?.[0]?.count ?? 0 }));
}

export type LibraryExercise = {
  id: string;
  name: string;
  equipment_type: EquipmentType;
  machine_location: "upstairs" | "downstairs" | null;
  video_url: string | null;
  notes: string | null;
  muscle_group_id: string | null;
  muscle_groups: { name: string } | null;
};

export type PrescribedRow = {
  id: string;
  position: number;
  prescribed_sets_min: number | null;
  prescribed_sets_max: number | null;
  prescribed_reps_min: number | null;
  prescribed_reps_max: number | null;
  prescribed_rir_min: number | null;
  prescribed_rir_max: number | null;
  prescribed_seconds_min: number | null;
  prescribed_seconds_max: number | null;
  prescribed_rest_seconds: number | null;
  prescribed_rpe: string | null;
  warm_up_sets_min: number | null;
  warm_up_sets_max: number | null;
  notes: string | null;
  exercises: LibraryExercise;
};

export type TemplateDetail = {
  id: string;
  name: string;
  category: string | null;
  variant: string | null;
  tutorial_url: string | null;
  estimated_minutes: number | null;
  notes: string | null;
  rows: (PrescribedRow & { variant: string | null })[];
};

export async function getTemplate(id: string): Promise<TemplateDetail | null> {
  const t = check(
    await db()
      .from("templates")
      .select(`id, name, category, variant, tutorial_url, estimated_minutes, notes, template_exercises(*, exercises(${EXERCISE_FIELDS}))`)
      .eq("id", id)
      .maybeSingle(),
  ) as unknown as (Omit<TemplateDetail, "rows"> & { template_exercises: TemplateDetail["rows"] }) | null;
  if (!t) return null;
  const { template_exercises, ...rest } = t;
  return { ...rest, rows: [...template_exercises].sort((a, b) => a.position - b.position) };
}

// ------------------------------------------------------------
// One workout
// ------------------------------------------------------------

export type SetRow = {
  id: string;
  set_number: number;
  is_warm_up: boolean;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  rpe: number | null;
  notes: string | null;
  completed_at: string | null;
};

export type WorkoutExerciseRow = PrescribedRow & { sets: SetRow[] };

export type LastTime = { completedAt: string; sets: Pick<SetRow, "set_number" | "is_warm_up" | "weight" | "reps">[] };

export type WorkoutDetail = {
  id: string;
  template_id: string | null;
  machine_location: "upstairs" | "downstairs" | null;
  scheduled_for: string | null;
  started_at: string | null;
  completed_at: string | null;
  perceived_effort: number | null;
  notes: string | null;
  created_at: string;
  day: string;
  templates: { name: string; category: string | null } | null;
  exercises: WorkoutExerciseRow[];
  /** The most recent other completed session of each exercise, keyed by exercise id. */
  lastTime: Record<string, LastTime>;
};

export async function getWorkout(id: string): Promise<WorkoutDetail | null> {
  const w = check(
    await db()
      .from("workouts")
      .select(
        `id, template_id, machine_location, scheduled_for, started_at, completed_at, perceived_effort, notes, created_at, templates(name, category), workout_exercises(*, exercises(${EXERCISE_FIELDS}), sets(*))`,
      )
      .eq("id", id)
      .eq("user_id", userId())
      .maybeSingle(),
  ) as unknown as (Omit<WorkoutDetail, "exercises" | "lastTime" | "day"> & { workout_exercises: WorkoutExerciseRow[] }) | null;
  if (!w) return null;
  const { workout_exercises, ...rest } = w;
  const exercises = [...workout_exercises]
    .sort((a, b) => a.position - b.position)
    .map((we) => ({ ...we, sets: [...we.sets].sort((a, b) => a.set_number - b.set_number) }));
  const lastTime = await getLastTimes(
    exercises.map((e) => e.exercises.id),
    id,
  );
  return { ...rest, day: workoutDay(rest, timeZone()) ?? "", exercises, lastTime };
}

async function getLastTimes(exerciseIds: string[], excludeWorkoutId: string): Promise<Record<string, LastTime>> {
  if (exerciseIds.length === 0) return {};
  const tops = rows(
    await db()
      .from("v_workout_exercise_top_set")
      .select("exercise_id, workout_id, workout_exercise_id, workout_completed_at")
      .eq("user_id", userId())
      .in("exercise_id", exerciseIds)
      .neq("workout_id", excludeWorkoutId)
      .not("workout_completed_at", "is", null)
      .order("workout_completed_at", { ascending: false })
      .limit(exerciseIds.length * 10),
  );
  const latest = new Map<string, { weId: string; at: string }>();
  for (const t of tops) {
    if (t.exercise_id && t.workout_exercise_id && t.workout_completed_at && !latest.has(t.exercise_id)) {
      latest.set(t.exercise_id, { weId: t.workout_exercise_id, at: t.workout_completed_at });
    }
  }
  if (latest.size === 0) return {};
  const sets = rows(
    await db()
      .from("sets")
      .select("workout_exercise_id, set_number, is_warm_up, weight, reps")
      .in(
        "workout_exercise_id",
        [...latest.values()].map((v) => v.weId),
      )
      .order("set_number"),
  );
  const out: Record<string, LastTime> = {};
  for (const [exerciseId, { weId, at }] of latest) {
    out[exerciseId] = {
      completedAt: at,
      sets: sets
        .filter((s) => s.workout_exercise_id === weId)
        .map((s) => ({ set_number: s.set_number, is_warm_up: s.is_warm_up, weight: s.weight, reps: s.reps })),
    };
  }
  return out;
}

// ------------------------------------------------------------
// Library and progress
// ------------------------------------------------------------

export async function listMuscleGroups(): Promise<{ id: string; name: string }[]> {
  return rows(await db().from("muscle_groups").select("id, name, display_order").order("display_order", { nullsFirst: false }).order("name"));
}

export async function listExercises(): Promise<LibraryExercise[]> {
  return (await selectAll((a, b) =>
    db().from("exercises").select(EXERCISE_FIELDS).order("name").range(a, b),
  )) as unknown as LibraryExercise[];
}

/** Every completed top set, the input for badges, charts and PRs. */
export async function getTopSets(exerciseId?: string): Promise<TopSet[]> {
  const found = await selectAll((a, b) => {
    let q = db()
      .from("v_workout_exercise_top_set")
      .select("exercise_id, workout_id, weight, reps, workout_completed_at")
      .eq("user_id", userId())
      .not("workout_completed_at", "is", null);
    if (exerciseId) q = q.eq("exercise_id", exerciseId);
    return q.order("workout_completed_at").range(a, b);
  });
  return found
    .filter((r) => r.exercise_id && r.workout_id && r.weight != null && r.reps != null && r.workout_completed_at)
    .map((r) => ({
      exercise_id: r.exercise_id!,
      workout_id: r.workout_id!,
      weight: Number(r.weight),
      reps: r.reps!,
      completed_at: r.workout_completed_at!,
    }));
}

export type ExerciseDetail = LibraryExercise & {
  alternates: { position: number; exercise: { id: string; name: string } }[];
};

export async function getExercise(id: string): Promise<ExerciseDetail | null> {
  const e = check(
    await db().from("exercises").select(EXERCISE_FIELDS).eq("id", id).maybeSingle(),
  ) as unknown as LibraryExercise | null;
  if (!e) return null;
  const alts = check(
    await db()
      .from("exercise_alternates")
      .select("position, alternate:exercises!exercise_alternates_alternate_exercise_id_fkey(id, name)")
      .eq("exercise_id", id)
      .order("position"),
  ) as unknown as { position: number; alternate: { id: string; name: string } | null }[];
  return {
    ...e,
    alternates: alts.filter((a) => a.alternate).map((a) => ({ position: a.position, exercise: a.alternate! })),
  };
}

export async function getWeeklyWorkouts(sinceWeek: string): Promise<{ week: string; count: number }[]> {
  const weeks = rows(
    await db()
      .from("v_user_weekly_workouts")
      .select("week_start, workout_count")
      .eq("user_id", userId())
      .gte("week_start", sinceWeek)
      .order("week_start"),
  );
  return weeks.filter((r) => r.week_start).map((r) => ({ week: r.week_start!, count: Number(r.workout_count ?? 0) }));
}

export async function getWeeklyMuscleSets(sinceWeek: string): Promise<{ week: string; muscleGroupId: string; count: number }[]> {
  const weeks = rows(
    await db()
      .from("v_muscle_group_weekly_sets")
      .select("week_start, muscle_group_id, set_count")
      .eq("user_id", userId())
      .gte("week_start", sinceWeek)
      .order("week_start"),
  );
  return weeks
    .filter((r) => r.week_start && r.muscle_group_id)
    .map((r) => ({ week: r.week_start!, muscleGroupId: r.muscle_group_id!, count: Number(r.set_count ?? 0) }));
}
