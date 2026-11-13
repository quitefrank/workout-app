import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { Empty, LargeTitle, Screen } from "@/components/page";
import { listMuscleGroups } from "@/lib/data/queries";
import { listExerciseItems } from "@/lib/exercise-items";
import { cardFor } from "@/lib/workout/library-cards";
import { byEntryName, oneEntryPerMovement } from "@/lib/workout/movements";
import { GroupExercises } from "./group-exercises";

/** A Library card's exercises: one section per muscle group the card shows (Biceps, then Forearms), see `libraryCards`. */
export default async function MuscleGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [groups, all] = await Promise.all([listMuscleGroups(), listExerciseItems()]);
  const card = cardFor(groups, id);
  if (!card) notFound();
  const sections = card.members
    .map((g) => ({ id: g.id, name: g.name, art: <MuscleArt group={g.name} />, items: byEntryName(oneEntryPerMovement(all.filter((i) => i.groupId === g.id))) }))
    .filter((s) => s.items.length > 0);
  const count = sections.reduce((n, s) => n + s.items.length, 0);
  return (
    <Screen>
      <LargeTitle title={card.name} subtitle={`${count} ${count === 1 ? "exercise" : "exercises"}`} leading={<BackButton label="Back to Library" fallback="/library/exercises" />} />
      <div className="pt-3">{count ? <GroupExercises sections={sections} /> : <Empty title="No exercises yet" />}</div>
    </Screen>
  );
}
