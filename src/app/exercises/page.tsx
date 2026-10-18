import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { LargeTitle, Screen } from "@/components/page";
import { getSettings, getTopSets, listExercises, listMuscleGroups } from "@/lib/data/queries";
import { latestByExercise } from "@/lib/workout/progress";
import { ExerciseLibrary, type LibraryItem } from "./library";

export const metadata = { title: "Library" };

export default async function ExercisesPage() {
  const [exercises, groups, tops, settings] = await Promise.all([
    listExercises(),
    listMuscleGroups(),
    getTopSets(),
    getSettings(),
  ]);
  const latest = latestByExercise(tops);
  const items: LibraryItem[] = exercises.map((e) => {
    const l = latest.get(e.id);
    return {
      id: e.id,
      name: e.name,
      group: e.muscle_groups?.name ?? null,
      groupId: e.muscle_group_id,
      equipment: e.equipment_type,
      location: e.machine_location,
      last: l ? { weight: l.weight, reps: l.reps, at: l.completed_at } : null,
    };
  });
  // Groups with no exercises in them only add noise to the grid
  const used = new Set(items.map((i) => i.groupId));
  return (
    <Screen>
      <LargeTitle title="Library" subtitle={`${items.length} exercises`} />
      <ExerciseLibrary
        items={items}
        groups={groups
          .filter((g) => used.has(g.id))
          .map((g) => ({ id: g.id, name: g.name, art: <MuscleArt group={g.name} /> }))}
        unit={settings.weight_unit}
      />
    </Screen>
  );
}
