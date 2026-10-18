import { MUSCLE_ART, type MuscleArtPaths } from "./paths";
import { muscleSlug } from "./slug";

/** A muscle group's traced diagram, by group name; null when it has none. */
export function artFor(
  group: string | null | undefined,
  table: Record<string, MuscleArtPaths> = MUSCLE_ART,
): MuscleArtPaths | null {
  if (!group) return null;
  return table[muscleSlug(group)] ?? null;
}
