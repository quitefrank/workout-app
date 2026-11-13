import { getSettings, getTopSets, listExercises, listMuscleGroups } from "@/lib/data/queries";
import type { MachineLocation } from "@/lib/workout/machine-location";
import { latestByExercise } from "@/lib/workout/progress";
import type { EquipmentType, WeightUnit } from "@/lib/workout/format";

export type LibraryItem = {
  id: string;
  name: string;
  /** The version's display name (migration 0022); null shows name */
  title: string | null;
  slug: string | null;
  group: string | null;
  groupId: string | null;
  /** The groups it also trains, by name (the Library's Secondary sections) */
  secondaryGroups: string[];
  equipment: EquipmentType;
  /** The movement this row is one way of doing, and the equipment choices on it */
  movement: string | null;
  choices: string[];
  /** The latest top set and its floor, formatted in the user's unit by the row */
  last: { weight: number; reps: number; floor: MachineLocation | null } | null;
  unit: WeightUnit;
};

export async function listExerciseItems(): Promise<LibraryItem[]> {
  const [exercises, tops, settings, groups] = await Promise.all([listExercises(), getTopSets(), getSettings(), listMuscleGroups()]);
  const groupName = new Map(groups.map((g) => [g.id, g.name]));
  const latest = latestByExercise(tops);
  const choices = new Map<string, Set<string>>();
  for (const e of exercises) {
    if (e.movement && e.option_equipment) choices.set(e.movement, (choices.get(e.movement) ?? new Set()).add(e.option_equipment));
  }
  return exercises.map((e) => {
    const l = latest.get(e.id);
    return {
      id: e.id,
      name: e.name,
      title: e.title,
      slug: e.slug,
      group: e.muscle_groups?.name ?? null,
      groupId: e.muscle_group_id,
      secondaryGroups: (e.secondary_muscle_group_ids ?? []).map((id) => groupName.get(id)).filter((n): n is string => !!n),
      equipment: e.equipment_type,
      movement: e.movement,
      choices: e.movement ? [...(choices.get(e.movement) ?? [])] : [],
      last: l ? { weight: l.weight, reps: l.reps, floor: l.floor } : null,
      unit: settings.weight_unit,
    };
  });
}
