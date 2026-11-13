import { BackButton } from "@/components/back-button";
import { LargeTitle, Screen, SectionHeader } from "@/components/page";
import { WorkoutTiles } from "@/components/workout-tiles";
import { listTemplates } from "@/lib/data/queries";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";

export const metadata = { title: "Workouts" };

/** Workouts' own page: the day workouts (templates outside programs) by category. */
export default async function WorkoutsLibraryPage() {
  const templates = await listTemplates();
  return (
    <Screen>
      <LargeTitle title="Workouts" subtitle={`${templates.length} workouts`} leading={<BackButton label="Back to Library" fallback="/library" />} />
      {groupByCategory(templates).map(([category, items], i) => (
        <section key={category}>
          <SectionHeader title={CATEGORY_LABELS[category] ?? "Other"} className={i === 0 ? "pt-0" : undefined} />
          <WorkoutTiles items={items} />
        </section>
      ))}
    </Screen>
  );
}
