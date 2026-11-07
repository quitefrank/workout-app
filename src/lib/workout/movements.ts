/**
 * Exercise families (migration 0022). A family (`movement`) is one movement shown as one entry; each library row is a
 * version of it, set apart by three choices: equipment, position (the bench or how the body is set) and variation
 * (`option_technique`). Equipment is the parent: it decides which positions exist, and equipment with position decides
 * the variations. A choice the current setup rules out stays in its menu, dimmed, with what it needs. Each row keeps
 * its image and history, so a choice switches rows. `title` is the version's display name. Pure, no Supabase import.
 */

export type MovementFields = {
  name: string;
  title: string | null;
  movement: string | null;
};

export type MovementOption = {
  id: string;
  slug: string | null;
  name: string;
  title: string | null;
  equipment: string;
  position: string | null;
  technique: string | null;
  hasFloors: boolean;
};

export type MovementAxis = "equipment" | "position" | "variation";

/** The label for the standard way, where a family also has named variations. */
export const STANDARD = "Standard";

export const techniqueLabel = (technique: string | null): string => technique ?? STANDARD;

const uniq = (xs: string[]): string[] => [...new Set(xs)];
const valueOf = (o: MovementOption, axis: MovementAxis): string | null =>
  axis === "equipment" ? o.equipment : axis === "position" ? o.position : techniqueLabel(o.technique);

/** Every value an axis has across the family, in the family's order. Position is empty when the family has none. */
export function axisChoices(options: readonly MovementOption[], axis: MovementAxis): string[] {
  return uniq(options.map((o) => valueOf(o, axis)).filter((v): v is string => v !== null));
}

/** The row a choice lands on. A child keeps its value when the new parent has it, else falls back to the default. */
export function optionFor(options: readonly MovementOption[], current: MovementOption, axis: MovementAxis, value: string): MovementOption | null {
  const equipment = axis === "equipment" ? value : current.equipment;
  const onEquipment = options.filter((o) => o.equipment === equipment);
  if (onEquipment.length === 0) return null;
  const positions = uniq(onEquipment.map((o) => o.position ?? ""));
  const wantPosition = axis === "position" ? value : (current.position ?? "");
  // The default position on an equipment is the one its standard version sits in, first in the family's order
  const position = positions.includes(wantPosition) ? wantPosition : ((onEquipment.find((o) => o.technique === null) ?? onEquipment[0]).position ?? "");
  if (axis === "position" && position !== value) return null;
  const here = onEquipment.filter((o) => (o.position ?? "") === position);
  const wantTechnique = axis === "variation" ? value : techniqueLabel(current.technique);
  const exact = here.find((o) => techniqueLabel(o.technique) === wantTechnique);
  if (axis === "variation") return exact ?? null;
  return exact ?? here.find((o) => o.technique === null) ?? here[0] ?? null;
}

/**
 * Why a value cannot be picked from the current setup, or "" when it can. Equipment is the parent, so any equipment
 * can be picked. A short list says what it needs ("Needs Cable"); a long one says what rules it out ("Not on Cable").
 */
export function unavailableReason(options: readonly MovementOption[], current: MovementOption, axis: MovementAxis, value: string): string {
  if (axis === "equipment" || optionFor(options, current, axis, value)) return "";
  const need = (xs: string[], here: string | null) => (xs.length > 2 || xs.length === 0 ? `Not on ${here ?? current.equipment}` : `Needs ${xs.join(" or ")}`);
  if (axis === "position") return need(uniq(options.filter((o) => o.position === value).map((o) => o.equipment)), current.equipment);
  const withIt = options.filter((o) => techniqueLabel(o.technique) === value);
  const sameEquipment = uniq(withIt.filter((o) => o.equipment === current.equipment).map((o) => o.position ?? "").filter(Boolean));
  return sameEquipment.length ? need(sameEquipment, current.position) : need(uniq(withIt.map((o) => o.equipment)), current.equipment);
}

/** A row's display name: its version title, or its own name when it stands alone. */
export function exerciseTitle(e: Pick<MovementFields, "name" | "title">): string {
  return e.title ?? e.name;
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
