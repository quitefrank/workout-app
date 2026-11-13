import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { LargeTitle, Screen, SectionHeader } from "@/components/page";
import { WorkoutTiles } from "@/components/workout-tiles";
import { getActiveProgramId, listMuscleGroups, listPrograms, listTemplates } from "@/lib/data/queries";
import { libraryCards } from "@/lib/workout/library-cards";
import { LibrarySearch } from "./library-search";
import { MuscleGroupGrid, ProgramRows } from "./sections";

export const metadata = { title: "Library" };

/**
 * The Library tab (Frank's calls, 2026-11-11, from the Tab Bar and Home Lab): one scroll of Exercises, Workouts and
 * Programs, in that order since exercises are what he looks up most, under one search over all three. Each section's
 * title carries a chevron to its own page, as Photos does.
 */
export default async function LibraryPage() {
  const [groups, templates, programs, activeId] = await Promise.all([listMuscleGroups(), listTemplates(), listPrograms(), getActiveProgramId()]);
  // the grid and search's pills show the twelve cards; result rows keep their own group's drawing
  const groupArt = groups.map((g) => ({ id: g.id, name: g.name, art: <MuscleArt group={g.name} /> }));
  const cards = libraryCards(groups).map((c) => ({ id: c.slug, name: c.name, art: <MuscleArt group={c.art} />, parts: c.parts }));
  return (
    <Screen>
      <LibrarySearch
        groups={groupArt}
        cards={cards}
        workouts={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, slugs: t.slugs ?? [], exerciseCount: t.exerciseCount }))}
        programs={programs.map((p) => ({ id: p.id, name: p.name, slugs: p.slugs, weeks: p.phaseCount }))}
        header={<LargeTitle title="Library" />}
      >
        <SectionHeader title="Exercises" href="/library/exercises" />
        <MuscleGroupGrid groups={cards} />

        <SectionHeader title="Workouts" href="/library/workouts" />
        {/* the preview leads with workouts that have exercises, so it never opens on empty cards */}
        <WorkoutTiles items={[...templates].sort((a, b) => Number(b.exerciseCount > 0) - Number(a.exerciseCount > 0))} />

        <SectionHeader title="Programs" href="/library/programs" />
        <ProgramRows programs={programs} activeId={activeId} />
      </LibrarySearch>
    </Screen>
  );
}
