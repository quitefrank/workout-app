/**
 * Template name parsing. Frank's day templates follow "Push P1",
 * "Legs P3", "Arms 2", "Full Body P2", "Run (indoor)", "Ab Circuit".
 * The first word names the category, the remainder is the variant.
 *
 * TEMPLATE_NAMES is the canonical list from Notion's page-template
 * picker on the Workouts database. Notion page templates keep their
 * prescription in a button automation the API cannot read, so the seed
 * rebuilds each template from the most recent Workouts row whose
 * trimmed title equals one of these names.
 */

export const TEMPLATE_NAMES = [
  "Legs P1",
  "Legs P2",
  "Legs P3",
  "Push P1",
  "Push P2",
  "Push P3",
  "Pull P1",
  "Pull P2",
  "Pull P3",
  "Arms 1",
  "Arms 2",
  "Arms 3",
  "Full Body P1",
  "Full Body P2",
  "Full Body P3",
  "Run (indoor)",
  "Run (outdoor)",
  "Ab Circuit",
] as const;

export type TemplateName = (typeof TEMPLATE_NAMES)[number];

export const CATEGORY_MAP: Record<string, string> = {
  push: "push",
  pull: "pull",
  legs: "legs",
  leg: "legs",
  arms: "arms",
  arm: "arms",
  full: "full_body",
  full_body: "full_body",
  fullbody: "full_body",
  cardio: "cardio",
  run: "cardio",
  abs: "abs",
  ab: "abs",
  core: "abs",
};

/**
 * Map a template name onto a template_category enum value by its first
 * word. Returns null when the first word is not a known category.
 */
export function inferTemplateCategory(name: string): string | null {
  const lower = name.trim().toLowerCase();
  const firstWord = lower.split(/\s+/)[0];
  if (firstWord in CATEGORY_MAP) return CATEGORY_MAP[firstWord];
  if (lower.startsWith("full body")) return "full_body";
  return null;
}

/**
 * Everything after the category word, or null when the name is a single
 * word. "Full Body" counts as one category word.
 */
export function extractVariant(name: string): string | null {
  const parts = name.trim().split(/\s+/);
  if (parts.length < 2) return null;
  if (parts[0].toLowerCase() === "full" && parts[1].toLowerCase() === "body") {
    return parts.slice(2).join(" ") || null;
  }
  return parts.slice(1).join(" ");
}
