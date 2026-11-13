import { describe, expect, it } from "vitest";
import { backAction, installNavIndex, NAV_KEY, readIdx, stampState } from "../nav-index";

/** A minimal browser history: entries, a cursor, push drops forward entries, back and forward move the cursor. */
function fakeHistory() {
  const entries: { state: unknown; url: string }[] = [{ state: null, url: "/" }];
  let i = 0;
  const h = {
    get state() {
      return entries[i].state;
    },
    get url() {
      return entries[i].url;
    },
    get length() {
      return entries.length;
    },
    pushState(state: unknown, _u: string, url?: string | URL | null) {
      entries.splice(i + 1);
      entries.push({ state, url: String(url ?? entries[i].url) });
      i++;
    },
    replaceState(state: unknown, _u: string, url?: string | URL | null) {
      entries[i] = { state, url: String(url ?? entries[i].url) };
    },
    back() {
      if (i > 0) i--;
    },
    forward() {
      if (i < entries.length - 1) i++;
    },
  };
  return h;
}

/** What the app's Back does, as BackButton runs it, on the fake history. */
function tapBack(h: ReturnType<typeof fakeHistory>, fallback: string) {
  const a = backAction(readIdx(h.state), fallback);
  if (a.type === "back") h.back();
  else h.replaceState({ next: true }, "", a.href); // Next's router.replace
}

describe("readIdx", () => {
  it("reads the number, and 0 when missing or garbage", () => {
    expect(readIdx({ [NAV_KEY]: 3 })).toBe(3);
    expect(readIdx(null)).toBe(0);
    expect(readIdx(undefined)).toBe(0);
    expect(readIdx("x")).toBe(0);
    expect(readIdx({ [NAV_KEY]: "2" })).toBe(0);
    expect(readIdx({ [NAV_KEY]: -1 })).toBe(0);
    expect(readIdx({ [NAV_KEY]: 1.5 })).toBe(0);
  });
});

describe("stampState", () => {
  it("adds one on a push and keeps the number on a replace", () => {
    expect(stampState({}, "push", 2)[NAV_KEY]).toBe(3);
    expect(stampState({}, "replace", 2)[NAV_KEY]).toBe(2);
  });
  it("keeps every key Next wrote", () => {
    const s = stampState({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { a: 1 } }, "push", 0);
    expect(s).toEqual({ __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: { a: 1 }, [NAV_KEY]: 1 });
  });
  it("treats empty state as an empty object", () => {
    expect(stampState(null, "replace", 0)).toEqual({ [NAV_KEY]: 0 });
  });
});

describe("backAction", () => {
  it("goes back when a page of ours is behind, else replaces with the parent", () => {
    expect(backAction(1, "/library")).toEqual({ type: "back" });
    expect(backAction(0, "/library")).toEqual({ type: "replace", href: "/library" });
  });
});

describe("installNavIndex", () => {
  it("numbers pushes, keeps replaces and refreshes, and restores numbers on back and forward", () => {
    const h = fakeHistory();
    installNavIndex(h);
    expect(readIdx(h.state)).toBe(0);
    h.pushState({ next: 1 }, "", "/library"); // a Link push
    expect(readIdx(h.state)).toBe(1);
    h.pushState({ next: 2 }, "", "/templates/x");
    expect(readIdx(h.state)).toBe(2);
    h.replaceState({ refreshed: true }, ""); // router.refresh wipes Next's state
    expect(readIdx(h.state)).toBe(2);
    h.replaceState({ next: 3 }, "", "/templates/x?start=1"); // a query-only replace
    expect(readIdx(h.state)).toBe(2);
    h.back();
    expect(readIdx(h.state)).toBe(1);
    h.back();
    expect(readIdx(h.state)).toBe(0);
    h.forward();
    expect(readIdx(h.state)).toBe(1);
  });
  it("installs once", () => {
    const h = fakeHistory();
    installNavIndex(h);
    installNavIndex(h);
    h.pushState({}, "", "/a");
    expect(readIdx(h.state)).toBe(1);
  });
});

describe("the reported loop", () => {
  it("Library > Workouts, a workout, Back, Back ends on Library and never alternates", () => {
    const h = fakeHistory();
    installNavIndex(h);
    h.pushState({}, "", "/library");
    h.pushState({}, "", "/library/workouts");
    h.pushState({}, "", "/templates/x");
    tapBack(h, "/library/workouts"); // the workout's Back
    expect(h.url).toBe("/library/workouts");
    tapBack(h, "/library"); // Workouts' Back
    expect(h.url).toBe("/library");
    expect(h.length).toBe(4);
  });
  it("a cold-opened workout falls back to its parent, then the Library, without growing history", () => {
    const h = fakeHistory();
    h.replaceState(null, "", "/templates/x");
    installNavIndex(h);
    tapBack(h, "/library/workouts");
    expect(h.url).toBe("/library/workouts");
    tapBack(h, "/library");
    expect(h.url).toBe("/library");
    expect(h.length).toBe(1);
  });
  it("a cold-opened exercise that switches version (a replace) still falls back, never leaves the app", () => {
    const h = fakeHistory();
    h.replaceState(null, "", "/exercises/a");
    installNavIndex(h);
    h.replaceState({}, "", "/exercises/b"); // exercise-detail's router.replace
    tapBack(h, "/library/exercises");
    expect(h.url).toBe("/library/exercises");
  });
});
