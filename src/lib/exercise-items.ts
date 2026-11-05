import { getSettings, getTopSets, listExercises } from "@/lib/data/queries";
import { latestByExercise } from "@/lib/workout/progress";
import type { EquipmentType, WeightUnit } from "@/lib/workout/format";

export type LibraryItem = {
  id: string;
  name: string;
  group: string | null;
  groupId: string | null;
  equipment: EquipmentType;
  location: "upstairs" | "downstairs" | null;
  /** The latest top set, already formatted in the user's unit by the row */
  last: { weight: number; reps: number } | null;
  unit: WeightUnit;
};

export async function listExerciseItems(): Promise<LibraryItem[]> {
  const [exercises, tops, settings] = await Promise.all([listExercises(), getTopSets(), getSettings()]);
  const latest = latestByExercise(tops);
  return exercises.map((e) => {
    const l = latest.get(e.id);
    return {
      id: e.id,
      name: e.name,
      group: e.muscle_groups?.name ?? null,
      groupId: e.muscle_group_id,
      equipment: e.equipment_type,
      location: e.machine_location,
      last: l ? { weight: l.weight, reps: l.reps } : null,
      unit: settings.weight_unit,
    };
  });
}
