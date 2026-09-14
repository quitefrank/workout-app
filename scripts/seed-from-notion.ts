/**
 * One-time Notion -> Supabase seed.
 *
 * Reads the four Notion workout databases (muscle groups, exercises,
 * workouts, sessions), maps them onto the new schema, and writes rows
 * via the Supabase service-role key. Idempotent: every table has a
 * temporary `_notion_id` column the script upserts on.
 *
 * Templates are not Notion rows. The 18 day templates are Notion page
 * templates whose prescription lives in a button automation the API
 * cannot read, so each one is rebuilt from the most recent Workouts row
 * carrying its canonical title (see scripts/lib/template-name.ts).
 * Template rows use the synthetic key `template:<name>` in `_notion_id`.
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
import {
  TEMPLATE_NAMES,
  extractVariant,
  inferTemplateCategory,
} from "./lib/template-name";
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
    video: "Example",
    subOption1: "Sub Option 1",
    subOption2: "Sub Option 2",
  },
  workouts: {
    name: "Workout",
    dateDone: "Date Done",
    tutorial: "Tutorial",
  },
  sessions: {
    workout: "Workout",
    // Older rows link to their workout through a second relation.
    workoutLegacy: "Workouts",
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
};

type AnyPage = {
  id: string;
  url?: string;
  properties: Record<string, NotionProperty | undefined>;
};

function plainText(items: NotionText[] | undefined): string {
  return (items ?? []).map((t) => t.plain_text).join("").trim();
}

function getTitle(page: AnyPage, prop: string): string {
  const p = page.properties?.[prop];
  if (!p || p.type !== "title") return "";
  return plainText(p.title);
}

function getRichText(page: AnyPage, prop: string): string {
  const p = page.properties?.[prop];
  if (!p || p.type !== "rich_text") return "";
  return plainText(p.rich_text);
}

/** Sessions text fields use a bare "-" for empty. Treat it as null. */
function isEmptyText(value: string): boolean {
  return value.length === 0 || value === "-";
}

function getRichTextOrNull(page: AnyPage, prop: string): string | null {
  const v = getRichText(page, prop);
  return isEmptyText(v) ? null : v;
}

function getDate(page: AnyPage, prop: string): string | null {
  const p = page.properties?.[prop];
  if (!p || p.type !== "date") return null;
  return p.date?.start ?? null;
}

/** Notion date starts are "YYYY-MM-DD" or a full ISO datetime. */
function dateOnly(start: string): string {
  return start.slice(0, 10);
}

function completedAtFrom(start: string | null): string | null {
  if (!start) return null;
  return start.includes("T") ? start : `${start}T00:00:00Z`;
}

function notionUrl(page: AnyPage): string {
  return page.url ?? `https://www.notion.so/${page.id.replace(/-/g, "")}`;
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
    const text = plainText(p.rich_text);
    return text || null;
  }
  return null;
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
      sorts: [{ timestamp: "created_time", direction: "ascending" }],
    });
    for (const page of res.results) yield page as unknown as AnyPage;
    cursor = res.has_more ? (res.next_cursor ?? undefined) : undefined;
  } while (cursor);
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

type TemplateSource = {
  name: string;
  instanceDate: string;
  instanceUrl: string;
  exerciseCount: number;
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
  /** Canonical template names with no Workouts row carrying that title. */
  templatesWithoutInstance: string[];
  /** The instance each template's prescription was rebuilt from. */
  templateSources: TemplateSource[];
  /** Workouts whose title matched no canonical template name. */
  workoutsWithoutTemplate: number;
  /** Sessions rows that only linked through the older "Workouts" relation. */
  sessionsViaLegacyRelation: number;
  /** Sessions rows with neither relation set. */
  sessionsWithoutParent: number;
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
    templatesWithoutInstance: [],
    templateSources: [],
    workoutsWithoutTemplate: 0,
    sessionsViaLegacyRelation: 0,
    sessionsWithoutParent: 0,
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
  const usedSlugs = new Map<string, { name: string; url: string }>();
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
    const base = exerciseSlug(rawName, info.machineLocation);
    if (!base) {
      console.warn(`  skip: exercise "${rawName}" (${page.url ?? page.id}) has no slug-able characters`);
      continue;
    }
    let slug = base;
    const other = usedSlugs.get(base);
    if (other) {
      let n = 2;
      while (usedSlugs.has(`${base}-${n}`)) n++;
      slug = `${base}-${n}`;
      report.notionFieldsWarnings.push(
        `slug collision: "${info.name}" (${page.url ?? page.id}) and "${other.name}" (${other.url}) both normalise to "${base}"; wrote "${slug}"`,
      );
    }
    usedSlugs.set(slug, { name: info.name, url: page.url ?? page.id });
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
  // 4. Workouts table. Every row is a dated instance. The 18 day
  // templates are Notion page templates whose prescription lives in a
  // button automation the API cannot read, so each template is rebuilt
  // from the most recent instance carrying its exact (trimmed) title.
  // ----------------------------------------------------------
  console.log("\n[4/8] Pulling Notion Workouts");
  const instances: AnyPage[] = [];
  for await (const page of paginateDatabase(notion, env.NOTION_WORKOUTS_DB)) {
    instances.push(page);
  }
  const canonicalNames = new Set<string>(TEMPLATE_NAMES);
  const sourceInstanceByName = new Map<string, AnyPage>();
  for (const page of instances) {
    const title = getTitle(page, FIELDS.workouts.name);
    if (!canonicalNames.has(title)) continue;
    const dateDone = getDate(page, FIELDS.workouts.dateDone);
    if (!dateDone) continue;
    const current = sourceInstanceByName.get(title);
    const currentDate = current
      ? getDate(current, FIELDS.workouts.dateDone)
      : null;
    // Strict greater-than keeps the first encountered on a tie. Pages
    // arrive in created-time order.
    if (!current || (currentDate !== null && dateDone > currentDate)) {
      sourceInstanceByName.set(title, page);
    }
  }
  console.log(
    `  ${instances.length} instances, ${sourceInstanceByName.size}/${TEMPLATE_NAMES.length} canonical templates have a source instance`,
  );

  // ----------------------------------------------------------
  // 5. Templates (one per canonical name, from its latest instance)
  // ----------------------------------------------------------
  console.log("\n[5/8] Seeding templates");
  /** canonical name -> Supabase templates.id */
  const templateMap = new Map<string, string>();
  /** source instance Notion page id -> the template it feeds */
  const templateSourceByInstance = new Map<
    string,
    { templateId: string; name: string; source: TemplateSource }
  >();
  for (const name of TEMPLATE_NAMES) {
    const source = sourceInstanceByName.get(name) ?? null;
    const category = inferTemplateCategory(name);
    const variant = extractVariant(name);
    const supabaseId = await upsertTemplate(supabase, {
      notionId: `template:${name}`,
      name,
      category,
      variant,
      tutorialUrl: source ? getUrl(source, FIELDS.workouts.tutorial) : null,
    });
    if (!supabaseId) continue;
    templateMap.set(name, supabaseId);
    if (!category) {
      report.templatesCategoryMissing.push({ id: supabaseId, name });
    }
    if (!source) {
      report.templatesWithoutInstance.push(name);
      continue;
    }
    const sourceDate = getDate(source, FIELDS.workouts.dateDone);
    const entry: TemplateSource = {
      name,
      instanceDate: sourceDate ? dateOnly(sourceDate) : "",
      instanceUrl: notionUrl(source),
      exerciseCount: 0,
    };
    report.templateSources.push(entry);
    templateSourceByInstance.set(source.id, {
      templateId: supabaseId,
      name,
      source: entry,
    });
  }
  console.log(
    `  done: ${templateMap.size} templates (${report.templatesWithoutInstance.length} without a source instance)`,
  );

  const instanceNotionIds = new Set(instances.map((p) => p.id));

  // ----------------------------------------------------------
  // 6. Workouts (every instance)
  // ----------------------------------------------------------
  console.log("\n[6/8] Seeding workouts");
  const workoutMap = new Map<string, string>();
  for (const page of instances) {
    const dateDone = getDate(page, FIELDS.workouts.dateDone);
    const title = getTitle(page, FIELDS.workouts.name);
    const templateId = templateMap.get(title) ?? null;
    if (!templateId) report.workoutsWithoutTemplate++;
    const supabaseId = await upsertWorkout(supabase, {
      notionId: page.id,
      userId: env.SEED_USER_ID,
      templateId,
      scheduledFor: dateDone ? dateOnly(dateDone) : null,
      completedAt: completedAtFrom(dateDone),
      notes: null,
    });
    if (!supabaseId) continue;
    workoutMap.set(page.id, supabaseId);
  }
  console.log(
    `  done: ${workoutMap.size} workouts (${report.workoutsWithoutTemplate} without a template)`,
  );

  // ----------------------------------------------------------
  // 7. Sessions. Every parent is an instance, so every row becomes a
  // workout_exercises row plus its sets. Rows whose parent is the source
  // instance of a template also become that template's
  // template_exercises rows.
  // ----------------------------------------------------------
  console.log("\n[7/8] Pulling Notion Sessions");
  const sessionPages: AnyPage[] = [];
  for await (const page of paginateDatabase(notion, env.NOTION_SESSIONS_DB)) {
    sessionPages.push(page);
  }
  console.log(`  ${sessionPages.length} total session rows`);

  const sessionsByParent = new Map<string, AnyPage[]>();
  let noExerciseRel = 0;
  let unknownParent = 0;
  for (const page of sessionPages) {
    let parentId: string | undefined = getRelation(
      page,
      FIELDS.sessions.workout,
    )[0];
    if (!parentId) {
      parentId = getRelation(page, FIELDS.sessions.workoutLegacy)[0];
      if (parentId) report.sessionsViaLegacyRelation++;
    }
    if (!parentId) {
      report.sessionsWithoutParent++;
      continue;
    }
    const exerciseRel = getRelation(page, FIELDS.sessions.exercise);
    if (exerciseRel.length === 0) {
      noExerciseRel++;
      continue;
    }
    if (!instanceNotionIds.has(parentId)) {
      unknownParent++;
      continue;
    }
    const arr = sessionsByParent.get(parentId) ?? [];
    arr.push(page);
    sessionsByParent.set(parentId, arr);
  }
  const routed = [...sessionsByParent.values()].reduce(
    (a, b) => a + b.length,
    0,
  );
  console.log(
    `  routing: ${routed} -> workout_exercises (${report.sessionsViaLegacyRelation} via legacy "Workouts" relation, ${report.sessionsWithoutParent} no parent, ${noExerciseRel} no exercise rel, ${unknownParent} parent not found)`,
  );

  console.log("  inserting workout_exercises, template_exercises, sets");
  let weCount = 0;
  let teCount = 0;
  let setsTotal = 0;
  let setsSkippedEmptyWeight = 0;
  let unknownExercise = 0;
  for (const [parentNotionId, rows] of sessionsByParent) {
    const workoutId = workoutMap.get(parentNotionId);
    if (!workoutId) continue;
    const templateSource = templateSourceByInstance.get(parentNotionId);
    let pos = 1;
    for (const page of rows) {
      const exerciseRel = getRelation(page, FIELDS.sessions.exercise);
      const exerciseId = exerciseMap.get(exerciseRel[0]);
      if (!exerciseId) {
        unknownExercise++;
        continue;
      }
      const prescription = prescriptionFromSession(page);
      const position = pos++;

      if (templateSource) {
        const ok = await upsertTemplateExercise(supabase, {
          notionId: `template:${templateSource.name}:${page.id}`,
          templateId: templateSource.templateId,
          exerciseId,
          position,
          ...prescription,
        });
        if (ok) {
          teCount++;
          templateSource.source.exerciseCount++;
        }
      }

      const workoutExerciseId = await upsertWorkoutExercise(supabase, {
        notionId: page.id,
        workoutId,
        exerciseId,
        position,
        ...prescription,
      });
      if (!workoutExerciseId) continue;
      weCount++;

      const weightCsv = getRichText(page, FIELDS.sessions.weight);
      if (isEmptyText(weightCsv)) {
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
          notionUrl: notionUrl(page),
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
    `    done: ${weCount} workout_exercises, ${teCount} template_exercises, ${setsTotal} sets (${setsSkippedEmptyWeight} skipped empty Weight, ${unknownExercise} skipped unknown exercise)`,
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
  console.log(`  templates without a source instance:   ${report.templatesWithoutInstance.length}`);
  for (const name of report.templatesWithoutInstance) {
    console.log(`    - ${name}`);
  }
  console.log(`  template sources (latest instance per canonical name):`);
  for (const s of report.templateSources) {
    console.log(
      `    - ${s.name.padEnd(14)} ${s.instanceDate}  ${s.exerciseCount} exercises`,
    );
  }
  console.log(`  workouts without a template:           ${report.workoutsWithoutTemplate}`);
  console.log(`  sessions via legacy "Workouts" rel:    ${report.sessionsViaLegacyRelation}`);
  console.log(`  sessions with no parent workout:       ${report.sessionsWithoutParent}`);
  console.log(`  Notion field warnings:                 ${report.notionFieldsWarnings.length}`);
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
    /** Synthetic key, `template:<canonical name>`; there is no Notion page. */
    notionId: string;
    name: string;
    category: string | null;
    variant: string | null;
    tutorialUrl: string | null;
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
