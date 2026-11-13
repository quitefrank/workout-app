import { BackButton } from "@/components/back-button";
import { LargeTitle, Screen, SectionHeader } from "@/components/page";
import { getActiveProgramId, listPrograms } from "@/lib/data/queries";
import { ProgramRows } from "../sections";

export const metadata = { title: "Programs" };

/** Programs' own page: the one followed first, then the rest. */
export default async function ProgramsLibraryPage() {
  const [programs, activeId] = await Promise.all([listPrograms(), getActiveProgramId()]);
  const following = programs.filter((p) => p.id === activeId);
  const rest = programs.filter((p) => p.id !== activeId);
  return (
    <Screen>
      <LargeTitle title="Programs" subtitle={`${programs.length} programs`} leading={<BackButton label="Back to Library" fallback="/library" />} />
      {following.length > 0 && (
        <>
          <SectionHeader title="Following" />
          <ProgramRows programs={following} activeId={activeId} />
        </>
      )}
      {rest.length > 0 && (
        <>
          {following.length > 0 ? <SectionHeader title="All Programs" /> : <div className="h-4" />}
          <ProgramRows programs={rest} activeId={activeId} />
        </>
      )}
    </Screen>
  );
}
