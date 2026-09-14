/**
 * The template-authoring rules. These are the brief's hard-won rules
 * made executable. They run when a template is built (seed tests now,
 * a template builder later). They never run at workout time and never
 * produce a badge on a screen.
 *
 * Rule numbers match section 6 of the design spec.
 */

import type {
  AuthoringExercise,
  EquipmentItem,
  RestrictionState,
  Verdict,
  VerdictLevel,
} from "./types";

export type TemplateForAuthoring = {
  name: string;
  exercises: AuthoringExercise[];
  /** A note explaining how this template is spaced from others sharing a capped exercise. */
  spacingNote: string | null;
};

const LEVEL_RANK: Record<VerdictLevel, number> = { ok: 0, warn: 1, blocked: 2 };

/** The most severe level among a set of verdicts. */
export function worstLevel(verdicts: Verdict[]): VerdictLevel {
  let worst: VerdictLevel = "ok";
  for (const v of verdicts) {
    if (LEVEL_RANK[v.level] > LEVEL_RANK[worst]) worst = v.level;
  }
  return worst;
}

/**
 * Run rules 1 to 10 against one exercise in one slot of a template.
 * @param position 1-based position of the exercise inside its template.
 * @param equipmentAvailable null when no inventory is known; the check is skipped.
 */
export function checkExercise(
  ex: AuthoringExercise,
  state: RestrictionState,
  equipmentAvailable: EquipmentItem[] | null,
  position: number,
): Verdict[] {
  if (!Number.isInteger(position) || position < 1) {
    throw new Error(`Position must be a whole number from 1: ${position}`);
  }
  const out: Verdict[] = [];
  const partialLoad = state.clearedLoadPct < 100;
  const bootOn = state.bootStatus !== "off";
  const standing =
    ex.supportRequired === "standing_free" ||
    ex.supportRequired === "standing_supported";
  const horizontal =
    ex.loadDirection === "sagittal" || ex.loadDirection === "lateral";

  if (ex.loadsBootedFoot === true && (bootOn || partialLoad)) {
    out.push({
      level: "blocked",
      rule: 1,
      reason: "Loads the booted foot while the boot is not off or cleared load is under 100%",
    });
  }

  if (ex.ankleInvolvement === true && !state.ankleRomCleared) {
    out.push({
      level: "blocked",
      rule: 2,
      reason: "Ankle involvement while ankle range of motion is not cleared",
    });
  }

  if (standing && horizontal && partialLoad) {
    out.push({
      level: "blocked",
      rule: 3,
      reason: "Standing against a horizontal load with one leg to brace it",
    });
  }

  if (ex.supportRequired === "standing_free" && partialLoad) {
    out.push({
      level: "warn",
      rule: 4,
      reason: "Standing free during partial weight-bearing; a hand on the rack is the minimum",
    });
  }

  if (ex.supportRequired === "seated_supported" && ex.loadDirection === "lateral") {
    out.push({
      level: "blocked",
      rule: 5,
      reason: "Seated against a lateral load tips you off the bench",
    });
  }

  if (ex.floorTransferRequired === true && position !== 1) {
    out.push({
      level: "warn",
      rule: 8,
      reason: "Floor transfer is not first in the template; transfers are where falls happen",
    });
  }

  if (ex.equipmentNeeded && equipmentAvailable) {
    const missing = ex.equipmentNeeded.filter((e) => !equipmentAvailable.includes(e));
    if (missing.length > 0) {
      out.push({
        level: "warn",
        rule: 9,
        reason: `Equipment not available: ${missing.join(", ")}`,
      });
    }
  }

  const inputs = [
    ex.supportRequired,
    ex.loadDirection,
    ex.loadsBootedFoot,
    ex.ankleInvolvement,
    ex.floorTransferRequired,
    ex.equipmentNeeded,
  ];
  if (inputs.some((v) => v === null)) {
    out.push({
      level: "warn",
      rule: 10,
      reason: "Unrated: one or more authoring inputs is missing",
    });
  }

  if (out.length === 0) {
    if (ex.supportRequired === "seated_supported" && ex.loadDirection === "sagittal") {
      out.push({ level: "ok", rule: 6, reason: "Seated with a sagittal load; one foot braces it" });
    } else if (ex.loadDirection === "vertical" && ex.supportRequired !== "standing_free") {
      out.push({ level: "ok", rule: 7, reason: "Vertical load pulls into the support" });
    } else {
      out.push({ level: "ok", rule: 0, reason: "No rule triggered" });
    }
  }

  return out;
}

export type TemplateVerdict = {
  perExercise: Verdict[][];
  worst: VerdictLevel;
};

/** Run checkExercise over every slot of a template and summarise. */
export function checkTemplate(
  template: TemplateForAuthoring,
  state: RestrictionState,
  equipmentAvailable: EquipmentItem[] | null,
): TemplateVerdict {
  const perExercise = template.exercises.map((ex, i) =>
    checkExercise(ex, state, equipmentAvailable, i + 1),
  );
  return { perExercise, worst: worstLevel(perExercise.flat()) };
}

/**
 * Rule 11. Two templates in the same program that both contain an
 * exercise with a minimum gap between sessions need a spacing note on
 * each, or the gap is left to chance.
 */
export function checkSpacing(templates: TemplateForAuthoring[]): Verdict[] {
  const out: Verdict[] = [];
  const byExercise = new Map<string, { name: string; templates: TemplateForAuthoring[] }>();
  for (const t of templates) {
    for (const ex of t.exercises) {
      if (ex.minHoursBetweenSessions === null) continue;
      const entry = byExercise.get(ex.id) ?? { name: ex.name, templates: [] };
      if (!entry.templates.includes(t)) entry.templates.push(t);
      byExercise.set(ex.id, entry);
    }
  }
  for (const [, entry] of byExercise) {
    if (entry.templates.length < 2) continue;
    const unnoted = entry.templates.filter((t) => t.spacingNote === null || t.spacingNote.trim() === "");
    if (unnoted.length === 0) continue;
    out.push({
      level: "warn",
      rule: 11,
      reason: `${entry.name} appears in ${entry.templates.map((t) => t.name).join(", ")} with no spacing note on ${unnoted.map((t) => t.name).join(", ")}`,
    });
  }
  return out;
}
