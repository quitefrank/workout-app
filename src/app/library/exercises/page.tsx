import { BackButton } from "@/components/back-button";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { LargeTitle, Screen, SectionHeader } from "@/components/page";
import { listMuscleGroups } from "@/lib/data/queries";
import { listExerciseItems } from "@/lib/exercise-items";
import { libraryCards } from "@/lib/workout/library-cards";
import { byEntryName, oneEntryPerMovement } from "@/lib/workout/movements";
import { MuscleGroupGrid } from "../sections";
import { AllExercises } from "./all-exercises";

export const metadata = { title: "Exercises" };

/** Exercises' own page: the muscle groups, then every exercise A to Z, one entry per movement. */
export default async function ExercisesPage() {
  const [groups, all] = await Promise.all([listMuscleGroups(), listExerciseItems()]);
  const items = byEntryName(oneEntryPerMovement(all));
  const groupArt = groups.map((g) => ({ id: g.id, name: g.name, art: <MuscleArt group={g.name} /> }));
  const cards = libraryCards(groups).map((c) => ({ id: c.id, name: c.name, art: <MuscleArt group={c.name} /> }));
  return (
    <Screen>
      <LargeTitle title="Exercises" subtitle={`${items.length} exercises`} leading={<BackButton label="Back to Library" fallback="/library" />} />
      <SectionHeader title="Muscle Groups" />
      <MuscleGroupGrid groups={cards} />
      <SectionHeader title="A to Z" />
      <AllExercises items={items} arts={Object.fromEntries(groupArt.map((g) => [g.id, g.art]))} />
    </Screen>
  );
}
