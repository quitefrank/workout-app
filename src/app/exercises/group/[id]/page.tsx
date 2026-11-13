import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { Empty, LargeTitle, Screen } from "@/components/page";
import { listMuscleGroups } from "@/lib/data/queries";
import { listExerciseItems } from "@/lib/exercise-items";
import { cardFor, isSecondary, partLabel, primaryPart } from "@/lib/workout/library-cards";
import { byEntryName, oneEntryPerMovement } from "@/lib/workout/movements";
import { GroupExercises, type GroupSection } from "./group-exercises";

/**
 * A Library card's exercises (see `libraryCards`): a section per part the card holds (Biceps, then Forearms), then
 * Secondary, the exercises that name one of the card's muscles as a secondary. One entry per family throughout. The
 * route takes a card's slug, or a group id from an older link.
 */
export default async function MuscleGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [groups, all] = await Promise.all([listMuscleGroups(), listExerciseItems()]);
  const card = cardFor(groups, id);
  if (!card) notFound();
  const list = (pick: typeof all) => byEntryName(oneEntryPerMovement(pick));
  const primary: GroupSection[] = card.parts.map((p) => ({
    key: `${p.id}:${partLabel(p)}`,
    name: partLabel(p),
    items: list(all.filter((i) => primaryPart({ parts: [p] }, i))),
  }));
  const secondary: GroupSection = { key: "secondary", name: "Secondary", items: list(all.filter((i) => isSecondary(card, i))) };
  const sections = [...primary, secondary].filter((s) => s.items.length > 0);
  const count = primary.reduce((n, s) => n + s.items.length, 0);
  // rows show their own main group's drawing, so a Secondary row reads as the muscle it mainly trains
  const art = Object.fromEntries(groups.map((g) => [g.name, <MuscleArt key={g.id} group={g.name} />]));
  return (
    <Screen>
      <LargeTitle title={card.name} subtitle={`${count} ${count === 1 ? "exercise" : "exercises"}`} leading={<BackButton label="Back to Library" fallback="/library/exercises" />} />
      <div>{sections.length ? <GroupExercises sections={sections} art={art} /> : <Empty title="No exercises yet" />}</div>
    </Screen>
  );
}
