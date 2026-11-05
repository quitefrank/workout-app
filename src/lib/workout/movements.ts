/**
 * Movements. Library rows that are one movement show as one entry. Each row keeps its image and history, and
 * `option_equipment` and `option_technique` say which way of doing the movement it is, so a choice switches rows.
 * Pure, no Supabase import.
 */

export type MovementFields = {
  name: string;
  movement: string | null;
  option_equipment: string | null;
  option_technique: string | null;
};

export type MovementOption = {
  id: string;
  slug: string | null;
  name: string;
  equipment: string;
  technique: string | null;
  hasFloors: boolean;
};

/** The label for the standard way, where a movement also has named techniques. */
export const STANDARD = "Standard";

export const techniqueLabel = (technique: string | null): string => technique ?? STANDARD;

export function equipmentChoices(options: readonly MovementOption[]): string[] {
  return [...new Set(options.map((o) => o.equipment))];
}

export function techniqueChoices(options: readonly MovementOption[], equipment: string): string[] {
  return [...new Set(options.filter((o) => o.equipment === equipment).map((o) => techniqueLabel(o.technique)))];
}

/** The row for a new choice of equipment: the same technique when it has one, else its standard way, else its first. */
export function optionForEquipment(options: readonly MovementOption[], equipment: string, technique: string | null): MovementOption | null {
  const on = options.filter((o) => o.equipment === equipment);
  return on.find((o) => o.technique === technique) ?? on.find((o) => o.technique === null) ?? on[0] ?? null;
}

export function optionForTechnique(options: readonly MovementOption[], equipment: string, label: string): MovementOption | null {
  return options.find((o) => o.equipment === equipment && techniqueLabel(o.technique) === label) ?? null;
}

/** What sets this row apart within its movement, for a label beside the movement's name. */
export function optionTag(e: MovementFields): string | null {
  if (!e.movement) return null;
  return [e.option_equipment, e.option_technique].filter(Boolean).join(", ") || null;
}

/** A row's name where one row is meant: "Bench Press · Barbell", or its own name when it stands alone. */
export function exerciseTitle(e: MovementFields): string {
  if (!e.movement) return e.name;
  const tag = optionTag(e);
  return tag ? `${e.movement} · ${tag}` : e.movement;
}

/**
 * A list with each movement once. It keeps the first row of a movement that matched, so a search for "DB Bench" opens
 * Bench Press on dumbbell, and otherwise prefers the row with history, so the entry opens on what was last done.
 */
export function oneEntryPerMovement<T extends { movement: string | null; last?: unknown }>(items: readonly T[]): T[] {
  const chosen = new Map<string, T>();
  for (const item of items) {
    if (!item.movement) continue;
    const held = chosen.get(item.movement);
    if (!held || (!held.last && item.last)) chosen.set(item.movement, item);
  }
  const placed = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (!item.movement) {
      out.push(item);
    } else if (!placed.has(item.movement)) {
      placed.add(item.movement);
      out.push(chosen.get(item.movement)!);
    }
  }
  return out;
}

/** A list in the order its entries read: a movement sorts by its own name, not by the row it opens on. */
export function byEntryName<T extends { name: string; movement: string | null }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => (a.movement ?? a.name).localeCompare(b.movement ?? b.name));
}
