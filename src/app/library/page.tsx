import { cookies } from "next/headers";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { LargeTitle, Screen, SectionHeader } from "@/components/page";
import { WorkoutTiles } from "@/components/workout-tiles";
import { getActiveProgramId, listMuscleGroups, listPrograms, listTemplates, type ProgramSummary } from "@/lib/data/queries";
import { listExerciseItems } from "@/lib/exercise-items";
import { libraryLayoutFrom } from "@/lib/library-layout";
import { CATEGORY_LABELS } from "@/lib/workout/format";
import { groupByCategory } from "@/lib/workout/group";
import { libraryCards } from "@/lib/workout/library-cards";
import { byEntryName, oneEntryPerMovement } from "@/lib/workout/movements";
import { AllExercises } from "./exercises/all-exercises";
import { LibraryPills } from "./library-pills";
import { LibrarySearch } from "./library-search";
import { MuscleGroupGrid, ProgramRows } from "./sections";

export const metadata = { title: "Library" };

/**
 * The Library tab (Frank's calls, 2026-11-11, from the Tab Bar and Home Lab): one scroll of Exercises, Workouts and
 * Programs, in that order since exercises are what he looks up most, under one search over all three. Each section's
 * title carries a chevron to its own page, as Photos does.
 *
 * Settings > Library layout (2026-11-13, on trial) swaps the one scroll for capsule pills under the search field, with
 * or without an All pill first (`src/lib/library-layout.ts`). Search covers the whole Library either way.
 */
export default async function LibraryPage() {
  const jar = await cookies();
  const layout = libraryLayoutFrom((n) => jar.get(n)?.value);
  const pills = layout !== "scroll";
  const [groups, templates, programs, activeId, allItems] = await Promise.all([
    listMuscleGroups(),
    listTemplates(),
    listPrograms(),
    getActiveProgramId(),
    // only the Exercises pill lists every exercise; the one scroll never loads all of them up front
    pills ? listExerciseItems() : Promise.resolve(null),
  ]);
  // the grid and search's pills show the twelve cards; result rows keep their own group's drawing
  const groupArt = groups.map((g) => ({ id: g.id, name: g.name, art: <MuscleArt group={g.name} /> }));
  const cards = libraryCards(groups).map((c) => ({ id: c.slug, name: c.name, art: <MuscleArt group={c.art} />, parts: c.parts }));
  // the preview leads with workouts that have exercises, so it never opens on empty cards
  const previewWorkouts = [...templates].sort((a, b) => Number(b.exerciseCount > 0) - Number(a.exerciseCount > 0));

  // with pills the section titles drop their chevron: the pill above already goes there
  const oneScroll = (
    <>
      <SectionHeader title="Exercises" href={pills ? undefined : "/library/exercises"} />
      <MuscleGroupGrid groups={cards} />

      <SectionHeader title="Workouts" href={pills ? undefined : "/library/workouts"} />
      <WorkoutTiles items={previewWorkouts} />

      <SectionHeader title="Programs" href={pills ? undefined : "/library/programs"} />
      <ProgramRows programs={programs} activeId={activeId} />
    </>
  );

  return (
    <Screen>
      <LibrarySearch
        groups={groupArt}
        cards={cards}
        workouts={templates.map((t) => ({ id: t.id, name: t.name, category: t.category, slugs: t.slugs ?? [], exerciseCount: t.exerciseCount }))}
        programs={programs.map((p) => ({ id: p.id, name: p.name, slugs: p.slugs, weeks: p.phaseCount }))}
        header={<LargeTitle title="Library" />}
      >
        {pills ? (
          <LibraryPills
            layout={layout}
            panels={{
              all: oneScroll,
              exercises: (
                <>
                  <SectionHeader title="Muscle Groups" />
                  <MuscleGroupGrid groups={cards} />
                  <SectionHeader title="A to Z" />
                  <AllExercises items={byEntryName(oneEntryPerMovement(allItems ?? []))} arts={Object.fromEntries(groupArt.map((g) => [g.id, g.art]))} />
                </>
              ),
              workouts: groupByCategory(templates).map(([category, items]) => (
                <section key={category}>
                  <SectionHeader title={CATEGORY_LABELS[category] ?? "Other"} />
                  <WorkoutTiles items={items} />
                </section>
              )),
              programs: <ProgramPanel programs={programs} activeId={activeId} />,
            }}
          />
        ) : (
          oneScroll
        )}
      </LibrarySearch>
    </Screen>
  );
}

/** The Programs pill: the one followed first, then the rest, as Programs' own page lists them */
function ProgramPanel({ programs, activeId }: { programs: ProgramSummary[]; activeId: string | null }) {
  const following = programs.filter((p) => p.id === activeId);
  const rest = programs.filter((p) => p.id !== activeId);
  return (
    <>
      {following.length > 0 && (
        <>
          <SectionHeader title="Following" />
          <ProgramRows programs={following} activeId={activeId} />
        </>
      )}
      {rest.length > 0 && (
        <>
          <SectionHeader title="All Programs" />
          <ProgramRows programs={rest} activeId={activeId} />
        </>
      )}
    </>
  );
}
