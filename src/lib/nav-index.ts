/**
 * Where the current history entry sits in this visit to the app, so the toolbar's Back knows whether the page before
 * it is ours. Every entry carries `__navIdx`: the first page opened is 0, a push adds one, a replace keeps it. History
 * going back or forward restores the entry's own number. `history.length` cannot say this: it counts forward entries
 * and pages from other sites, and is 1 in a home screen app opened straight onto a page.
 *
 * Back at 0 has no page of ours behind it, so it replaces the page with its parent. It must replace, never push: a
 * push leaves the cold-opened page one step back, and the parent's own Back then returns to it, which is the loop this
 * fixes (2026-11-13: the workout page's Back was a link to Library > Workouts, whose Back went back to the workout).
 *
 * The stamp is written by wrapping `history.pushState` and `replaceState` (installNavIndex): Next's router rewrites
 * `history.state` on its own pushes, replaces and refreshes and drops any key it did not write, so the number is added
 * inside the call itself.
 */

export const NAV_KEY = "__navIdx";

export type BackAction = { type: "back" } | { type: "replace"; href: string };

/** The entry's number; 0 when it has none (a cold open, or state written before the stamp existed). */
export function readIdx(state: unknown): number {
  if (!state || typeof state !== "object") return 0;
  const v = (state as Record<string, unknown>)[NAV_KEY];
  return typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : 0;
}

/** The state to write for a push or replace from the entry numbered `current`, keeping every key Next wrote. */
export function stampState(state: unknown, kind: "push" | "replace", current: number): Record<string, unknown> {
  const base = state && typeof state === "object" ? (state as Record<string, unknown>) : {};
  return { ...base, [NAV_KEY]: kind === "push" ? current + 1 : current };
}

/** What the toolbar's Back does: history back when a page of ours is behind this one, else replace with the parent. */
export function backAction(idx: number, fallback: string): BackAction {
  return idx > 0 ? { type: "back" } : { type: "replace", href: fallback };
}

type HistoryLike = Pick<History, "pushState" | "replaceState" | "state">;

const INSTALLED = Symbol.for("workout-app.nav-index");

/** Wraps the history's pushState and replaceState once to stamp every entry, and stamps the entry already there. */
export function installNavIndex(history: HistoryLike & { [INSTALLED]?: true }) {
  if (history[INSTALLED]) return;
  history[INSTALLED] = true;
  const push = history.pushState.bind(history);
  const replace = history.replaceState.bind(history);
  history.pushState = (data: unknown, unused: string, url?: string | URL | null) =>
    push(stampState(data, "push", readIdx(history.state)), unused, url);
  history.replaceState = (data: unknown, unused: string, url?: string | URL | null) =>
    replace(stampState(data, "replace", readIdx(history.state)), unused, url);
  // the entry the app opened on (or a reload of any entry, which keeps its number)
  history.replaceState(history.state, "");
}
