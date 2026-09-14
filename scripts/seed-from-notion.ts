/**
 * One-time Notion -> Supabase seed.
 *
 * Reads the four Notion workout databases (muscle groups, exercises,
 * workouts, sessions), maps them onto the new schema, and writes rows
 * via the Supabase service-role key. Idempotent: every table has a
 * temporary `_notion_id` column the script upserts on.
 *
 * Run with:
 *   bun run scripts/seed-from-notion.ts
 *   bun run seed:notion             (alias)
 *
 * Requires .env.local with NOTION_API_KEY, SUPABASE keys, and
 * SEED_USER_ID. See .env.local.example for the full list.
 *
 * The script logs every parse failure with the Notion page URL so the
 * source can be cleaned up and re-run.
 */

import { Client as NotionClient } from "@notionhq/client";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { loadSeedEnv } from "./lib/env";
import { parseRange, parseRestSeconds } from "./lib/parse-prescription";
import { exerciseSlug, parseExerciseName } from "./lib/exercise-name";
import { parseWeightCsv } from "./parse-weight-csv";

// ============================================================
// Notion field names. Edit these if your Notion DB uses different
// labels. Missing fields log a warning and the row is skipped or
// partially populated rather than throwing.
// ============================================================

const FIELDS = {
  muscleGroups: {
    name: "Name",
  },
  exercises: {
    name: "Name",
    muscleGroup: "Muscle Group",
    notes: "Notes",
    video: "YouTube",
    subOption1: "Sub Option 1",
    subOption2: "Sub Option 2",
  },
  workouts: {
    name: "Name",
    dateDone: "Date Done",
    program: "Program",
    tutorial: "Tutorial",
    estimatedMinutes: "Estimated Minutes",
    notes: "Notes",
  },
  sessions: {
    workout: "Workout",
    exercise: "Exercise",
    warmUp: "Warm Up",
    sets: "Sets",
    reps: "Reps",
    rest: "Rest",
    rpe: "RPE",
    weight: "Weight",
    notes: "Notes",
  },
} as const;

// ============================================================
// Notion property accessors. Pragmatic, tolerant of missing fields.
// ============================================================

type NotionText = { plain_text: string };

/** The subset of Notion property shapes this script reads. Tolerant of missing fields. */
type NotionProperty = {
  type: string;
  title?: NotionText[];
  rich_text?: NotionText[];
  date?: { start: string | null } | null;
  relation?: { id: string }[];
  url?: string | null;
  number?: number | null;
};

type AnyPage = {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty | undefined>;
};

function getTitle(page: AnyPage, prop: string): string {
  const p = page.properties?.[prop];
  if (!p || p.type !== "title") return "";
  return (p.title ?? []).map((t) => t.plain_text).join("").trim();
}

function getRichText(page: AnyPage, prop: string): string {
  const p = page.properties?.[prop];
  if (!p || p.type !== "rich_text") return "";
  return (p.rich_text ?? []).map((t) => t.plain_text).join("").trim();
}

function getRichTextOrNull(page: AnyPage, prop: string): string | null {
  const v = getRichText(page, prop);
  return v.length > 0 ? v : null;
}

function getDate(page: AnyPage, prop: string): string | null {
  const p = page.properties?.[prop];
  if (!p || p.type !== "date") return null;
  return p.date?.start ?? null;
}

function getRelation(page: AnyPage, prop: string): string[] {
  const p = page.properties?.[prop];
  if (!p || p.type !== "relation") return [];
  return (p.relation ?? []).map((r) => r.id);
}

function getUrl(page: AnyPage, prop: string): string | null {
  const p = page.properties?.[prop];
  if (!p) return null;
  if (p.type === "url") return p.url || null;
  if (p.type === "rich_text") {
    const text = (p.rich_text ?? []).map((t) => t.plain_text).join("").trim();
    return text || null;
  }
  return null;
}

function getNumber(page: AnyPage, prop: string): number | null {
  const p = page.properties?.[prop];
  if (!p || p.type !== "number") return null;
  return p.number ?? null;
}

async function resolveDataSourceId(
  notion: NotionClient,
  databaseId: string,
): Promise<string> {
  const db = await notion.databases.retrieve({ database_id: databaseId });
  const dataSources = (db as { data_sources?: { id: string }[] }).data_sources;
  if (!dataSources || dataSources.length === 0) {
    throw new Error(
      `Notion database ${databaseId} has no data sources. Verify the integration has access and the database ID is correct.`,
    );
  }
  return dataSources[0].id;
}

async function* paginateDatabase(notion: NotionClient, databaseId: string) {
  const dataSourceId = await resolveDataSourceId(notion, databaseId);
  let cursor: string | undefined;
  do {
    const res = await notion.dataSources.query({
      data_source_id: dataSourceId,
      start_cursor: cursor,
      page_size: 100,
    });
    for (const page of res.results) yield page as unknown as AnyPage;
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
}

// ============================================================
// Program name parsing. Frank's templates follow "Push P1", "Pull A",
// "Legs 2", etc. First word is the category, remainder is the variant.
// ============================================================

const CATEGORY_MAP: Record<string, string> = {
  push: "push",
  pull: "pull",
  legs: "legs",
  leg: "legs",
  arms: "arms",
  arm: "arms",
  "full": "full_body",
  "full_body": "full_body",
  fullbody: "full_body",
  cardio: "cardio",
  abs: "abs",
  core: "abs",
};

function inferProgramCategory(name: string): string | null {
  const lower = name.trim().toLowerCase();
  // try first word
  const firstWord = lower.split(/\s+/)[0];
  if (firstWord in CATEGORY_MAP) return CATEGORY_MAP[firstWord];
  // try "full body" two-word
  if (lower.startsWith("full body")) return "full_body";
  return null;
}

function extractVariant(name: string): string | null {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;
  // skip a "Body" word from "Full Body"
  if (parts[0].toLowerCase() === "full" && parts[1].toLowerCase() === "body") {
    return parts.slice(2).join(" ") || null;
  }
  return parts.slice(1).join(" ");
}

// ============================================================
// Verification report
// ============================================================

type ParseFailure = {
  notionPageId: string;
  notionUrl: string;
  exerciseName: string | null;
  weightCsv: string;
  errors: { setNumber: number; token: string; reason: string }[];
};

type Report = {
  rowCounts: Record<string, number>;
  exercisesEquipmentOther: { id: string; name: string }[];
  exercisesWithMachineLocation: {
    id: string;
    name: string;
    location: string;
  }[];
  weightParseFailures: ParseFailure[];
  notionFieldsWarnings: string[];
  templatesCategoryMissing: { id: string; name: string }[];
};

// ============================================================
// Main
// ============================================================

async function main() {
  const env = loadSeedEnv();

  const notion = new NotionClient({ auth: env.NOTION_API_KEY });
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const report: Report = {
    rowCounts: {},
    exercisesEquipmentOther: [],
    exercisesWithMachineLocation: [],
    weightParseFailures: [],
    notionFieldsWarnings: [],
    templatesCategoryMissing: [],
  };

  // ----------------------------------------------------------
  // 1. Muscle groups
  // ----------------------------------------------------------
  console.log("\n[1/8] Seeding muscle_groups");
  const muscleGroupMap = new Map<string, string>();
  let mgOrder = 0;
  for await (const page of paginateDatabase(notion, env.NOTION_MUSCLE_GROUPS_DB)) {
    const name = getTitle(page, FIELDS.muscleGroups.name);
    if (!name) {
      console.warn(`  skip: muscle group ${page.id} has no name`);
      continue;
    }
    const supabaseId = await upsertMuscleGroup(supabase, {
      notionId: page.id,
      name,
      displayOrder: mgOrder++,
    });
    if (supabaseId) muscleGroupMap.set(page.id, supabaseId);
  }
  console.log(`  done: ${muscleGroupMap.size} muscle groups`);

  // ----------------------------------------------------------
  // 2. Exercises
  // ----------------------------------------------------------
  console.log("\n[2/8] Seeding exercises");
  const exerciseMap = new Map<string, string>();
  const exercisePages = new Map<string, AnyPage>();
  const usedSlugs = new Set<string>();
  let exCount = 0;
  let otherCount = 0;
  let locationCount = 0;
  for await (const page of paginateDatabase(notion, env.NOTION_EXERCISES_DB)) {
    const rawName = getTitle(page, FIELDS.exercises.name);
    if (!rawName) {
      console.warn(`  skip: exercise ${page.id} has no name`);
      continue;
    }
    const info = parseExerciseName(rawName);
    const muscleGroupRel = getRelation(page, FIELDS.exercises.muscleGroup);
    const muscleGroupId = muscleGroupRel[0]
      ? (muscleGroupMap.get(muscleGroupRel[0]) ?? null)
      : null;
    let slug = exerciseSlug(rawName, info.machineLocation);
    if (usedSlugs.has(slug)) {
      let n = 2;
      while (usedSlugs.has(`${slug}-${n}`)) n++;
      slug = `${slug}-${n}`;
      report.notionFieldsWarnings.push(
        `duplicate exercise name "${info.name}" (${page.url ?? page.id}); slug set to ${slug}`,
      );
    }
    usedSlugs.add(slug);
    const supabaseId = await upsertExercise(supabase, {
      notionId: page.id,
      name: info.name,
      slug,
      muscleGroupId,
      equipmentType: info.equipmentType,
      machineLocation: info.machineLocation,
      notes: getRichTextOrNull(page, FIELDS.exercises.notes),
      videoUrl: getUrl(page, FIELDS.exercises.video),
    });
    if (!supabaseId) continue;
    exerciseMap.set(page.id, supabaseId);
    exercisePages.set(page.id, page);
    exCount++;
    if (info.equipmentType === "other") {
      otherCount++;
      report.exercisesEquipmentOther.push({ id: supabaseId, name: info.name });
    }
    if (info.machineLocation !== null) {
      locationCount++;
      report.exercisesWithMachineLocation.push({
        id: supabaseId,
        name: info.name,
        location: info.machineLocation,
      });
    }
  }
  console.log(
    `  done: ${exCount} exercises (${otherCount} equipment_type=other, ${locationCount} with machine_location)`,
  );

  // ----------------------------------------------------------
  // 3. Exercise alternates
  // ----------------------------------------------------------
  console.log("\n[3/8] Seeding exercise_alternates");
  let altCount = 0;
  for (const [notionId, page] of exercisePages) {
    const exerciseId = exerciseMap.get(notionId);
    if (!exerciseId) continue;
    const pairs: [number, string[]][] = [
      [1, getRelation(page, FIELDS.exercises.subOption1)],
      [2, getRelation(page, FIELDS.exercises.subOption2)],
    ];
    for (const [position, alts] of pairs) {
      const altNotionId = alts[0];
      if (!altNotionId) continue;
      const altId = exerciseMap.get(altNotionId);
      if (!altId || altId === exerciseId) continue;
      const { error } = await supabase.from("exercise_alternates").upsert(
        {
          exercise_id: exerciseId,
          alternate_exercise_id: altId,
          position,
        },
        { onConflict: "exercise_id,position" },
      );
      if (error) {
        console.error(`  upsert failed:`, error.message);
        continue;
      }
      altCount++;
    }
  }
  console.log(`  done: ${altCount} alternates`);

  // ----------------------------------------------------------
  // 4. Workouts table -> split into templates + instances
  // ----------------------------------------------------------
  console.log("\n[4/8] Pulling Notion Workouts");
  const allWorkoutPages: AnyPage[] = [];
  for await (const page of paginateDatabase(notion, env.NOTION_WORKOUTS_DB)) {
    allWorkoutPages.push(page);
  }
  const templates: AnyPage[] = [];
  const instances: AnyPage[] = [];
  for (const page of allWorkoutPages) {
    if (getDate(page, FIELDS.workouts.dateDone)) instances.push(page);
    else templates.push(page);
  }
  console.log(
    `  ${allWorkoutPages.length} total: ${templates.length} templates, ${instances.length} instances`,
  );

  // ----------------------------------------------------------
  // 5. Templates (from Notion template pages)
  // ----------------------------------------------------------
  console.log("\n[5/8] Seeding templates");
  const templateMap = new Map<string, string>();
  for (const page of templates) {
    const name = getTitle(page, FIELDS.workouts.name);
    if (!name) continue;
    const category = inferProgramCategory(name);
    const variant = extractVariant(name);
    const supabaseId = await upsertTemplate(supabase, {
      notionId: page.id,
      name,
      category,
      variant,
      tutorialUrl: getUrl(page, FIELDS.workouts.tutorial),
      estimatedMinutes: getNumber(page, FIELDS.workouts.estimatedMinutes),
      notes: getRichTextOrNull(page, FIELDS.workouts.notes),
    });
    if (!supabaseId) continue;
    templateMap.set(page.id, supabaseId);
    if (!category) {
      report.templatesCategoryMissing.push({ id: supabaseId, name });
    }
  }
  console.log(
    `  done: ${templateMap.size} templates (${report.templatesCategoryMissing.length} without category)`,
  );

  const templateNotionIds = new Set(templates.map((p) => p.id));
  const instanceNotionIds = new Set(instances.map((p) => p.id));

  // ----------------------------------------------------------
  // 6. Workouts (from instances)
  // ----------------------------------------------------------
  console.log("\n[6/8] Seeding workouts");
  const workoutMap = new Map<string, string>();
  for (const page of instances) {
    const dateDone = getDate(page, FIELDS.workouts.dateDone);
    const templateRel = getRelation(page, FIELDS.workouts.program);
    const templateId = templateRel[0]
      ? (templateMap.get(templateRel[0]) ?? null)
      : null;
    const supabaseId = await upsertWorkout(supabase, {
      notionId: page.id,
      userId: env.SEED_USER_ID,
      templateId,
      scheduledFor: dateDone,
      completedAt: dateDone ? `${dateDone}T00:00:00Z` : null,
      notes: getRichTextOrNull(page, FIELDS.workouts.notes),
    });
    if (!supabaseId) continue;
    workoutMap.set(page.id, supabaseId);
  }
  console.log(`  done: ${workoutMap.size} workouts`);

  // ----------------------------------------------------------
  // 7. Sessions: split into template_exercises and workout_exercises
  // ----------------------------------------------------------
  console.log("\n[7/8] Pulling Notion Sessions");
  const sessionPages: AnyPage[] = [];
  for await (const page of paginateDatabase(notion, env.NOTION_SESSIONS_DB)) {
    sessionPages.push(page);
  }
  console.log(`  ${sessionPages.length} total session rows`);

  const templateSessionsByParent = new Map<string, AnyPage[]>();
  const workoutSessionsByParent = new Map<string, AnyPage[]>();
  let noWorkoutRel = 0;
  let noExerciseRel = 0;
  let unknownParent = 0;
  for (const page of sessionPages) {
    const workoutRel = getRelation(page, FIELDS.sessions.workout);
    const exerciseRel = getRelation(page, FIELDS.sessions.exercise);
    if (workoutRel.length === 0) {
      noWorkoutRel++;
      continue;
    }
    if (exerciseRel.length === 0) {
      noExerciseRel++;
      continue;
    }
    const parentId = workoutRel[0];
    if (templateNotionIds.has(parentId)) {
      const arr = templateSessionsByParent.get(parentId) ?? [];
      arr.push(page);
      templateSessionsByParent.set(parentId, arr);
    } else if (instanceNotionIds.has(parentId)) {
      const arr = workoutSessionsByParent.get(parentId) ?? [];
      arr.push(page);
      workoutSessionsByParent.set(parentId, arr);
    } else {
      unknownParent++;
    }
  }
  console.log(
    `  routing: ${
      [...templateSessionsByParent.values()].reduce(
        (a, b) => a + b.length,
        0,
      )
    } -> template_exercises, ${
      [...workoutSessionsByParent.values()].reduce(
        (a, b) => a + b.length,
        0,
      )
    } -> workout_exercises (${noWorkoutRel} no workout rel, ${noExerciseRel} no exercise rel, ${unknownParent} parent not found)`,
  );

  // Template exercises
  console.log("  inserting template_exercises");
  let teCount = 0;
  for (const [parentNotionId, rows] of templateSessionsByParent) {
    const templateId = templateMap.get(parentNotionId);
    if (!templateId) continue;
    let pos = 1;
    for (const page of rows) {
      const exerciseRel = getRelation(page, FIELDS.sessions.exercise);
      const exerciseId = exerciseMap.get(exerciseRel[0]);
      if (!exerciseId) continue;
      const ok = await upsertTemplateExercise(supabase, {
        notionId: page.id,
        templateId,
        exerciseId,
        position: pos++,
        ...prescriptionFromSession(page),
      });
      if (ok) teCount++;
    }
  }
  console.log(`    done: ${teCount} template_exercises`);

  // Workout exercises + sets
  console.log("  inserting workout_exercises + sets");
  let weCount = 0;
  let setsTotal = 0;
  let setsSkippedEmptyWeight = 0;
  for (const [parentNotionId, rows] of workoutSessionsByParent) {
    const workoutId = workoutMap.get(parentNotionId);
    if (!workoutId) continue;
    let pos = 1;
    for (const page of rows) {
      const exerciseRel = getRelation(page, FIELDS.sessions.exercise);
      const exerciseId = exerciseMap.get(exerciseRel[0]);
      if (!exerciseId) continue;
      const prescription = prescriptionFromSession(page);
      const workoutExerciseId = await upsertWorkoutExercise(supabase, {
        notionId: page.id,
        workoutId,
        exerciseId,
        position: pos++,
        ...prescription,
      });
      if (!workoutExerciseId) continue;
      weCount++;

      const weightCsv = getRichText(page, FIELDS.sessions.weight);
      if (!weightCsv) {
        setsSkippedEmptyWeight++;
        continue;
      }
      const parsed = parseWeightCsv({
        weightCsv,
        warmUpMax: prescription.warmUpSetsMax,
        prescribedReps:
          prescription.prescribedRepsMin != null &&
          prescription.prescribedRepsMax != null
            ? {
                min: prescription.prescribedRepsMin,
                max: prescription.prescribedRepsMax,
              }
            : null,
      });

      if (parsed.errors.length > 0) {
        report.weightParseFailures.push({
          notionPageId: page.id,
          notionUrl: page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`,
          exerciseName: null,
          weightCsv,
          errors: parsed.errors,
        });
      }

      if (parsed.sets.length === 0) continue;

      // Replace existing sets for this workout_exercise so reruns don't
      // duplicate rows. Service role bypasses RLS.
      const { error: delErr } = await supabase
        .from("sets")
        .delete()
        .eq("workout_exercise_id", workoutExerciseId);
      if (delErr) {
        console.error(`    set delete failed:`, delErr.message);
        continue;
      }

      const rowsToInsert = parsed.sets.map((s) => ({
        workout_exercise_id: workoutExerciseId,
        set_number: s.setNumber,
        is_warm_up: s.isWarmUp,
        weight: s.weight,
        reps: s.reps,
        _notion_id: page.id,
      }));
      const { error: insErr } = await supabase.from("sets").insert(rowsToInsert);
      if (insErr) {
        console.error(`    set insert failed:`, insErr.message);
        continue;
      }
      setsTotal += rowsToInsert.length;
    }
  }
  console.log(
    `    done: ${weCount} workout_exercises, ${setsTotal} sets (${setsSkippedEmptyWeight} skipped empty Weight)`,
  );

  // ----------------------------------------------------------
  // 8. Verification report
  // ----------------------------------------------------------
  console.log("\n[8/8] Verification");
  const tables = [
    "muscle_groups",
    "exercises",
    "exercise_alternates",
    "templates",
    "template_exercises",
    "workouts",
    "workout_exercises",
    "sets",
  ];
  for (const t of tables) {
    const { count, error } = await supabase
      .from(t)
      .select("*", { count: "exact", head: true });
    if (error) {
      console.error(`  count(${t}) failed:`, error.message);
      continue;
    }
    report.rowCounts[t] = count ?? 0;
  }
  console.log("  row counts:", report.rowCounts);

  const reportPath = join(process.cwd(), "scripts", "seed-report.json");
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`\nReport written to ${reportPath}`);

  console.log("\nSummary:");
  console.log(`  exercises flagged equipment_type=other: ${report.exercisesEquipmentOther.length}`);
  console.log(`  exercises with machine_location set:   ${report.exercisesWithMachineLocation.length}`);
  console.log(`  Sessions rows with Weight parse errors: ${report.weightParseFailures.length}`);
  console.log(`  templates without inferred category:   ${report.templatesCategoryMissing.length}`);
}

// ============================================================
// Upserters
// ============================================================

function prescriptionFromSession(page: AnyPage) {
  const setsRange = parseRange(getRichText(page, FIELDS.sessions.sets));
  const repsRange = parseRange(getRichText(page, FIELDS.sessions.reps));
  const warmRange = parseRange(getRichText(page, FIELDS.sessions.warmUp));
  return {
    prescribedSetsMin: setsRange?.min ?? null,
    prescribedSetsMax: setsRange?.max ?? null,
    prescribedRepsMin: repsRange?.min ?? null,
    prescribedRepsMax: repsRange?.max ?? null,
    prescribedRestSeconds: parseRestSeconds(
      getRichText(page, FIELDS.sessions.rest),
    ),
    prescribedRpe: getRichTextOrNull(page, FIELDS.sessions.rpe),
    warmUpSetsMin: warmRange?.min ?? null,
    warmUpSetsMax: warmRange?.max ?? null,
    notes: getRichTextOrNull(page, FIELDS.sessions.notes),
  };
}

async function upsertMuscleGroup(
  sb: SupabaseClient,
  args: { notionId: string; name: string; displayOrder: number },
): Promise<string | null> {
  const { data, error } = await sb
    .from("muscle_groups")
    .upsert(
      {
        name: args.name,
        display_order: args.displayOrder,
        _notion_id: args.notionId,
      },
      { onConflict: "_notion_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error(`  muscle_group upsert failed (${args.name}):`, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function upsertExercise(
  sb: SupabaseClient,
  args: {
    notionId: string;
    name: string;
    slug: string;
    muscleGroupId: string | null;
    equipmentType: string;
    machineLocation: string | null;
    notes: string | null;
    videoUrl: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sb
    .from("exercises")
    .upsert(
      {
        name: args.name,
        slug: args.slug,
        muscle_group_id: args.muscleGroupId,
        equipment_type: args.equipmentType,
        machine_location: args.machineLocation,
        notes: args.notes,
        video_url: args.videoUrl,
        _notion_id: args.notionId,
      },
      { onConflict: "_notion_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error(`  exercise upsert failed (${args.name}):`, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function upsertTemplate(
  sb: SupabaseClient,
  args: {
    notionId: string;
    name: string;
    category: string | null;
    variant: string | null;
    tutorialUrl: string | null;
    estimatedMinutes: number | null;
    notes: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sb
    .from("templates")
    .upsert(
      {
        name: args.name,
        category: args.category,
        variant: args.variant,
        tutorial_url: args.tutorialUrl,
        estimated_minutes: args.estimatedMinutes,
        notes: args.notes,
        _notion_id: args.notionId,
      },
      { onConflict: "_notion_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error(`  template upsert failed (${args.name}):`, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function upsertWorkout(
  sb: SupabaseClient,
  args: {
    notionId: string;
    userId: string;
    templateId: string | null;
    scheduledFor: string | null;
    completedAt: string | null;
    notes: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sb
    .from("workouts")
    .upsert(
      {
        user_id: args.userId,
        template_id: args.templateId,
        scheduled_for: args.scheduledFor,
        completed_at: args.completedAt,
        notes: args.notes,
        _notion_id: args.notionId,
      },
      { onConflict: "_notion_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error(`  workout upsert failed:`, error.message);
    return null;
  }
  return data?.id ?? null;
}

async function upsertTemplateExercise(
  sb: SupabaseClient,
  args: {
    notionId: string;
    templateId: string;
    exerciseId: string;
    position: number;
    prescribedSetsMin: number | null;
    prescribedSetsMax: number | null;
    prescribedRepsMin: number | null;
    prescribedRepsMax: number | null;
    prescribedRestSeconds: number | null;
    prescribedRpe: string | null;
    warmUpSetsMin: number | null;
    warmUpSetsMax: number | null;
    notes: string | null;
  },
): Promise<boolean> {
  const { error } = await sb.from("template_exercises").upsert(
    {
      template_id: args.templateId,
      exercise_id: args.exerciseId,
      position: args.position,
      prescribed_sets_min: args.prescribedSetsMin,
      prescribed_sets_max: args.prescribedSetsMax,
      prescribed_reps_min: args.prescribedRepsMin,
      prescribed_reps_max: args.prescribedRepsMax,
      prescribed_rest_seconds: args.prescribedRestSeconds,
      prescribed_rpe: args.prescribedRpe,
      warm_up_sets_min: args.warmUpSetsMin,
      warm_up_sets_max: args.warmUpSetsMax,
      notes: args.notes,
      _notion_id: args.notionId,
    },
    { onConflict: "_notion_id" },
  );
  if (error) {
    console.error(`  template_exercise upsert failed:`, error.message);
    return false;
  }
  return true;
}

async function upsertWorkoutExercise(
  sb: SupabaseClient,
  args: {
    notionId: string;
    workoutId: string;
    exerciseId: string;
    position: number;
    prescribedSetsMin: number | null;
    prescribedSetsMax: number | null;
    prescribedRepsMin: number | null;
    prescribedRepsMax: number | null;
    prescribedRestSeconds: number | null;
    prescribedRpe: string | null;
    warmUpSetsMin: number | null;
    warmUpSetsMax: number | null;
    notes: string | null;
  },
): Promise<string | null> {
  const { data, error } = await sb
    .from("workout_exercises")
    .upsert(
      {
        workout_id: args.workoutId,
        exercise_id: args.exerciseId,
        position: args.position,
        prescribed_sets_min: args.prescribedSetsMin,
        prescribed_sets_max: args.prescribedSetsMax,
        prescribed_reps_min: args.prescribedRepsMin,
        prescribed_reps_max: args.prescribedRepsMax,
        prescribed_rest_seconds: args.prescribedRestSeconds,
        prescribed_rpe: args.prescribedRpe,
        warm_up_sets_min: args.warmUpSetsMin,
        warm_up_sets_max: args.warmUpSetsMax,
        notes: args.notes,
        _notion_id: args.notionId,
      },
      { onConflict: "_notion_id" },
    )
    .select("id")
    .single();
  if (error) {
    console.error(`  workout_exercise upsert failed:`, error.message);
    return null;
  }
  return data?.id ?? null;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
