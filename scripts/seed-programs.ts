/**
 * Load every programme JSON under scripts/data/programs/ (except the
 * example) into Supabase. One program row, one program_phases row per
 * week (block name in `block`), one template per day per week, ordered
 * inside the phase by template_phases.position.
 *
 *   bun run seed:programs [path.json ...]
 *
 * Idempotent. Rows this seed owns are keyed by _notion_id values
 * prefixed "program:" and are cleared and rewritten each run. Exercises
 * are matched to the library by slug; unknown ones are inserted unrated
 * (no authoring inputs), which the recovery rules report as unrated.
 * The Notion-derived templates ("template:" keys) and the Achilles ones
 * ("achilles:" keys) are never touched.
 *
 * Every JSON is validated and every dose parsed before the first write,
 * so a bad file fails the run with nothing changed.
 */

import { createClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAchillesSeedEnv } from "./lib/env";
import { exerciseSlug, parseExerciseName } from "./lib/exercise-name";
import { inferTemplateCategory } from "./lib/template-name";
import { parseRange, parseRestSeconds } from "./lib/parse-prescription";
import { parseDose } from "../src/lib/recovery/dose";
import { validateProgramJson, type ProgramJson } from "./data/programs/schema";

type Report = {
  programs: { name: string; weeks: number; templates: number; templateExercises: number }[];
  /** Inserted with the equipment type the name implies; "other" means hand-fix. */
  exercisesInserted: { slug: string; equipmentType: string }[];
  exercisesMatched: string[];
  /** Filled during pre-flight; the run stops before any write when non-empty. */
  rejectedDoses: { program: string; block: string; week: number; day: string; name: string; dose: string }[];
  alternatesWritten: number;
  /** Slots holding a Notion sub-option (or another programme's alternate) that differs from this programme's; left as they were. */
  alternatesKeptExisting: { program: string; exercise: string; position: number; existing: string; wanted: string }[];
  /** The same exercise listed with a different substitution in a later week; the first one wins. */
  alternateConflicts: { program: string; exercise: string; position: number; kept: string; ignored: string }[];
  staleTemplatesDeleted: number;
  stalePhasesDeleted: number;
  rowCounts: Record<string, number>;
};

type Loaded = { file: string; program: ProgramJson };

/** One substitution slot per (programme, exercise slug, position), first occurrence wins. */
type AlternateSlot = { exerciseSlug: string; exerciseName: string; position: number; alternateSlug: string; alternateName: string };

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

function programFiles(): string[] {
  const args = process.argv.slice(2);
  if (args.length) return args;
  const dir = fileURLToPath(new URL("./data/programs/", import.meta.url));
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "example.json")
    .sort()
    .map((f) => dir + f);
}

function templateKey(program: ProgramJson, block: string, week: number, day: string): string {
  return `program:${program.name}:${block}:${week}:${day}`;
}

/** Read, validate and dose-check every file. Fails before any write. */
function preflight(files: string[], report: Report): Loaded[] {
  const loaded: Loaded[] = [];
  const seenNames = new Map<string, string>();
  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      fail(`${basename(file)}: ${e instanceof Error ? e.message : String(e)}`);
    }
    let program: ProgramJson;
    try {
      program = validateProgramJson(raw);
    } catch (e) {
      fail(`${basename(file)}: ${e instanceof Error ? e.message : String(e)}`);
    }
    const dup = seenNames.get(program.name);
    if (dup) fail(`${basename(file)}: programme "${program.name}" is also in ${basename(dup)}`);
    seenNames.set(program.name, file);

    for (const block of program.blocks) {
      for (const week of block.weeks) {
        for (const day of week.days) {
          for (const ex of day.exercises) {
            if (!parseDose(ex.dose)) {
              report.rejectedDoses.push({ program: program.name, block: block.name, week: week.week, day: day.name, name: ex.name, dose: ex.dose });
            }
          }
        }
      }
    }
    loaded.push({ file, program });
  }
  if (report.rejectedDoses.length > 0) {
    console.error(`${report.rejectedDoses.length} doses do not parse; nothing written`);
    for (const r of report.rejectedDoses) {
      console.error(`  ${r.program} / ${r.block} / week ${r.week} / ${r.day} / ${r.name}: ${JSON.stringify(r.dose)}`);
    }
    process.exit(1);
  }
  return loaded;
}

/** Every distinct exercise and substitution name across the programmes, keyed by slug, first spelling wins. */
function collectNames(loaded: Loaded[]): Map<string, string> {
  const names = new Map<string, string>();
  const add = (name: string | null) => {
    if (!name) return;
    const slug = exerciseSlug(name, null);
    if (!names.has(slug)) names.set(slug, name);
  };
  for (const { program } of loaded) {
    for (const block of program.blocks) for (const week of block.weeks) for (const day of week.days) {
      for (const ex of day.exercises) {
        add(ex.name);
        add(ex.sub1);
        add(ex.sub2);
      }
    }
  }
  return names;
}

/** The substitution slots one programme wants, one per (exercise, position). */
function collectAlternates(program: ProgramJson, report: Report): AlternateSlot[] {
  const slots = new Map<string, AlternateSlot>();
  for (const block of program.blocks) for (const week of block.weeks) for (const day of week.days) {
    for (const ex of day.exercises) {
      const slug = exerciseSlug(ex.name, null);
      for (const [i, sub] of [ex.sub1, ex.sub2].entries()) {
        if (!sub) continue;
        const position = i + 1;
        const alternateSlug = exerciseSlug(sub, null);
        if (alternateSlug === slug) continue;
        const id = `${slug}:${position}`;
        const existing = slots.get(id);
        if (!existing) {
          slots.set(id, { exerciseSlug: slug, exerciseName: ex.name, position, alternateSlug, alternateName: sub });
        } else if (existing.alternateSlug !== alternateSlug) {
          const already = report.alternateConflicts.some(
            (c) => c.program === program.name && c.exercise === slug && c.position === position && c.ignored === alternateSlug,
          );
          if (!already) report.alternateConflicts.push({ program: program.name, exercise: slug, position, kept: existing.alternateSlug, ignored: alternateSlug });
        }
      }
    }
  }
  return [...slots.values()];
}

async function main() {
  const env = loadAchillesSeedEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const report: Report = {
    programs: [],
    exercisesInserted: [],
    exercisesMatched: [],
    rejectedDoses: [],
    alternatesWritten: 0,
    alternatesKeptExisting: [],
    alternateConflicts: [],
    staleTemplatesDeleted: 0,
    stalePhasesDeleted: 0,
    rowCounts: {},
  };

  // 0. Pre-flight: files, shape, doses, library present.
  console.log("\n[0/5] pre-flight");
  const files = programFiles();
  if (files.length === 0) fail("no programme JSON found under scripts/data/programs/ (the example is skipped)");
  const loaded = preflight(files, report);
  const { count: mgCount, error: mgErr } = await sb.from("muscle_groups").select("*", { count: "exact", head: true });
  if (mgErr) fail(`muscle_groups count failed: ${mgErr.message}`);
  if (!mgCount) fail("muscle_groups is empty. Run the Notion seed first.");
  for (const { file, program } of loaded) {
    const weeks = program.blocks.reduce((n, b) => n + b.weeks.length, 0);
    console.log(`  ${basename(file)}: ${program.name} (${program.blocks.length} blocks, ${weeks} weeks)`);
  }

  // 1. Exercises: match by slug, insert the rest with the equipment
  // type the name implies, no muscle group, no authoring inputs.
  console.log("\n[1/5] exercises");
  const exerciseId = new Map<string, string>();
  for (const [slug, name] of collectNames(loaded)) {
    const { data: existing, error: lookupErr } = await sb.from("exercises").select("id").eq("slug", slug).maybeSingle();
    if (lookupErr) fail(`exercise lookup failed (${slug}): ${lookupErr.message}`);
    if (existing) {
      exerciseId.set(slug, existing.id);
      report.exercisesMatched.push(slug);
      continue;
    }
    const equipmentType = parseExerciseName(name).equipmentType;
    const { data, error } = await sb
      .from("exercises")
      .insert({ name, slug, equipment_type: equipmentType, notes: null })
      .select("id")
      .single();
    if (error) fail(`exercise insert failed (${slug}): ${error.message}`);
    exerciseId.set(slug, data.id);
    report.exercisesInserted.push({ slug, equipmentType });
  }
  console.log(`  ${report.exercisesMatched.length} matched the library, ${report.exercisesInserted.length} inserted`);

  // 2. Alternates. Each programme's rows carry
  // "program:<programme>:<slug>:<position>" in _notion_id and are
  // corrected in place when the JSON changes. A slot holding a library
  // row's Notion sub-option, or another programme's alternate, is left
  // as it is and reported with what it holds and what was wanted.
  console.log("\n[2/5] alternates");
  for (const { program } of loaded) {
    const owner = `program:${program.name}:`;
    for (const a of collectAlternates(program, report)) {
      const ownId = exerciseId.get(a.exerciseSlug);
      const altId = exerciseId.get(a.alternateSlug);
      if (!ownId) fail(`no id for ${a.exerciseSlug} after the exercises step`);
      if (!altId) fail(`no id for ${a.alternateSlug} after the exercises step`);
      const key = `${owner}${a.exerciseSlug}:${a.position}`;
      const notes = `Substitution from ${program.name}`;
      const wanted = { exercise_id: ownId, alternate_exercise_id: altId, position: a.position, notes, _notion_id: key };
      const { error } = await sb
        .from("exercise_alternates")
        .upsert(wanted, { onConflict: "exercise_id,position", ignoreDuplicates: true });
      if (error) fail(`alternate upsert failed (${a.exerciseSlug} -> ${a.alternateSlug}): ${error.message}`);
      const { data: slot, error: slotErr } = await sb
        .from("exercise_alternates")
        .select("id,alternate_exercise_id,notes,_notion_id")
        .eq("exercise_id", ownId)
        .eq("position", a.position)
        .maybeSingle();
      if (slotErr) fail(`alternate read-back failed (${a.exerciseSlug} position ${a.position}): ${slotErr.message}`);
      if (!slot) fail(`alternate slot missing after upsert (${a.exerciseSlug} position ${a.position})`);
      const seedOwned = typeof slot._notion_id === "string" && slot._notion_id.startsWith(owner);
      const sameAlternate = slot.alternate_exercise_id === altId;
      if (!seedOwned && !sameAlternate) {
        const { data: existingAlt, error: existingErr } = await sb
          .from("exercises")
          .select("slug")
          .eq("id", slot.alternate_exercise_id)
          .maybeSingle();
        if (existingErr) fail(`existing alternate lookup failed (${a.exerciseSlug} position ${a.position}): ${existingErr.message}`);
        report.alternatesKeptExisting.push({
          program: program.name,
          exercise: a.exerciseSlug,
          position: a.position,
          existing: existingAlt?.slug ?? slot.alternate_exercise_id,
          wanted: a.alternateSlug,
        });
        continue;
      }
      // Seed-owned and drifted: bring the row to what the JSON says. A
      // row someone else wrote that already names the same alternate is
      // left with its own key.
      if (seedOwned && (!sameAlternate || slot.notes !== notes || slot._notion_id !== key)) {
        const { error: updErr } = await sb
          .from("exercise_alternates")
          .update({ alternate_exercise_id: altId, notes, _notion_id: key })
          .eq("id", slot.id);
        if (updErr) fail(`alternate update failed (${a.exerciseSlug} position ${a.position}): ${updErr.message}`);
      }
      report.alternatesWritten++;
    }
  }
  console.log(`  ${report.alternatesWritten} alternates in place (${report.alternatesKeptExisting.length} slots kept their existing alternate, ${report.alternateConflicts.length} conflicts)`);

  // 3. Programs, phases and templates.
  console.log("\n[3/5] programs, phases, templates");
  for (const { program } of loaded) {
    const { data: prog, error: progErr } = await sb
      .from("programs")
      .upsert(
        { name: program.name, kind: "training", description: program.description, citation: program.citation, authority_notes: null, source_id: null },
        { onConflict: "name" },
      )
      .select("id")
      .single();
    if (progErr) fail(`program upsert failed (${program.name}): ${progErr.message}`);
    const programId = prog.id as string;

    let templates = 0;
    let templateExercises = 0;
    let position = 0;
    const keysWritten = new Set<string>();
    for (const block of program.blocks) {
      for (const week of block.weeks) {
        position++;
        const { data: phase, error: phErr } = await sb
          .from("program_phases")
          .upsert(
            {
              program_id: programId,
              position,
              label: `Week ${week.week}, ${block.name}`,
              block: block.name,
              week_from: week.week - 1,
              week_to: week.week,
              load_pct: null,
              gate: null,
              guidance: [],
              flag: null,
              flag_source_id: null,
            },
            { onConflict: "program_id,position" },
          )
          .select("id")
          .single();
        if (phErr) fail(`phase upsert failed (${program.name} week ${week.week}): ${phErr.message}`);
        const phaseId = phase.id as string;

        for (const [dayIndex, day] of week.days.entries()) {
          const key = templateKey(program, block.name, week.week, day.name);
          keysWritten.add(key);
          const { data: tpl, error: tErr } = await sb
            .from("templates")
            .upsert(
              {
                name: `${day.name}, Week ${week.week} (${block.name})`,
                category: inferTemplateCategory(day.name),
                variant: `W${week.week}`,
                notes: null,
                program_id: programId,
                _notion_id: key,
              },
              { onConflict: "_notion_id" },
            )
            .select("id")
            .single();
          if (tErr) fail(`template upsert failed (${key}): ${tErr.message}`);
          const templateId = tpl.id as string;
          templates++;

          const { error: clearErr } = await sb.from("template_exercises").delete().eq("template_id", templateId).like("_notion_id", "program:%");
          if (clearErr) fail(`template_exercises clear failed (${key}): ${clearErr.message}`);

          const rows = [];
          let pos = 0;
          for (const ex of day.exercises) {
            const d = parseDose(ex.dose);
            if (!d) fail(`dose rejected after pre-flight (${key}: ${ex.name} ${JSON.stringify(ex.dose)})`);
            pos++;
            const exId = exerciseId.get(exerciseSlug(ex.name, null));
            if (!exId) fail(`no id for ${ex.name} after the exercises step`);
            const warm = parseRange(ex.warmUp ?? "");
            rows.push({
              template_id: templateId,
              exercise_id: exId,
              position: pos,
              prescribed_sets_min: d.sets.min,
              prescribed_sets_max: d.sets.max,
              prescribed_reps_min: d.reps?.min ?? null,
              prescribed_reps_max: d.reps?.max ?? null,
              prescribed_rir_min: d.rir?.min ?? null,
              prescribed_rir_max: d.rir?.max ?? null,
              prescribed_seconds_min: d.seconds?.min ?? null,
              prescribed_seconds_max: d.seconds?.max ?? null,
              prescribed_rest_seconds: parseRestSeconds((ex.rest ?? "").replace("~", "")),
              prescribed_rpe: ex.rpe,
              warm_up_sets_min: warm?.min ?? null,
              warm_up_sets_max: warm?.max ?? null,
              notes: [ex.notes, d.modifier].filter(Boolean).join(" ") || null,
              _notion_id: `${key}:${pos}`,
            });
          }
          if (rows.length) {
            const { error: insErr } = await sb.from("template_exercises").insert(rows);
            if (insErr) fail(`template_exercises insert failed (${key}): ${insErr.message}`);
            templateExercises += rows.length;
          }

          const { error: tpClear } = await sb.from("template_phases").delete().eq("template_id", templateId);
          if (tpClear) fail(`template_phases clear failed (${key}): ${tpClear.message}`);
          const { error: tpErr } = await sb.from("template_phases").insert({ template_id: templateId, phase_id: phaseId, position: dayIndex + 1 });
          if (tpErr) fail(`template_phases insert failed (${key}): ${tpErr.message}`);
        }
      }
    }

    // Rows this programme wrote on an earlier run that the JSON no
    // longer has: templates keyed under it, phases past its last week.
    // Deleting a template cascades to its template_exercises and
    // template_phases. The "template:" and "achilles:" rows have no
    // program_id here and never match.
    const owner = `program:${program.name}:`;
    const { data: owned, error: ownedErr } = await sb
      .from("templates")
      .select("id,_notion_id")
      .eq("program_id", programId)
      .like("_notion_id", "program:%");
    if (ownedErr) fail(`template listing failed (${program.name}): ${ownedErr.message}`);
    const stale = (owned ?? [])
      .filter((t) => typeof t._notion_id === "string" && t._notion_id.startsWith(owner) && !keysWritten.has(t._notion_id))
      .map((t) => t.id as string);
    if (stale.length) {
      const { error: delErr } = await sb.from("templates").delete().in("id", stale);
      if (delErr) fail(`stale template delete failed (${program.name}): ${delErr.message}`);
      report.staleTemplatesDeleted += stale.length;
    }
    const { data: stalePhases, error: spErr } = await sb
      .from("program_phases")
      .delete()
      .eq("program_id", programId)
      .gt("position", position)
      .select("id");
    if (spErr) fail(`stale phase delete failed (${program.name}): ${spErr.message}`);
    report.stalePhasesDeleted += stalePhases?.length ?? 0;

    report.programs.push({ name: program.name, weeks: position, templates, templateExercises });
    console.log(`  ${program.name}: ${position} weeks, ${templates} templates, ${templateExercises} template_exercises`);
  }

  // 4. Report.
  console.log("\n[4/5] report");
  for (const t of ["programs", "program_phases", "templates", "template_exercises", "template_phases", "exercises", "exercise_alternates"]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) fail(`${t} count failed: ${error.message}`);
    report.rowCounts[t] = count ?? 0;
  }
  const reportPath = fileURLToPath(new URL("./seed-programs-report.json", import.meta.url));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("  row counts:", report.rowCounts);
  console.log(`  exercises inserted: ${report.exercisesInserted.length}, matched: ${report.exercisesMatched.length}`);
  console.log(`  alternates written: ${report.alternatesWritten}, kept existing: ${report.alternatesKeptExisting.length}, conflicts: ${report.alternateConflicts.length}`);
  console.log(`  stale rows removed: ${report.staleTemplatesDeleted} templates, ${report.stalePhasesDeleted} phases`);

  console.log(`\n[5/5] done. Report written to ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
