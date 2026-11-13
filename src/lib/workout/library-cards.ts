/**
 * The Library's muscle group cards (Frank's call, 2026-11-13, after the Equinox+ "Find a Movement" grid on Mobbin):
 * twelve cards, four full rows of three. The two smallest groups show inside a bigger one's card, Forearms under
 * Biceps and Neck under Shoulders. Display only: every exercise keeps its own muscle group in the database, and the
 * body map, search pills and records still use the fourteen groups.
 */
export const CARD_PARENT: Record<string, string> = {
  Forearms: "Biceps",
  Neck: "Shoulders",
};

export type Group = { id: string; name: string };
export type LibraryCard = { id: string; name: string; members: Group[] };

/** One card per group that is no other group's member, in the groups' order, the card's own group first. */
export function libraryCards(groups: Group[]): LibraryCard[] {
  const byName = new Map(groups.map((g) => [g.name, g]));
  const folded = (g: Group) => {
    const parent = CARD_PARENT[g.name];
    return parent !== undefined && byName.has(parent);
  };
  return groups
    .filter((g) => !folded(g))
    .map((g) => ({ id: g.id, name: g.name, members: [g, ...groups.filter((m) => folded(m) && CARD_PARENT[m.name] === g.name)] }));
}

/** The card that shows a group, so an old link to a folded group (Forearms) opens its parent's card. */
export function cardFor(groups: Group[], id: string): LibraryCard | undefined {
  return libraryCards(groups).find((c) => c.members.some((m) => m.id === id));
}
