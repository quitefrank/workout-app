import { notFound } from "next/navigation";
import { BackButton } from "@/components/back-button";
import { ExerciseDetailTabs } from "@/components/exercise-detail";
import { FigureIcon } from "@/components/icons";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { LargeTitle, Screen } from "@/components/page";
import { getExerciseView } from "@/lib/exercise-view";

/** An exercise opened from a template, a workout or Progress. The Library opens the same tabs in a sheet. */
export default async function ExercisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const view = await getExerciseView(id);
  if (!view) notFound();
  const group = view.exercise.muscle_groups?.name;
  return (
    <Screen>
      <LargeTitle title={view.exercise.name} leading={<BackButton />} />
      <div className="px-4 pt-3">
        <ExerciseDetailTabs
          view={view}
          art={
            group ? (
              <MuscleArt group={group} />
            ) : (
              <div className="grid size-full place-items-center text-ink-3">
                <FigureIcon size={40} />
              </div>
            )
          }
        />
      </div>
    </Screen>
  );
}
