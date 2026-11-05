import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { Empty, LargeTitle, Screen } from "@/components/page";
import { listMuscleGroups } from "@/lib/data/queries";
import { listExerciseItems } from "@/lib/exercise-items";
import { GroupExercises } from "./group-exercises";

export default async function MuscleGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [groups, all] = await Promise.all([listMuscleGroups(), listExerciseItems()]);
  const group = groups.find((g) => g.id === id);
  if (!group) notFound();
  const items = all.filter((i) => i.groupId === id);
  return (
    <Screen>
      <LargeTitle title={group.name} subtitle={`${items.length} ${items.length === 1 ? "exercise" : "exercises"}`} leading={<BackButton label="Back to Home" />} />
      <div className="pt-3">
        {items.length ? <GroupExercises items={items} art={<MuscleArt group={group.name} />} /> : <Empty title="No exercises yet" />}
      </div>
    </Screen>
  );
}
