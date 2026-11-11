import type { ReactNode } from "react";
import { MuscleArt } from "@/components/muscle-art/muscle-art";
import { Screen } from "@/components/page";
import { countGroupEntries, listMuscleGroups } from "@/lib/data/queries";
import { LibrarySection } from "./library-section";

/**
 * Home's frame and its Library section. In a layout because picking a day re-renders the page and not its layout, so a
 * day tap never carries the muscle art again (about 150 KB of paths).
 */
export default async function HomeLayout({ children }: { children: ReactNode }) {
  const [groups, counts] = await Promise.all([listMuscleGroups(), countGroupEntries()]);
  return (
    <Screen>
      <LibrarySection groups={groups.map((g) => ({ id: g.id, name: g.name, count: counts.get(g.id) ?? 0, art: <MuscleArt group={g.name} /> }))}>{children}</LibrarySection>
    </Screen>
  );
}
