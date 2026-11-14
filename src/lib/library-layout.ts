/**
 * The Library tab's layout (2026-11-13, a test setting for comparing on the phone). Saved per device in a cookie, as
 * Appearance is; `scroll` unless set.
 *
 * - `scroll`: one scroll of Exercises, Workouts and Programs under the search field (shipped 2026-11-11).
 * - `pills`: the search field, then capsule pills (Exercises, Workouts, Programs) that switch what sits under them,
 *   as Apple Fitness+ switches For You, Explore, Plans and Library. Search still covers the whole Library.
 * - `pills-all`: the same with an All pill first, which is the one scroll.
 */
export const LIBRARY_LAYOUTS = ["scroll", "pills", "pills-all"] as const;
export type LibraryLayout = (typeof LIBRARY_LAYOUTS)[number];

export const LIBRARY_LAYOUT_COOKIE = "library_layout";

export function libraryLayoutFrom(get: (name: string) => string | undefined): LibraryLayout {
  const v = get(LIBRARY_LAYOUT_COOKIE);
  return (LIBRARY_LAYOUTS as readonly string[]).includes(v ?? "") ? (v as LibraryLayout) : "scroll";
}

export function setLibraryLayout(layout: LibraryLayout) {
  document.cookie = `${LIBRARY_LAYOUT_COOKIE}=${layout}; path=/; max-age=31536000; samesite=lax`;
}

export const LIBRARY_TABS = ["all", "exercises", "workouts", "programs"] as const;
export type LibraryTab = (typeof LIBRARY_TABS)[number];

export const TAB_LABELS: Record<LibraryTab, string> = { all: "All", exercises: "Exercises", workouts: "Workouts", programs: "Programs" };

/** The pills a layout shows, in order; none for the one scroll */
export function tabsFor(layout: LibraryLayout): LibraryTab[] {
  if (layout === "pills") return ["exercises", "workouts", "programs"];
  if (layout === "pills-all") return [...LIBRARY_TABS];
  return [];
}

/** The pill to open on: the one picked last on this device if the layout still has it, else the first */
export function initialTab(layout: LibraryLayout, stored: string | null): LibraryTab {
  const tabs = tabsFor(layout);
  return (tabs as string[]).includes(stored ?? "") ? (stored as LibraryTab) : tabs[0] ?? "all";
}

// the last pill is a per-device convenience: an unreadable store just opens the first
export const LIBRARY_TAB_KEY = "library-tab";

export function readLibraryTab(): string | null {
  try {
    return localStorage.getItem(LIBRARY_TAB_KEY);
  } catch {
    return null;
  }
}

export function writeLibraryTab(tab: LibraryTab) {
  try {
    localStorage.setItem(LIBRARY_TAB_KEY, tab);
  } catch {}
}
