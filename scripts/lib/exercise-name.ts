/**
 * Parse the conventions encoded in Notion's Exercises Name field.
 *
 * 1. The arrows ↑ and ↓ encode the upstairs/downstairs variant of the
 *    same physical movement for machine exercises. Strip them out and
 *    record the location.
 * 2. equipment_type is inferred from substring heuristics:
 *      "BB" or "Barbell"  -> barbell
 *      "DB" or "Dumbbell" -> dumbbell
 *      "Cable"            -> cable
 *      arrow present      -> machine (forced)
 *      "Elliptical"       -> cardio_machine
 *      "Rowing"/"Rower"   -> cardio_machine (a bare "Row" is a pull, not cardio)
 *      "Machine"          -> machine
 *      bodyweight markers -> bodyweight
 *      else               -> other (flagged for hand-fix)
 *
 *    Precedence matters. A "BB Row" must classify as barbell, not
 *    cardio_machine.
 */

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "cardio_machine"
  | "other";

export type MachineLocationValue = "upstairs" | "downstairs" | null;

export type ExerciseNameInfo = {
  name: string;
  machineLocation: MachineLocationValue;
  equipmentType: EquipmentType;
};

const BODYWEIGHT_TERMS = [
  "pull[- ]?up",
  "chin[- ]?up",
  "push[- ]?up",
  "\\bdip(s)?\\b",
  "\\bplank\\b",
  "burpee",
  "crunch",
  "sit[- ]?up",
  "mountain climber",
  "\\bbridge\\b",
];

const BODYWEIGHT_RE = new RegExp(BODYWEIGHT_TERMS.join("|"), "i");

export function parseExerciseName(rawName: string): ExerciseNameInfo {
  let machineLocation: MachineLocationValue = null;
  let cleaned = rawName;

  if (cleaned.includes("↑")) {
    machineLocation = "upstairs";
  } else if (cleaned.includes("↓")) {
    machineLocation = "downstairs";
  }

  // Strip the arrows, then any parentheses the arrow left empty
  // ("Cable Press Around (↑)" would otherwise become "Cable Press Around ()").
  cleaned = cleaned
    .replace(/[↑↓]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return {
    name: cleaned,
    machineLocation,
    equipmentType: inferEquipmentType(cleaned, machineLocation !== null),
  };
}

function inferEquipmentType(
  name: string,
  hasArrow: boolean,
): EquipmentType {
  if (/\b(?:barbell|bb)\b/i.test(name)) return "barbell";
  if (/\b(?:dumbbell|db)\b/i.test(name)) return "dumbbell";
  if (/\bcable\b/i.test(name)) return "cable";

  if (hasArrow) return "machine";

  if (/\belliptical\b/i.test(name)) return "cardio_machine";
  // Stays ahead of the machine check so "Rowing Machine" is cardio.
  if (/\b(?:rowing|rower)\b/i.test(name)) return "cardio_machine";
  if (/\bmachine\b/i.test(name)) return "machine";

  if (BODYWEIGHT_RE.test(name)) return "bodyweight";

  return "other";
}

/**
 * Stable identifier for matching the same exercise across sources
 * (Notion, the Achilles seed, hand entry). Arrows and punctuation go,
 * whitespace and hyphens collapse to one hyphen, and a machine
 * location is suffixed so upstairs and downstairs variants stay
 * distinct rows.
 */
export function exerciseSlug(
  rawName: string,
  machineLocation: MachineLocationValue,
): string {
  const base = rawName
    .replace(/[↑↓]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return machineLocation ? `${base}-${machineLocation}` : base;
}

/**
 * The slugs a library row for `slug` might carry instead, most exact
 * first: the slug itself, its singular or plural, "db"/"dumbbell" and
 * "bb"/"barbell" swapped, then the singular or plural of each swap.
 * exerciseSlug is unchanged; this only widens a lookup.
 */
export function slugCandidates(slug: string): string[] {
  const plural = (s: string): string[] => [...(s.endsWith("s") ? [s.slice(0, -1)] : []), `${s}s`];
  const swapped = (s: string): string[] => {
    const out: string[] = [];
    for (const [from, to] of [["db", "dumbbell"], ["dumbbell", "db"], ["bb", "barbell"], ["barbell", "bb"]] as const) {
      const r = s.replace(new RegExp(`(?<=^|-)${from}(?=-|$)`, "g"), to);
      if (r !== s) out.push(r);
    }
    return out;
  };
  const swaps = swapped(slug);
  return [...new Set([slug, ...plural(slug), ...swaps, ...swaps.flatMap(plural)])];
}
