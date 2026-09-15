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
 * Exercises match the library by slug, then by the alias LIBRARY_ALIASES
 * gives the slug (a curated Notion row under another name), then by
 * near-duplicate slugs (plural, "db"/"dumbbell", "bb"/"barbell"). A row
 * this seed inserted never shadows a curated library row: candidates
 * are tried against Notion and Achilles rows first, then against
 * seed-owned rows. Unknown exercises are inserted unrated (no authoring
 * inputs), which the recovery rules report as unrated; an unknown
 * substitution is inserted only when the slot it fills will actually be
 * written. After the unreferenced rows go, LIBRARY_ATTRIBUTES gives
 * every seed-owned row its muscle group and equipment, on every run, so
 * a fresh database ends up the same; curated rows are never touched.
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
import { LIBRARY_ALIASES, LIBRARY_ATTRIBUTES } from "./data/programs/library";

const EXERCISE_OWNER = "program:exercise:";

type Report = {
  programs: { name: string; weeks: number; templates: number; templateExercises: number }[];
  /** Inserted with the equipment type the name implies; "other" means hand-fix. */
  exercisesInserted: { slug: string; equipmentType: string }[];
  exercisesMatched: string[];
  /** Matched a library row through a near-duplicate slug rather than the exact one. */
  fuzzyMatches: { wanted: string; matched: string }[];
  /** Matched a curated row through LIBRARY_ALIASES. */
  aliasMatches: { wanted: string; matched: string }[];
  /** Alias targets that are not in the library; the alias is ignored and the name resolved as usual. */
  aliasesMissing: { wanted: string; target: string }[];
  /** Seed-owned rows whose muscle group or equipment LIBRARY_ATTRIBUTES set or corrected this run. */
  attributesApplied: string[];
  /** LIBRARY_ATTRIBUTES keys that are not seed-owned rows (aliased away, renamed, or never inserted). */
  attributesUnused: string[];
  /** Seed-inserted exercises nothing references any more; deleted at the end of the run. */
  exercisesRemoved: string[];
  /** Seed-owned exercises with no muscle group, or at equipment_type "other" without a LIBRARY_ATTRIBUTES entry saying so; computed every run. */
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

/**
 * Every distinct exercise name the programmes prescribe (not the
 * substitutions), keyed by slug, first spelling wins. Substitutions are
 * resolved at the slot, so one is only inserted when its slot will
 * actually be written.
 */
function collectPrescribedNames(loaded: Loaded[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const { program } of loaded) {
    for (const block of program.blocks) for (const week of block.weeks) for (const day of week.days) {
      for (const ex of day.exercises) {
        const slug = exerciseSlug(ex.name, null);
        if (!names.has(slug)) names.set(slug, ex.name);
      }
    }
  }
  return names;
}

/**
 * Match a JSON exercise to the library by its slug, its alias in
 * LIBRARY_ALIASES, or a near-duplicate, trying curated rows (Notion,
 * Achilles) before seed-owned ones so a row this seed inserted never
 * shadows a curated one. Inserts when nothing matches and
 * `insertIfMissing` is set; otherwise returns null.
 */
async function makeResolver(sb: SupabaseClient, report: Report) {
  const exerciseId = new Map<string, string>();
  /** The library slug each JSON slug resolved to (differs from the key on a fuzzy match). */
  const librarySlug = new Map<string, string>();

  async function resolve(slug: string, name: string, insertIfMissing: boolean): Promise<string | null> {
    const cached = exerciseId.get(slug);
    if (cached) return cached;
    const alias = LIBRARY_ALIASES[slug];
    const fuzzy = slugCandidates(slug);
    const candidates = alias ? [slug, alias, ...fuzzy.filter((c) => c !== slug && c !== alias)] : fuzzy;
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
      if (hit.slug === alias) report.aliasMatches.push({ wanted: slug, matched: hit.slug as string });
      else if (hit.slug !== slug) report.fuzzyMatches.push({ wanted: slug, matched: hit.slug as string });
      return hit.id as string;
    }
    if (alias && !(rows ?? []).some((r) => r.slug === alias)) report.aliasesMissing.push({ wanted: slug, target: alias });
    if (!insertIfMissing) return null;
    // A near-duplicate spelling already resolved this run (inserted or
    // matched) takes precedence over a fresh insert.
    const resolvedCandidate = candidates.find((c) => exerciseId.has(c));
    if (resolvedCandidate) {
      const id = exerciseId.get(resolvedCandidate) as string;
      const matched = librarySlug.get(resolvedCandidate) ?? resolvedCandidate;
      exerciseId.set(slug, id);
      librarySlug.set(slug, matched);
      report.exercisesMatched.push(slug);
      report.fuzzyMatches.push({ wanted: slug, matched });
      return id;
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
    return data.id as string;
  }

  return { resolve, exerciseId, librarySlug };
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
    aliasMatches: [],
    aliasesMissing: [],
    attributesApplied: [],
    attributesUnused: [],
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
  console.log("\n[0/7] pre-flight");
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

  // 1. Prescribed exercises: match by slug or a near-duplicate slug,
  // insert the rest with the equipment type the name implies, no muscle
  // group, no authoring inputs, stamped as seed-owned.
  console.log("\n[1/7] exercises");
  const { resolve, exerciseId, librarySlug } = await makeResolver(sb, report);
  for (const [slug, name] of collectPrescribedNames(loaded)) {
    await resolve(slug, name, true);
  }
  console.log(`  ${report.exercisesMatched.length} matched the library (${report.fuzzyMatches.length} through a near-duplicate slug), ${report.exercisesInserted.length} inserted`);

  // 2. Alternates. Each programme's rows carry
  // "program:<programme>:<library slug>:<position>" in _notion_id and
  // are corrected in place when the JSON changes. A slot holding a
  // library row's Notion sub-option, or another programme's alternate,
  // is left as it is and reported with what it holds and what was
  // wanted; the substitution exercise is not inserted for such a slot,
  // so nothing is added that the run would then find unreferenced.
  // Seed-owned rows of this programme that are no longer wanted are
  // removed.
  console.log("\n[2/7] alternates");
  const readSlot = async (ownId: string, position: number, label: string) => {
    const { data: slot, error } = await sb
      .from("exercise_alternates")
      .select("id,alternate_exercise_id,notes,_notion_id")
      .eq("exercise_id", ownId)
      .eq("position", position)
      .maybeSingle();
    if (error) fail(`alternate read failed (${label} position ${position}): ${error.message}`);
    return slot;
  };
  for (const { program } of loaded) {
    const owner = `program:${program.name}:`;
    const wantedKeys = new Set<string>();
    for (const a of collectAlternates(program, report)) {
      const ownId = exerciseId.get(a.exerciseSlug);
      if (!ownId) fail(`no id for ${a.exerciseSlug} after the exercises step`);
      const current = await readSlot(ownId, a.position, a.exerciseSlug);
      const currentSeedOwned = typeof current?._notion_id === "string" && current._notion_id.startsWith(owner);

      // Resolve the substitution without inserting first, so a slot the
      // seed will not write never causes an insert.
      let altId = await resolve(a.alternateSlug, a.alternateName, false);
      if (current && !currentSeedOwned) {
        if (altId && current.alternate_exercise_id === altId) {
          // A Notion sub-option (or another programme) already says this; leave it with its own key.
          report.alternatesAlreadyMatching++;
          continue;
        }
        const { data: existingAlt, error: existingErr } = await sb
          .from("exercises")
          .select("slug")
          .eq("id", current.alternate_exercise_id)
          .maybeSingle();
        if (existingErr) fail(`existing alternate lookup failed (${a.exerciseSlug} position ${a.position}): ${existingErr.message}`);
        report.alternatesKeptExisting.push({
          program: program.name,
          exercise: a.exerciseSlug,
          position: a.position,
          existing: existingAlt?.slug ?? current.alternate_exercise_id,
          wanted: a.alternateSlug,
        });
        continue;
      }
      altId ??= await resolve(a.alternateSlug, a.alternateName, true);
      if (!altId) fail(`no id for ${a.alternateSlug} after resolving it`);
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
      const slot = await readSlot(ownId, a.position, a.exerciseSlug);
      if (!slot) fail(`alternate slot missing after upsert (${a.exerciseSlug} position ${a.position})`);
      const seedOwned = typeof slot._notion_id === "string" && slot._notion_id.startsWith(owner);
      if (!seedOwned) fail(`alternate slot changed owner during the run (${a.exerciseSlug} position ${a.position})`);
      const sameAlternate = slot.alternate_exercise_id === altId;
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
  console.log("\n[3/7] programs, phases, templates");
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
              variant: ex.variant,
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
  console.log("\n[4/7] unreferenced seed exercises");
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

  // 5. Attributes for seed-owned rows from LIBRARY_ATTRIBUTES. Curated
  // rows are never touched; a key that is not a seed-owned row (aliased
  // away, or renamed) is reported so the table does not rot.
  console.log("\n[5/7] library attributes");
  const { data: groups, error: gErr } = await sb.from("muscle_groups").select("id,name");
  if (gErr) fail(`muscle_groups listing failed: ${gErr.message}`);
  const groupId = new Map((groups ?? []).map((g) => [g.name as string, g.id as string]));
  for (const [slug, a] of Object.entries(LIBRARY_ATTRIBUTES)) {
    if (!groupId.has(a.muscleGroup)) fail(`LIBRARY_ATTRIBUTES ${slug}: muscle group "${a.muscleGroup}" is not in muscle_groups`);
  }
  const { data: ownedRows, error: ownedRowsErr } = await sb
    .from("exercises")
    .select("id,slug,equipment_type,muscle_group_id")
    .like("_notion_id", `${EXERCISE_OWNER}%`);
  if (ownedRowsErr) fail(`seed exercise listing failed: ${ownedRowsErr.message}`);
  const ownedBySlug = new Map((ownedRows ?? []).map((r) => [r.slug as string, r]));
  for (const [slug, a] of Object.entries(LIBRARY_ATTRIBUTES)) {
    const row = ownedBySlug.get(slug);
    if (!row) {
      report.attributesUnused.push(slug);
      continue;
    }
    const wantedGroup = groupId.get(a.muscleGroup) as string;
    if (row.muscle_group_id === wantedGroup && row.equipment_type === a.equipmentType) continue;
    const { error: updErr } = await sb
      .from("exercises")
      .update({ muscle_group_id: wantedGroup, equipment_type: a.equipmentType })
      .eq("id", row.id as string);
    if (updErr) fail(`attribute update failed (${slug}): ${updErr.message}`);
    report.attributesApplied.push(slug);
  }
  console.log(`  ${report.attributesApplied.length} applied, ${report.attributesUnused.length} unused keys`);

  // 6. Report-only findings: orphans and hand-fixes.
  console.log("\n[6/7] orphans and hand-fixes");
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
  report.handFix = (fixRows ?? [])
    .map((r) => {
      const group = r.muscle_group as { name: string } | { name: string }[] | null;
      return {
        slug: r.slug as string,
        equipmentType: r.equipment_type as string,
        muscleGroup: Array.isArray(group) ? (group[0]?.name ?? null) : (group?.name ?? null),
      };
    })
    .filter((r) => r.muscleGroup === null || !(r.slug in LIBRARY_ATTRIBUTES));
  console.log(`  ${report.orphanPrograms.length} orphan programmes, ${report.orphanAlternates.length} orphan alternates, ${report.handFix.length} exercises to hand-fix`);

  // 7. Report.
  console.log("\n[7/7] report");
  for (const t of ["programs", "program_phases", "templates", "template_exercises", "template_phases", "exercises", "exercise_alternates"]) {
    const { count, error } = await sb.from(t).select("*", { count: "exact", head: true });
    if (error) fail(`${t} count failed: ${error.message}`);
    report.rowCounts[t] = count ?? 0;
  }
  writeReport(report);
  console.log("  row counts:", report.rowCounts);
  console.log(`  exercises inserted: ${report.exercisesInserted.length}, matched: ${report.exercisesMatched.length} (${report.fuzzyMatches.length} fuzzy), removed: ${report.exercisesRemoved.length}, hand-fix: ${report.handFix.length}`);
  console.log(`  aliases: ${report.aliasMatches.length} matched, ${report.aliasesMissing.length} missing; attributes: ${report.attributesApplied.length} applied, ${report.attributesUnused.length} unused`);
  console.log(`  alternates in place: ${report.alternatesInPlace}, already matching: ${report.alternatesAlreadyMatching}, kept existing: ${report.alternatesKeptExisting.length}, removed: ${report.alternatesRemoved}, conflicts: ${report.alternateConflicts.length}`);
  console.log(`  stale rows removed: ${report.staleTemplatesDeleted} templates, ${report.stalePhasesDeleted} phases`);
  console.log(`  orphans: ${report.orphanPrograms.length} programmes, ${report.orphanAlternates.length} alternates`);
  console.log(`\nReport written to ${REPORT_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
