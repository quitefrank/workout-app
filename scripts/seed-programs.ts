/**
 * Load every programme JSON under scripts/data/programs/ (except the
 * example) into Supabase. One program row, one program_phases row per
 * week (block name in `block`), one template per day per week, ordered
 * inside the phase by template_phases.position.
 *
 *   bun run seed:programs [path.json ...]
 *
 * Idempotent. Every JSON is validated and every dose parsed before the
 * first write, so a bad file fails the run with nothing changed (the
 * report is still written, so the rejected doses are on disk).
 *
 * Ownership is the _notion_id column. This seed stamps:
 *   program:<programme>:<block>:<week>:<day>        templates
 *   program:<programme>:<block>:<week>:<day>:<n>    template_exercises
 *   program:<programme>:<slug>:<position>           exercise_alternates
 *   program:exercise:<slug>                         exercises it inserted
 *
 * For each programme in the loaded files, the seed clears and rewrites
 * its template_exercises and template_phases, removes its templates and
 * phases the JSON no longer has, and removes its alternate rows that
 * are no longer wanted. After all programmes, exercises the seed
 * inserted that nothing references any more are removed. Nothing else
 * is cleared: the Notion-derived templates ("template:" keys), the
 * Achilles rows ("achilles:" keys), Notion sub-options (null key) and
 * any programme not in the loaded files are left as they are; the last
 * two are only reported.
 *
 * Exercises match the library by slug, then by near-duplicate slugs
 * (plural, "db"/"dumbbell", "bb"/"barbell"). A row this seed inserted
 * never shadows a curated library row: candidates are tried against
 * Notion and Achilles rows first, then against seed-owned rows. Unknown
 * exercises are inserted unrated (no authoring inputs), which the
 * recovery rules report as unrated.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

import { loadAchillesSeedEnv } from "./lib/env";
import { exerciseSlug, parseExerciseName, slugCandidates } from "./lib/exercise-name";
import { inferTemplateCategory } from "./lib/template-name";
import { parseRange, parseRestSeconds } from "./lib/parse-prescription";
import { parseDose } from "../src/lib/recovery/dose";
import { validateProgramJson, type ProgramJson } from "./data/programs/schema";

const EXERCISE_OWNER = "program:exercise:";

type Report = {
  programs: { name: string; weeks: number; templates: number; templateExercises: number }[];
  /** Inserted with the equipment type the name implies; "other" means hand-fix. */
  exercisesInserted: { slug: string; equipmentType: string }[];
  exercisesMatched: string[];
  /** Matched a library row through a near-duplicate slug rather than the exact one. */
  fuzzyMatches: { wanted: string; matched: string }[];
  /** Seed-inserted exercises nothing references any more; deleted at the end of the run. */
  exercisesRemoved: string[];
  /** Seed-owned exercises still at equipment_type "other" or with no muscle group; computed every run. */
  handFix: { slug: string; equipmentType: string; muscleGroup: string | null }[];
  /** Filled during pre-flight; the run stops before any write when non-empty. */
  rejectedDoses: { program: string; block: string; week: number; day: string; name: string; dose: string }[];
  /** Seed-owned alternate rows that now say what the JSON says. */
  alternatesInPlace: number;
  /** Rows the seed does not own (Notion sub-options, another programme) that already named the same alternate. */
  alternatesAlreadyMatching: number;
  /** Slots holding a Notion sub-option (or another programme's alternate) that differs from this programme's; left as they were. */
  alternatesKeptExisting: { program: string; exercise: string; position: number; existing: string; wanted: string }[];
  /** The same exercise listed with a different substitution in a later week; the first one wins. */
  alternateConflicts: { program: string; exercise: string; position: number; kept: string; ignored: string }[];
  /** Seed-owned alternate rows of a loaded programme that its JSON no longer wants; deleted. */
  alternatesRemoved: number;
  /** Training programmes in the database that are not among the loaded files; reported only. */
  orphanPrograms: string[];
  /** Seed-owned alternate keys whose programme is not among the loaded files; reported only. */
  orphanAlternates: string[];
  staleTemplatesDeleted: number;
  stalePhasesDeleted: number;
  rowCounts: Record<string, number>;
};

type Loaded = { file: string; program: ProgramJson };

/** One substitution slot per (programme, exercise slug, position), first occurrence wins. */
type AlternateSlot = { exerciseSlug: string; exerciseName: string; position: number; alternateSlug: string; alternateName: string };

const REPORT_PATH = fileURLToPath(new URL("./seed-programs-report.json", import.meta.url));

function writeReport(report: Report): void {
  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
}

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

function isSeedExercise(notionId: unknown): boolean {
  return typeof notionId === "string" && notionId.startsWith(EXERCISE_OWNER);
}

/** Read, validate and dose-check every file, then check names against the database. Fails before any write. */
async function preflight(sb: SupabaseClient, files: string[], report: Report): Promise<Loaded[]> {
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
    writeReport(report);
    console.error(`${report.rejectedDoses.length} doses do not parse; nothing written (see ${REPORT_PATH})`);
    for (const r of report.rejectedDoses) {
      console.error(`  ${r.program} / ${r.block} / week ${r.week} / ${r.day} / ${r.name}: ${JSON.stringify(r.dose)}`);
    }
    process.exit(1);
  }

  // A programme name that already belongs to a row of another kind (the
  // recovery program) must not be upserted over.
  const { data: named, error: namedErr } = await sb
    .from("programs")
    .select("name,kind")
    .in("name", loaded.map((l) => l.program.name));
  if (namedErr) fail(`programs lookup failed: ${namedErr.message}`);
  for (const row of named ?? []) {
    if (row.kind !== "training") fail(`programme "${row.name}" already exists with kind "${row.kind}"; refusing to overwrite it`);
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
    fuzzyMatches: [],
    exercisesRemoved: [],
    handFix: [],
    rejectedDoses: [],
    alternatesInPlace: 0,
    alternatesAlreadyMatching: 0,
    alternatesKeptExisting: [],
    alternateConflicts: [],
    alternatesRemoved: 0,
    orphanPrograms: [],
    orphanAlternates: [],
    staleTemplatesDeleted: 0,
    stalePhasesDeleted: 0,
    rowCounts: {},
  };

  // 0. Pre-flight: files, shape, doses, names, library present.
  console.log("\n[0/6] pre-flight");
  const files = programFiles();
  if (files.length === 0) fail("no programme JSON found under scripts/data/programs/ (the example is skipped)");
  const { count: mgCount, error: mgErr } = await sb.from("muscle_groups").select("*", { count: "exact", head: true });
  if (mgErr) fail(`muscle_groups count failed: ${mgErr.message}`);
  if (!mgCount) fail("muscle_groups is empty. Run the Notion seed first.");
  const loaded = await preflight(sb, files, report);
  const loadedNames = new Set(loaded.map((l) => l.program.name));
  for (const { file, program } of loaded) {
    const weeks = program.blocks.reduce((n, b) => n + b.weeks.length, 0);
    console.log(`  ${basename(file)}: ${program.name} (${program.blocks.length} blocks, ${weeks} weeks)`);
  }

  // 1. Exercises: match by slug or a near-duplicate slug, insert the
  // rest with the equipment type the name implies, no muscle group, no
  // authoring inputs, stamped as seed-owned.
  console.log("\n[1/6] exercises");
  const exerciseId = new Map<string, string>();
  /** The library slug each JSON slug resolved to (differs from the key on a fuzzy match). */
  const librarySlug = new Map<string, string>();
  for (const [slug, name] of collectNames(loaded)) {
    const candidates = slugCandidates(slug);
    const { data: rows, error: lookupErr } = await sb.from("exercises").select("id,slug,_notion_id").in("slug", candidates);
    if (lookupErr) fail(`exercise lookup failed (${slug}): ${lookupErr.message}`);
    const pick = (seedOwned: boolean) => {
      for (const c of candidates) {
        const row = (rows ?? []).find((r) => r.slug === c && isSeedExercise(r._notion_id) === seedOwned);
        if (row) return row;
      }
      return null;
    };
    const hit = pick(false) ?? pick(true);
    if (hit) {
      exerciseId.set(slug, hit.id as string);
      librarySlug.set(slug, hit.slug as string);
      report.exercisesMatched.push(slug);
      if (hit.slug !== slug) report.fuzzyMatches.push({ wanted: slug, matched: hit.slug as string });
      continue;
    }
    const parsed = parseExerciseName(name);
    const { data, error } = await sb
      .from("exercises")
      .insert({ name: parsed.name, slug, equipment_type: parsed.equipmentType, notes: null, _notion_id: `${EXERCISE_OWNER}${slug}` })
      .select("id")
      .single();
    if (error) fail(`exercise insert failed (${slug}): ${error.message}`);
    exerciseId.set(slug, data.id);
    librarySlug.set(slug, slug);
    report.exercisesInserted.push({ slug, equipmentType: parsed.equipmentType });
  }
  console.log(`  ${report.exercisesMatched.length} matched the library (${report.fuzzyMatches.length} through a near-duplicate slug), ${report.exercisesInserted.length} inserted`);

  // 2. Alternates. Each programme's rows carry
  // "program:<programme>:<library slug>:<position>" in _notion_id and
  // are corrected in place when the JSON changes. A slot holding a
  // library row's Notion sub-option, or another programme's alternate,
  // is left as it is and reported with what it holds and what was
  // wanted. Seed-owned rows of this programme that are no longer
  // wanted are removed.
  console.log("\n[2/6] alternates");
  for (const { program } of loaded) {
    const owner = `program:${program.name}:`;
    const wantedKeys = new Set<string>();
    for (const a of collectAlternates(program, report)) {
      const ownId = exerciseId.get(a.exerciseSlug);
      const altId = exerciseId.get(a.alternateSlug);
      if (!ownId) fail(`no id for ${a.exerciseSlug} after the exercises step`);
      if (!altId) fail(`no id for ${a.alternateSlug} after the exercises step`);
      // Two spellings that resolved to the same library row.
      if (altId === ownId) continue;
      const key = `${owner}${librarySlug.get(a.exerciseSlug)}:${a.position}`;
      wantedKeys.add(key);
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
      if (!seedOwned) {
        if (sameAlternate) {
          // A Notion sub-option (or another programme) already says this; leave it with its own key.
          report.alternatesAlreadyMatching++;
          continue;
        }
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
      // Seed-owned and drifted: bring the row to what the JSON says.
      if (!sameAlternate || slot.notes !== notes || slot._notion_id !== key) {
        const { error: updErr } = await sb
          .from("exercise_alternates")
          .update({ alternate_exercise_id: altId, notes, _notion_id: key })
          .eq("id", slot.id);
        if (updErr) fail(`alternate update failed (${a.exerciseSlug} position ${a.position}): ${updErr.message}`);
      }
      report.alternatesInPlace++;
    }

    const { data: ownedAlts, error: ownedAltsErr } = await sb
      .from("exercise_alternates")
      .select("id,_notion_id")
      .like("_notion_id", "program:%");
    if (ownedAltsErr) fail(`alternate listing failed (${program.name}): ${ownedAltsErr.message}`);
    const unwanted = (ownedAlts ?? [])
      .filter((r) => typeof r._notion_id === "string" && r._notion_id.startsWith(owner) && !wantedKeys.has(r._notion_id))
      .map((r) => r.id as string);
    if (unwanted.length) {
      const { error: delErr } = await sb.from("exercise_alternates").delete().in("id", unwanted);
      if (delErr) fail(`unwanted alternate delete failed (${program.name}): ${delErr.message}`);
      report.alternatesRemoved += unwanted.length;
    }
  }
  console.log(`  ${report.alternatesInPlace} alternates in place, ${report.alternatesAlreadyMatching} already matching, ${report.alternatesKeptExisting.length} kept their existing alternate, ${report.alternatesRemoved} removed, ${report.alternateConflicts.length} conflicts`);

  // 3. Programs, phases and templates.
  console.log("\n[3/6] programs, phases, templates");
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

  // 4. Seed-owned exercises nothing references any more (a near-duplicate
  // that later matched a curated row, or a name the JSON dropped).
  console.log("\n[4/6] unreferenced seed exercises");
  const { data: seedExercises, error: seErr } = await sb.from("exercises").select("id,slug").like("_notion_id", `${EXERCISE_OWNER}%`);
  if (seErr) fail(`seed exercise listing failed: ${seErr.message}`);
  const seedIds = (seedExercises ?? []).map((r) => r.id as string);
  if (seedIds.length) {
    const referenced = new Set<string>();
    const { data: te, error: teErr } = await sb.from("template_exercises").select("exercise_id").in("exercise_id", seedIds);
    if (teErr) fail(`template_exercises reference lookup failed: ${teErr.message}`);
    for (const r of te ?? []) referenced.add(r.exercise_id as string);
    const { data: we, error: weErr } = await sb.from("workout_exercises").select("exercise_id").in("exercise_id", seedIds);
    if (weErr) fail(`workout_exercises reference lookup failed: ${weErr.message}`);
    for (const r of we ?? []) referenced.add(r.exercise_id as string);
    const { data: ea1, error: ea1Err } = await sb.from("exercise_alternates").select("exercise_id").in("exercise_id", seedIds);
    if (ea1Err) fail(`exercise_alternates reference lookup failed: ${ea1Err.message}`);
    for (const r of ea1 ?? []) referenced.add(r.exercise_id as string);
    const { data: ea2, error: ea2Err } = await sb.from("exercise_alternates").select("alternate_exercise_id").in("alternate_exercise_id", seedIds);
    if (ea2Err) fail(`exercise_alternates alternate reference lookup failed: ${ea2Err.message}`);
    for (const r of ea2 ?? []) referenced.add(r.alternate_exercise_id as string);
    const unreferenced = (seedExercises ?? []).filter((r) => !referenced.has(r.id as string));
    if (unreferenced.length) {
      const { error: delErr } = await sb.from("exercises").delete().in("id", unreferenced.map((r) => r.id as string));
      if (delErr) fail(`unreferenced exercise delete failed: ${delErr.message}`);
      report.exercisesRemoved = unreferenced.map((r) => r.slug as string);
    }
  }
  console.log(`  ${report.exercisesRemoved.length} removed`);

  // 5. Report-only findings: orphans and hand-fixes.
  console.log("\n[5/6] orphans and hand-fixes");
  const { data: trainingRows, error: trErr } = await sb.from("programs").select("name").eq("kind", "training");
  if (trErr) fail(`programs listing failed: ${trErr.message}`);
  report.orphanPrograms = (trainingRows ?? []).map((r) => r.name as string).filter((n) => !loadedNames.has(n));
  const { data: allAlts, error: allAltsErr } = await sb.from("exercise_alternates").select("_notion_id").like("_notion_id", "program:%");
  if (allAltsErr) fail(`alternate listing failed: ${allAltsErr.message}`);
  report.orphanAlternates = (allAlts ?? [])
    .map((r) => r._notion_id as string)
    .filter((k) => ![...loadedNames].some((n) => k.startsWith(`program:${n}:`)));
  const { data: fixRows, error: fixErr } = await sb
    .from("exercises")
    .select("slug,equipment_type,muscle_group:muscle_groups(name)")
    .like("_notion_id", `${EXERCISE_OWNER}%`)
    .or("equipment_type.eq.other,muscle_group_id.is.null")
    .order("slug");
  if (fixErr) fail(`hand-fix listing failed: ${fixErr.message}`);
  report.handFix = (fixRows ?? []).map((r) => {
    const group = r.muscle_group as { name: string } | { name: string }[] | null;
    return {
      slug: r.slug as string,
      equipmentType: r.equipment_type as string,
      muscleGroup: Array.isArray(group) ? (group[0]?.name ?? null) : (group?.name ?? null),
    };
  });
  console.log(`  ${report.orphanPrograms.length} orphan programmes, ${report.orphanAlternates.length} orphan alternates, ${report.handFix.length} exercises to hand-fix`);

  // 6. Report.
  console.log("\n[6/6] report");
  for (const t of ["programs", "program_phases", "templates", "template_exercises", "template_phases", "exercises", "exercise_alternates"]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) fail(`${t} count failed: ${error.message}`);
    report.rowCounts[t] = count ?? 0;
  }
  writeReport(report);
  console.log("  row counts:", report.rowCounts);
  console.log(`  exercises inserted: ${report.exercisesInserted.length}, matched: ${report.exercisesMatched.length} (${report.fuzzyMatches.length} fuzzy), removed: ${report.exercisesRemoved.length}, hand-fix: ${report.handFix.length}`);
  console.log(`  alternates in place: ${report.alternatesInPlace}, already matching: ${report.alternatesAlreadyMatching}, kept existing: ${report.alternatesKeptExisting.length}, removed: ${report.alternatesRemoved}, conflicts: ${report.alternateConflicts.length}`);
  console.log(`  stale rows removed: ${report.staleTemplatesDeleted} templates, ${report.stalePhasesDeleted} phases`);
  console.log(`  orphans: ${report.orphanPrograms.length} programmes, ${report.orphanAlternates.length} alternates`);
  console.log(`\nReport written to ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
