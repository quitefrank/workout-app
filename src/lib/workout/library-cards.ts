/**
 * The Library's muscle group cards (Frank's calls, 2026-11-13, after Equinox+'s "Find a Movement" grid on Mobbin):
 * twelve cards, four full rows of three, each one muscle. Display only: every exercise keeps its own muscle group in
 * the database, and the body map and records still use the groups.
 *
 * - Forearms shows in the Biceps card and Neck in Shoulders (too few exercises for a card).
 * - Back is two cards, as Equinox: Lats (the pulldown and pull-up families) and Upper Back (rows and shrugs).
 * - Abs is shown as Core.
 * - Cardio has no card: its exercises appear under Secondary on the leg cards (and the rower on Upper Back), through
 *   their secondary muscles (migration 0034).
 */

/** One slice of a card: a muscle group, optionally limited to some families (`only`) or all but some (`except`). */
export type CardPart = { group: string; only?: string[]; except?: string[]; label?: string; secondary?: boolean };
export type CardSpec = { slug: string; name: string; art: string; parts: CardPart[] };

/** The Back families that train the lats; the rest of Back is Upper Back. A row with no family matches by name. */
export const LATS_FAMILIES = ["Lat Pulldown", "Pull-Up", "Chin-Up", "Lat Pull-Over", "1-Arm Lat Pull-In", "Muscle Up"];

/** Groups that never get a card of their own. */
export const HIDDEN_GROUPS = ["Cardio"];

export const CARD_SPECS: CardSpec[] = [
  { slug: "core", name: "Core", art: "Abs", parts: [{ group: "Abs", label: "Core" }] },
  { slug: "biceps", name: "Biceps", art: "Biceps", parts: [{ group: "Biceps" }, { group: "Forearms" }] },
  { slug: "chest", name: "Chest", art: "Chest", parts: [{ group: "Chest" }] },
  { slug: "glutes", name: "Glutes", art: "Glutes", parts: [{ group: "Glutes" }] },
  // a secondary listed as Back shows on Upper Back only (deadlifts, face pulls, reverse flys, the rower)
  { slug: "lats", name: "Lats", art: "Lats", parts: [{ group: "Back", only: LATS_FAMILIES, label: "Lats", secondary: false }] },
  { slug: "upper-back", name: "Upper Back", art: "Upper Back", parts: [{ group: "Back", except: LATS_FAMILIES, label: "Upper Back" }] },
  { slug: "shoulders", name: "Shoulders", art: "Shoulders", parts: [{ group: "Shoulders" }, { group: "Neck" }] },
  { slug: "hamstrings", name: "Hamstrings", art: "Hamstrings", parts: [{ group: "Hamstrings" }] },
  { slug: "calves", name: "Calves", art: "Calves", parts: [{ group: "Calves" }] },
  { slug: "quadriceps", name: "Quadriceps", art: "Quadriceps", parts: [{ group: "Quadriceps" }] },
  { slug: "triceps", name: "Triceps", art: "Triceps", parts: [{ group: "Triceps" }] },
  { slug: "stretches", name: "Stretches", art: "Stretches", parts: [{ group: "Stretches" }] },
];

export type Group = { id: string; name: string };
export type LibraryCard = { slug: string; name: string; art: string; parts: (CardPart & { id: string })[] };
/** What a card needs to know about an exercise. */
export type CardItem = { name: string; movement: string | null; group: string | null; secondaryGroups?: string[] };

const family = (i: CardItem) => i.movement ?? i.name;
const slugOf = (name: string) => name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/**
 * The cards for the groups that exist, in `CARD_SPECS` order. A part whose group is missing is dropped, a card left
 * with no parts is dropped, and a group no card names (and not hidden) gets a card of its own at the end, so a new
 * group never disappears.
 */
export function libraryCards(groups: Group[], specs: CardSpec[] = CARD_SPECS): LibraryCard[] {
  const byName = new Map(groups.map((g) => [g.name, g]));
  const named = new Set(specs.flatMap((s) => s.parts.map((p) => p.group)));
  const cards = specs
    .map((s) => ({ ...s, parts: s.parts.filter((p) => byName.has(p.group)).map((p) => ({ ...p, id: byName.get(p.group)!.id })) }))
    .filter((c) => c.parts.length > 0);
  const extra = groups
    .filter((g) => !named.has(g.name) && !HIDDEN_GROUPS.includes(g.name))
    .map((g) => ({ slug: slugOf(g.name), name: g.name, art: g.name, parts: [{ group: g.name, id: g.id }] }));
  return [...cards, ...extra];
}

/** A card's own page: by slug, else (an old link) the first card showing that group id, else that group alone. */
export function cardFor(groups: Group[], key: string): LibraryCard | undefined {
  const cards = libraryCards(groups);
  const hit = cards.find((c) => c.slug === key) ?? cards.find((c) => c.parts.some((p) => p.id === key));
  if (hit) return hit;
  const g = groups.find((x) => x.id === key);
  return g ? { slug: slugOf(g.name), name: g.name, art: g.name, parts: [{ group: g.name, id: g.id }] } : undefined;
}

function partHas(p: CardPart, i: CardItem): boolean {
  if (i.group !== p.group) return false;
  if (p.only && !p.only.includes(family(i))) return false;
  if (p.except && p.except.includes(family(i))) return false;
  return true;
}

/** The part an exercise is listed under as primary, if any. */
export function primaryPart<P extends CardPart>(card: { parts: P[] }, i: CardItem): P | undefined {
  return card.parts.find((p) => partHas(p, i));
}

/** Whether the card lists an exercise under Secondary: it names one of the card's groups as a secondary muscle. */
export function isSecondary(card: { parts: CardPart[] }, i: CardItem): boolean {
  if (primaryPart(card, i)) return false;
  return card.parts.some((p) => p.secondary !== false && (i.secondaryGroups ?? []).includes(p.group));
}

/** A part's heading: its label, else its group's name. */
export const partLabel = (p: CardPart) => p.label ?? p.group;
