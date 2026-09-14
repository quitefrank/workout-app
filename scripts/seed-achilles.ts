/**
 * Seed the Achilles material into Supabase.
 *
 * Committed data (scripts/data/achilles/*.ts): sources, the recovery
 * program and phases, exercises with authoring inputs and clips,
 * templates. Personal data (scripts/data/achilles/personal.local.json,
 * gitignored): the recovery row, clearances, events, rules, equipment.
 *
 * Run after the Notion seed:
 *   bun run seed:achilles
 *
 * Idempotent. Exercises match the library by slug; templates,
 * template_exercises and template_phases are keyed by synthetic ids
 * prefixed "achilles:" and are cleared and rewritten each run.
 * Alternates only fill empty slots: a library row's Notion sub-options
 * are never overwritten, and every slot the seed left alone is listed
 * in the report.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadAchillesSeedEnv } from "./lib/env";
import { parseDose } from "../src/lib/recovery/dose";
import { SOURCES } from "./data/achilles/sources";
import { RECOVERY_PROGRAM } from "./data/achilles/program";
import { EXERCISES } from "./data/achilles/exercises";
import { TEMPLATES } from "./data/achilles/templates";
import type { EquipmentItem } from "../src/lib/recovery/types";

type Personal = {
  recovery: { programName: string; label: string; side: "left" | "right"; injuryDate: string; notes: string | null };
  clearances: { effectiveFrom: string; kind: string; valuePct: number | null; valueText: string | null; phasePosition: number | null; source: string; note: string | null }[];
  events: { date: string; kind: string; label: string; note: string | null; questions: string[] }[];
  rules: { position: number; kind: string; title: string; detail: string | null; active: boolean }[];
  equipmentAvailable: EquipmentItem[];
};

type Report = {
  rowCounts: Record<string, number>;
  exerciseMatches: { slug: string; action: "updated" | "inserted" }[];
  alternateMisses: { exercise: string; alternate: string }[];
  /** Slots already holding a different alternate (a library row's Notion sub-option); left as they were. */
  alternatesKeptExisting: { exercise: string; position: number; keptExisting: true }[];
  unverifiedVideos: string[];
  rejectedDoses: { template: string; slug: string; dose: string }[];
  overrides: { template: string; slug: string; rule: number }[];
  clearancesInserted: number;
  clearancesAlreadyPresent: number;
};

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function main() {
  const env = loadAchillesSeedEnv();
  const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const personalPath = fileURLToPath(new URL("./data/achilles/personal.local.json", import.meta.url));
  const personal = JSON.parse(readFileSync(personalPath, "utf8")) as Personal;

  const report: Report = {
    rowCounts: {},
    exerciseMatches: [],
    alternateMisses: [],
    alternatesKeptExisting: [],
    unverifiedVideos: [],
    rejectedDoses: [],
    overrides: [],
    clearancesInserted: 0,
    clearancesAlreadyPresent: 0,
  };

  // 0. Refuse to run on an empty library.
  const { count: mgCount } = await sb.from("muscle_groups").select("*", { count: "exact", head: true });
  if (!mgCount) fail("muscle_groups is empty. Run the Notion seed first.");
  const { data: mgRows } = await sb.from("muscle_groups").select("id,name");
  const muscleGroupId = new Map((mgRows ?? []).map((r) => [r.name as string, r.id as string]));

  // 1. Sources.
  console.log("\n[1/7] sources");
  const sourceId = new Map<string, string>();
  for (const s of SOURCES) {
    const { data, error } = await sb
      .from("sources")
      .upsert({ citation: s.citation, url: s.url, kind: s.kind, quality: s.quality, notes: s.notes }, { onConflict: "citation" })
      .select("id")
      .single();
    if (error) fail(`source upsert failed (${s.key}): ${error.message}`);
    sourceId.set(s.key, data.id);
  }
  console.log(`  ${sourceId.size} sources`);

  // 2. Program and phases.
  console.log("\n[2/7] program and phases");
  const p = RECOVERY_PROGRAM;
  const { data: prog, error: progErr } = await sb
    .from("programs")
    .upsert(
      {
        name: p.name,
        kind: p.kind,
        description: p.description,
        citation: p.citation,
        authority_notes: p.authorityNotes,
        source_id: p.sourceKey ? (sourceId.get(p.sourceKey) ?? null) : null,
      },
      { onConflict: "name" },
    )
    .select("id")
    .single();
  if (progErr) fail(`program upsert failed: ${progErr.message}`);
  const programId = prog.id as string;
  const phaseIdByPosition = new Map<number, string>();
  for (const ph of p.phases) {
    const { data, error } = await sb
      .from("program_phases")
      .upsert(
        {
          program_id: programId,
          position: ph.position,
          label: ph.label,
          block: ph.block,
          week_from: ph.weekFrom,
          week_to: ph.weekTo,
          load_pct: ph.loadPct,
          gate: ph.gate,
          guidance: ph.guidance,
          flag: ph.flag,
          flag_source_id: ph.flagSourceKey ? (sourceId.get(ph.flagSourceKey) ?? null) : null,
        },
        { onConflict: "program_id,position" },
      )
      .select("id")
      .single();
    if (error) fail(`phase upsert failed (${ph.label}): ${error.message}`);
    phaseIdByPosition.set(ph.position, data.id);
  }
  console.log(`  ${phaseIdByPosition.size} phases`);

  // 3. Exercises: match by slug, update authoring inputs, insert the rest.
  console.log("\n[3/7] exercises");
  const exerciseId = new Map<string, string>();
  for (const e of EXERCISES) {
    const { data: existing } = await sb.from("exercises").select("id").eq("slug", e.slug).maybeSingle();
    const authoring = {
      support_required: e.supportRequired,
      load_direction: e.loadDirection,
      loads_booted_foot: e.loadsBootedFoot,
      ankle_involvement: e.ankleInvolvement,
      floor_transfer_required: e.floorTransferRequired,
      equipment_needed: e.equipmentNeeded,
      min_hours_between_sessions: e.minHoursBetweenSessions,
      max_sessions_per_week: e.maxSessionsPerWeek,
    };
    const video = e.videoVerifiedAt
      ? { video_url: e.videoUrl, video_verified_at: e.videoVerifiedAt, video_credit: e.videoCredit }
      : {};
    if (!e.videoVerifiedAt) report.unverifiedVideos.push(e.slug);
    if (existing) {
      const { error } = await sb.from("exercises").update({ ...authoring, ...video }).eq("id", existing.id);
      if (error) fail(`exercise update failed (${e.slug}): ${error.message}`);
      exerciseId.set(e.slug, existing.id);
      report.exerciseMatches.push({ slug: e.slug, action: "updated" });
    } else {
      const { data, error } = await sb
        .from("exercises")
        .insert({
          name: e.name,
          slug: e.slug,
          muscle_group_id: e.muscleGroup ? (muscleGroupId.get(e.muscleGroup) ?? null) : null,
          equipment_type: e.equipmentType,
          notes: e.notes,
          ...authoring,
          ...video,
        })
        .select("id")
        .single();
      if (error) fail(`exercise insert failed (${e.slug}): ${error.message}`);
      exerciseId.set(e.slug, data.id);
      report.exerciseMatches.push({ slug: e.slug, action: "inserted" });
    }
  }
  console.log(`  ${report.exerciseMatches.filter((m) => m.action === "updated").length} matched the library, ${report.exerciseMatches.filter((m) => m.action === "inserted").length} inserted`);

  // 4. Alternates. Empty slots only: a library row's Notion sub-options
  // stay as they are, and every slot left alone is reported.
  console.log("\n[4/7] alternates");
  let altCount = 0;
  for (const e of EXERCISES) {
    const ownId = exerciseId.get(e.slug);
    if (!ownId) fail(`no id for ${e.slug} after the exercises step`);
    for (const a of e.alternates) {
      let altId = exerciseId.get(a.slug);
      if (!altId) {
        const { data } = await sb.from("exercises").select("id").eq("slug", a.slug).maybeSingle();
        altId = data?.id;
      }
      if (!altId) {
        report.alternateMisses.push({ exercise: e.slug, alternate: a.slug });
        continue;
      }
      const { error } = await sb
        .from("exercise_alternates")
        .upsert(
          { exercise_id: ownId, alternate_exercise_id: altId, position: a.position, notes: a.notes },
          { onConflict: "exercise_id,position", ignoreDuplicates: true },
        );
      if (error) fail(`alternate upsert failed (${e.slug} -> ${a.slug}): ${error.message}`);
      const { data: slot, error: slotErr } = await sb
        .from("exercise_alternates")
        .select("alternate_exercise_id")
        .eq("exercise_id", ownId)
        .eq("position", a.position)
        .maybeSingle();
      if (slotErr) fail(`alternate read-back failed (${e.slug} position ${a.position}): ${slotErr.message}`);
      if (!slot) fail(`alternate slot missing after upsert (${e.slug} position ${a.position})`);
      if (slot.alternate_exercise_id !== altId) {
        report.alternatesKeptExisting.push({ exercise: e.slug, position: a.position, keptExisting: true });
        continue;
      }
      altCount++;
    }
  }
  console.log(`  ${altCount} alternates in place (${report.alternatesKeptExisting.length} slots kept their existing alternate, ${report.alternateMisses.length} missing)`);

  // 5. Templates: upsert, clear seed-owned rows, rewrite exercises and phases.
  console.log("\n[5/7] templates");
  let teCount = 0;
  for (const t of TEMPLATES) {
    const { data: tpl, error } = await sb
      .from("templates")
      .upsert(
        { name: t.name, category: t.category, variant: t.variant, notes: t.notes, program_id: programId, _notion_id: `achilles:${t.name}` },
        { onConflict: "_notion_id" },
      )
      .select("id")
      .single();
    if (error) fail(`template upsert failed (${t.name}): ${error.message}`);
    const templateId = tpl.id as string;

    const { error: clearErr } = await sb.from("template_exercises").delete().eq("template_id", templateId).like("_notion_id", "achilles:%");
    if (clearErr) fail(`template_exercises clear failed (${t.name}): ${clearErr.message}`);

    const rows = [];
    let pos = 1;
    for (const te of t.exercises) {
      const d = parseDose(te.dose);
      if (!d) {
        report.rejectedDoses.push({ template: t.name, slug: te.slug, dose: te.dose });
        continue;
      }
      const exId = exerciseId.get(te.slug);
      if (!exId) fail(`template ${t.name} references unknown exercise ${te.slug}`);
      if (te.override) report.overrides.push({ template: t.name, slug: te.slug, rule: te.override.rule });
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
        notes: [te.cue, d.modifier].filter(Boolean).join(" ") || null,
        override_rule: te.override?.rule ?? null,
        override_reason: te.override?.reason ?? null,
        _notion_id: `achilles:${t.name}:${pos}`,
      });
      pos++;
    }
    if (rows.length > 0) {
      const { error: insErr } = await sb.from("template_exercises").insert(rows);
      if (insErr) fail(`template_exercises insert failed (${t.name}): ${insErr.message}`);
      teCount += rows.length;
    }

    const { error: phClearErr } = await sb.from("template_phases").delete().eq("template_id", templateId);
    if (phClearErr) fail(`template_phases clear failed (${t.name}): ${phClearErr.message}`);
    const phaseRows = t.phases.map((pp, i) => ({ template_id: templateId, phase_id: phaseIdByPosition.get(pp), position: i + 1 }));
    if (phaseRows.length > 0) {
      const { error: phErr } = await sb.from("template_phases").insert(phaseRows);
      if (phErr) fail(`template_phases insert failed (${t.name}): ${phErr.message}`);
    }
  }
  console.log(`  ${TEMPLATES.length} templates, ${teCount} template_exercises, ${report.overrides.length} overrides recorded`);

  // 6. Personal rows.
  console.log("\n[6/7] personal rows");
  if (personal.recovery.programName !== p.name) fail("personal.local.json names a program that is not the seeded one");
  const { data: existingRec } = await sb
    .from("recoveries")
    .select("id")
    .eq("user_id", env.SEED_USER_ID)
    .eq("program_id", programId)
    .maybeSingle();
  let recoveryId: string;
  const recRow = {
    user_id: env.SEED_USER_ID,
    program_id: programId,
    label: personal.recovery.label,
    side: personal.recovery.side,
    injury_date: personal.recovery.injuryDate,
    notes: personal.recovery.notes,
  };
  if (existingRec) {
    const { error } = await sb.from("recoveries").update(recRow).eq("id", existingRec.id);
    if (error) fail(`recovery update failed: ${error.message}`);
    recoveryId = existingRec.id;
  } else {
    const { data, error } = await sb.from("recoveries").insert(recRow).select("id").single();
    if (error) fail(`recovery insert failed: ${error.message}`);
    recoveryId = data.id;
  }

  for (const c of personal.clearances) {
    const { data: dup } = await sb
      .from("clearances")
      .select("id")
      .eq("recovery_id", recoveryId)
      .eq("effective_from", c.effectiveFrom)
      .eq("kind", c.kind)
      .eq("source", c.source)
      .is("voided_at", null)
      .maybeSingle();
    if (dup) {
      report.clearancesAlreadyPresent++;
      continue;
    }
    const { error } = await sb.from("clearances").insert({
      recovery_id: recoveryId,
      effective_from: c.effectiveFrom,
      kind: c.kind,
      value_pct: c.valuePct,
      value_text: c.valueText,
      phase_id: c.phasePosition ? (phaseIdByPosition.get(c.phasePosition) ?? null) : null,
      source: c.source,
      note: c.note,
    });
    if (error) fail(`clearance insert failed (${c.effectiveFrom} ${c.kind}): ${error.message}`);
    report.clearancesInserted++;
  }

  for (const ev of personal.events) {
    const { data: dup } = await sb.from("events").select("id").eq("recovery_id", recoveryId).eq("date", ev.date).eq("label", ev.label).maybeSingle();
    const row = { recovery_id: recoveryId, date: ev.date, kind: ev.kind, label: ev.label, note: ev.note, questions: ev.questions };
    const { error } = dup ? await sb.from("events").update(row).eq("id", dup.id) : await sb.from("events").insert(row);
    if (error) fail(`event upsert failed (${ev.label}): ${error.message}`);
  }

  for (const r of personal.rules) {
    const { error } = await sb
      .from("rules")
      .upsert({ recovery_id: recoveryId, position: r.position, kind: r.kind, title: r.title, detail: r.detail, active: r.active }, { onConflict: "recovery_id,position" });
    if (error) fail(`rule upsert failed (${r.title}): ${error.message}`);
  }

  const { error: settingsErr } = await sb
    .from("user_settings")
    .upsert({ user_id: env.SEED_USER_ID, equipment_available: personal.equipmentAvailable }, { onConflict: "user_id" });
  if (settingsErr) fail(`user_settings upsert failed: ${settingsErr.message}`);
  console.log(`  recovery ${recoveryId.slice(0, 8)}, ${report.clearancesInserted} clearances inserted, ${report.clearancesAlreadyPresent} already present, ${personal.events.length} events, ${personal.rules.length} rules`);

  // 7. Report.
  console.log("\n[7/7] report");
  for (const t of ["sources", "programs", "program_phases", "exercises", "exercise_alternates", "templates", "template_exercises", "template_phases", "recoveries", "clearances", "events", "rules"]) {
    const { count } = await sb.from(t).select("*", { count: "exact", head: true });
    report.rowCounts[t] = count ?? 0;
  }
  const reportPath = fileURLToPath(new URL("./seed-achilles-report.json", import.meta.url));
  writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log("  row counts:", report.rowCounts);
  console.log(`  unverified videos: ${report.unverifiedVideos.length}`);
  console.log(`  rejected doses: ${report.rejectedDoses.length}`);
  console.log(`  alternate misses: ${report.alternateMisses.length}`);
  console.log(`  alternate slots kept existing: ${report.alternatesKeptExisting.length}`);
  console.log(`\nReport written to ${reportPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
