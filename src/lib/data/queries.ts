import "server-only";
import type { ExerciseSession } from "@/lib/workout/exercise-metrics";
import { db, selectAll, timeZone, userId } from "@/lib/supabase/server";
import { gridBounds, workoutDay, type YearMonth } from "@/lib/workout/dates";
import type { EquipmentType, WeightUnit } from "@/lib/workout/format";
import { floorKey, type MachineLocation } from "@/lib/workout/machine-location";
import type { MovementOption } from "@/lib/workout/movements";
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

const EXERCISE_FIELDS = "id, name, slug, equipment_type, has_floors, video_url, notes, muscle_group_id, muscle_groups(name), movement, option_equipment, option_technique";

export type Settings = {
  weight_unit: WeightUnit;
  default_rest_seconds: number;
};

export async function getSettings(): Promise<Settings> {
  const row = check(
    await db()
      .from("user_settings")
      .select("weight_unit, default_rest_seconds")
      .eq("user_id", userId())
      .maybeSingle(),
  );
  return row ?? { weight_unit: "lbs", default_rest_seconds: 180 };
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
  return getWorkoutsBetween(from, to);
}

/** Workouts whose calendar day falls from `from` to `to`, both YYYY-MM-DD and inclusive. */
export async function getWorkoutsBetween(from: string, to: string): Promise<WorkoutListItem[]> {
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

/** The day templates you pick from freestyle: the Notion ones, not program weeks. */
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
  slug: string | null;
  equipment_type: EquipmentType;
  has_floors: boolean;
  video_url: string | null;
  notes: string | null;
  muscle_group_id: string | null;
  muscle_groups: { name: string } | null;
  movement: string | null;
  option_equipment: string | null;
  option_technique: string | null;
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
  is_drop_set: boolean;
  weight: number | null;
  reps: number | null;
  seconds: number | null;
  rpe: number | null;
  notes: string | null;
  completed_at: string | null;
};

export type WorkoutExerciseRow = PrescribedRow & { machine_location: MachineLocation | null; sets: SetRow[] };

export type LastTime = { completedAt: string; sets: Pick<SetRow, "set_number" | "is_warm_up" | "is_drop_set" | "weight" | "reps">[] };

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
  /** The most recent other completed session of each exercise on each floor, keyed by floorKey. */
  lastTime: Record<string, LastTime>;
  movementOptions: Record<string, MovementOption[]>;
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
  const movementOptions = await getMovementOptions(exercises.map((e) => e.exercises.movement));
  // every way of doing each movement, so switching equipment shows that row's last time straight away
  const lastTime = await getLastTimes(
    [...new Set([...exercises.map((e) => e.exercises.id), ...Object.values(movementOptions).flat().map((o) => o.id)])],
    id,
  );
  return { ...rest, day: workoutDay(rest, timeZone()) ?? "", exercises, lastTime, movementOptions };
}

/** The rows of each movement, standard way first within each equipment. */
export async function getMovementOptions(movements: (string | null)[]): Promise<Record<string, MovementOption[]>> {
  const wanted = [...new Set(movements.filter((m): m is string => !!m))];
  if (wanted.length === 0) return {};
  const found = rows(
    await db()
      .from("exercises")
      .select("id, slug, name, has_floors, movement, option_equipment, option_technique")
      .in("movement", wanted)
      .order("option_equipment")
      .order("option_technique", { nullsFirst: true }),
  );
  const out: Record<string, MovementOption[]> = {};
  for (const e of found) {
    if (!e.movement || !e.option_equipment) continue;
    (out[e.movement] ??= []).push({ id: e.id, slug: e.slug, name: e.name, equipment: e.option_equipment, technique: e.option_technique, hasFloors: e.has_floors });
  }
  return out;
}

async function getLastTimes(exerciseIds: string[], excludeWorkoutId: string): Promise<Record<string, LastTime>> {
  if (exerciseIds.length === 0) return {};
  const tops = rows(
    await db()
      .from("v_workout_exercise_top_set")
      .select("exercise_id, workout_id, workout_exercise_id, workout_completed_at, machine_location")
      .eq("user_id", userId())
      .in("exercise_id", exerciseIds)
      .neq("workout_id", excludeWorkoutId)
      .not("workout_completed_at", "is", null)
      .order("workout_completed_at", { ascending: false })
      .limit(exerciseIds.length * 20),
  );
  const latest = new Map<string, { weId: string; at: string }>();
  for (const t of tops) {
    if (!t.exercise_id || !t.workout_exercise_id || !t.workout_completed_at) continue;
    const key = floorKey(t.exercise_id, t.machine_location);
    if (!latest.has(key)) latest.set(key, { weId: t.workout_exercise_id, at: t.workout_completed_at });
  }
  if (latest.size === 0) return {};
  const sets = rows(
    await db()
      .from("sets")
      .select("workout_exercise_id, set_number, is_warm_up, is_drop_set, weight, reps")
      .in(
        "workout_exercise_id",
        [...latest.values()].map((v) => v.weId),
      )
      .order("set_number"),
  );
  const out: Record<string, LastTime> = {};
  for (const [key, { weId, at }] of latest) {
    out[key] = {
      completedAt: at,
      sets: sets
        .filter((s) => s.workout_exercise_id === weId)
        .map((s) => ({ set_number: s.set_number, is_warm_up: s.is_warm_up, is_drop_set: s.is_drop_set, weight: s.weight, reps: s.reps })),
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
      .select("exercise_id, workout_id, weight, reps, workout_completed_at, machine_location")
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
      floor: r.machine_location,
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

/** Every completed workout's sets of one exercise, oldest first: the exercise sheet's history and charts. */
export async function getExerciseSessions(exerciseId: string): Promise<ExerciseSession[]> {
  const found = check(
    await db()
      .from("workout_exercises")
      .select("machine_location, workouts!inner(id, user_id, completed_at, templates(name)), sets(set_number, is_warm_up, is_drop_set, weight, reps, seconds)")
      .eq("exercise_id", exerciseId)
      .eq("workouts.user_id", userId())
      .not("workouts.completed_at", "is", null),
  ) as unknown as {
    machine_location: MachineLocation | null;
    workouts: { id: string; completed_at: string; templates: { name: string } | null };
    sets: { set_number: number; is_warm_up: boolean; is_drop_set: boolean; weight: number | string | null; reps: number | null; seconds: number | null }[];
  }[];
  return found
    .map((r) => ({
      workoutId: r.workouts.id,
      name: r.workouts.templates?.name ?? "Workout",
      completedAt: r.workouts.completed_at,
      floor: r.machine_location,
      sets: r.sets
        .map((s) => ({ number: s.set_number, warmUp: s.is_warm_up, dropSet: s.is_drop_set, weight: s.weight == null ? null : Number(s.weight), reps: s.reps, seconds: s.seconds }))
        .sort((a, b) => a.number - b.number),
    }))
    .filter((s) => s.sets.length > 0)
    .sort((a, b) => a.completedAt.localeCompare(b.completedAt));
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

// ------------------------------------------------------------
// Programs
// ------------------------------------------------------------

export type ProgramSummary = {
  id: string;
  name: string;
  kind: "recovery" | "training";
  description: string | null;
  phaseCount: number;
  templateCount: number;
};

/** Every program in the library, recovery first. */
export async function listPrograms(): Promise<ProgramSummary[]> {
  const found = rows(
    await db().from("programs").select("id, name, kind, description, program_phases(count), templates(count)").eq("kind", "training").order("name"),
  ) as unknown as (Omit<ProgramSummary, "phaseCount" | "templateCount"> & {
    program_phases: { count: number }[];
    templates: { count: number }[];
  })[];
  return found
    .map(({ program_phases, templates, ...p }) => ({
      ...p,
      phaseCount: program_phases?.[0]?.count ?? 0,
      templateCount: templates?.[0]?.count ?? 0,
    }))
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "recovery" ? -1 : 1));
}

export type ProgramTemplateRow = {
  id: string;
  name: string;
  category: string | null;
  variant: string | null;
  needs_signoff: string | null;
  exerciseCount: number;
};

export type ProgramPhaseRow = {
  id: string;
  position: number;
  label: string;
  block: string | null;
  week_from: number;
  week_to: number | null;
  load_pct: number | null;
  gate: string | null;
  guidance: { heading: string; items: string[] }[];
  flag: string | null;
  templates: ProgramTemplateRow[];
};

export type ProgramDetail = {
  id: string;
  name: string;
  kind: "recovery" | "training";
  description: string | null;
  citation: string | null;
  authority_notes: string | null;
  phases: ProgramPhaseRow[];
  recovery: { id: string; label: string; injuryDate: string } | null;
  clearances: {
    effectiveFrom: string;
    createdAt: string;
    kind: import("@/lib/recovery/types").ClearanceKind;
    valuePct: number | null;
    valueText: string | null;
    phaseId: string | null;
    source: import("@/lib/recovery/types").ClearanceSource;
    voidedAt: string | null;
  }[];
  completions: { templateId: string; completedAt: string }[];
  following: boolean;
  chosenPhasePosition: number | null;
};

/** One program with its phases, each phase's templates in order, and your history against it. */
export async function getProgram(id: string): Promise<ProgramDetail | null> {
  const program = check(
    await db().from("programs").select("id, name, kind, description, citation, authority_notes").eq("id", id).maybeSingle(),
  );
  if (!program) return null;

  const phases = rows(
    await db()
      .from("program_phases")
      .select("id, position, label, block, week_from, week_to, load_pct, gate, guidance, flag")
      .eq("program_id", id)
      .order("position"),
  );
  const phaseIds = phases.map((p) => p.id);
  const links = phaseIds.length
    ? ((await selectAll((a, b) =>
        db()
          .from("template_phases")
          .select("phase_id, position, templates(id, name, category, variant, needs_signoff, template_exercises(count))")
          .in("phase_id", phaseIds)
          .range(a, b),
      )) as unknown as {
        phase_id: string;
        position: number | null;
        templates: Omit<ProgramTemplateRow, "exerciseCount"> & { template_exercises: { count: number }[] };
      }[])
    : [];

  const byPhase = new Map<string, { position: number; t: ProgramTemplateRow }[]>();
  for (const l of links) {
    if (!l.templates) continue;
    const { template_exercises, ...t } = l.templates;
    const list = byPhase.get(l.phase_id) ?? [];
    list.push({ position: l.position ?? 0, t: { ...t, exerciseCount: template_exercises?.[0]?.count ?? 0 } });
    byPhase.set(l.phase_id, list);
  }

  const [recovery, settings] = await Promise.all([
    db().from("recoveries").select("id, label, injury_date").eq("user_id", userId()).eq("program_id", id).maybeSingle(),
    db().from("user_settings").select("active_program_id, program_phase_position").eq("user_id", userId()).maybeSingle(),
  ]);
  const rec = check(recovery);
  const set = check(settings);

  const clearances = rec
    ? rows(
        await db()
          .from("clearances")
          .select("effective_from, created_at, kind, value_pct, value_text, phase_id, source, voided_at")
          .eq("recovery_id", rec.id),
      ).map((c) => ({
        effectiveFrom: c.effective_from,
        createdAt: c.created_at,
        kind: c.kind,
        valuePct: c.value_pct,
        valueText: c.value_text,
        phaseId: c.phase_id,
        source: c.source,
        voidedAt: c.voided_at,
      }))
    : [];

  const templateIds = [...new Set(links.map((l) => l.templates?.id).filter((x): x is string => Boolean(x)))];
  const completions = templateIds.length
    ? (
        (await selectAll((a, b) =>
          db()
            .from("workouts")
            .select("template_id, completed_at")
            .eq("user_id", userId())
            .in("template_id", templateIds)
            .not("completed_at", "is", null)
            .range(a, b),
        )) as { template_id: string; completed_at: string }[]
      ).map((w) => ({ templateId: w.template_id, completedAt: w.completed_at }))
    : [];

  const following = set?.active_program_id === id;
  return {
    ...(program as Omit<ProgramDetail, "phases" | "recovery" | "clearances" | "completions" | "following" | "chosenPhasePosition">),
    phases: phases.map((p) => ({
      ...(p as unknown as Omit<ProgramPhaseRow, "templates">),
      templates: (byPhase.get(p.id) ?? []).sort((a, b) => a.position - b.position).map((x) => x.t),
    })),
    recovery: rec ? { id: rec.id, label: rec.label, injuryDate: rec.injury_date } : null,
    clearances,
    completions,
    following,
    chosenPhasePosition: following ? (set?.program_phase_position ?? null) : null,
  };
}

/** The program you are following, if any. */
export async function getActiveProgramId(): Promise<string | null> {
  const row = check(await db().from("user_settings").select("active_program_id").eq("user_id", userId()).maybeSingle());
  return row?.active_program_id ?? null;
}

export type ProgramTemplateTile = TemplateSummary & {
  needs_signoff: string | null;
  /** Earliest phase position the template is valid in, for ordering. */
  firstPhase: number;
  /** Week range it covers, from its first phase to its last. */
  weekFrom: number;
  weekTo: number | null;
};

/** A program's templates once each, ordered by the first phase they appear in, clinic before outside sources. */
export async function listProgramTemplates(programId: string): Promise<ProgramTemplateTile[]> {
  const found = rows(
    await db()
      .from("templates")
      .select(
        "id, name, category, variant, estimated_minutes, needs_signoff, template_exercises(count), template_phases(program_phases(position, week_from, week_to))",
      )
      .eq("program_id", programId),
  ) as unknown as (Omit<ProgramTemplateTile, "exerciseCount" | "firstPhase" | "weekFrom" | "weekTo"> & {
    template_exercises: { count: number }[];
    template_phases: { program_phases: { position: number; week_from: number; week_to: number | null } | null }[];
  })[];
  return found
    .map(({ template_exercises, template_phases, ...t }) => {
      const ph = template_phases.map((x) => x.program_phases).filter((x): x is NonNullable<typeof x> => x !== null);
      const first = ph.reduce((a, b) => (b.position < a.position ? b : a), ph[0]);
      const last = ph.reduce((a, b) => (b.position > a.position ? b : a), ph[0]);
      return {
        ...t,
        exerciseCount: template_exercises?.[0]?.count ?? 0,
        firstPhase: first?.position ?? 0,
        weekFrom: first?.week_from ?? 0,
        weekTo: last?.week_to ?? null,
      };
    })
    .sort(
      (a, b) =>
        Number(a.needs_signoff !== null) - Number(b.needs_signoff !== null) ||
        a.firstPhase - b.firstPhase ||
        a.name.localeCompare(b.name),
    );
}

export type TemplateContext = {
  program: { id: string; name: string; kind: "recovery" | "training" } | null;
  source: { citation: string; url: string | null } | null;
  needsSignoff: string | null;
  phases: { position: number; label: string; week_from: number; week_to: number | null; block: string | null }[];
};

/** Where a template sits: its program, the phases it runs in, its source, and what still needs sign-off. */
export async function getTemplateContext(id: string): Promise<TemplateContext> {
  const t = check(
    await db()
      .from("templates")
      .select(
        "needs_signoff, programs(id, name, kind), sources(citation, url), template_phases(program_phases(position, label, week_from, week_to, block))",
      )
      .eq("id", id)
      .maybeSingle(),
  ) as unknown as {
    needs_signoff: string | null;
    programs: TemplateContext["program"];
    sources: TemplateContext["source"];
    template_phases: { program_phases: TemplateContext["phases"][number] | null }[];
  } | null;
  if (!t) return { program: null, source: null, needsSignoff: null, phases: [] };
  return {
    program: t.programs,
    source: t.sources,
    needsSignoff: t.needs_signoff,
    phases: t.template_phases
      .map((x) => x.program_phases)
      .filter((x): x is TemplateContext["phases"][number] => x !== null)
      .sort((a, b) => a.position - b.position),
  };
}
