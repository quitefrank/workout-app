import { describe, expect, it } from "vitest";
import type { HeatWorkout } from "../heat";
import { heroOf, recentTemplateIds, rowSubtitle, startAsk, startDecision, topRecommendations } from "../start-sheet";

const ex = (group: string) => ({ exerciseId: group, title: group, group, secondaries: [], sets: 3 });

describe("recentTemplateIds", () => {
  it("keeps completed workouts from today and yesterday only", () => {
    const ids = recentTemplateIds(
      [
        { completedAt: "x", templateId: "a", day: "2026-11-13" },
        { completedAt: "x", templateId: "b", day: "2026-11-12" },
        { completedAt: "x", templateId: "c", day: "2026-11-11" },
        { completedAt: null, templateId: "d", day: "2026-11-13" },
        { completedAt: "x", templateId: null, day: "2026-11-13" },
      ],
      "2026-11-13",
    );
    expect([...ids].sort()).toEqual(["a", "b"]);
  });
});

describe("topRecommendations", () => {
  const candidates = [
    { id: "push", name: "Push", category: "push", groups: ["Chest"], slugs: ["bench"], exerciseCount: 6 },
    { id: "legs", name: "Legs", category: "legs", groups: ["Glutes"], slugs: ["squat"], exerciseCount: 5 },
    { id: "run", name: "Run", category: "cardio", groups: ["Cardio"], slugs: [], exerciseCount: 1 },
  ];
  const heat: HeatWorkout[] = [{ day: "2026-11-11", exercises: [ex("Chest")] }];

  it("ranks by rest, with the reason, the count and the slugs", () => {
    expect(topRecommendations(candidates, heat, [], "2026-11-13")).toEqual([
      { id: "legs", name: "Legs", category: "legs", slugs: ["squat"], exerciseCount: 5, reason: "Glutes not trained in two months" },
      { id: "push", name: "Push", category: "push", slugs: ["bench"], exerciseCount: 6, reason: "Chest last trained 2 days ago" },
    ]);
  });
  it("leaves out what was done yesterday and stops at n", () => {
    const done = [{ completedAt: "x", templateId: "legs", day: "2026-11-12" }];
    expect(topRecommendations(candidates, heat, done, "2026-11-13").map((r) => r.id)).toEqual(["push"]);
    expect(topRecommendations(candidates, heat, [], "2026-11-13", 1).map((r) => r.id)).toEqual(["legs"]);
  });
});

describe("heroOf", () => {
  const next = { id: "p1", name: "Push P1", category: "push", variant: "W3", slugs: ["bench"], exerciseCount: 7 };
  const rec = { id: "l", name: "Legs", category: "legs", slugs: [], exerciseCount: 1, reason: "Glutes last trained 9 days ago" };

  it("prefers the program's next workout", () => {
    expect(heroOf(next, rec)).toEqual({ kind: "up-next", title: "Up Next", template: next, subtitle: "Next in the rotation · 7 exercises" });
  });
  it("falls back to Recommended with its reason", () => {
    expect(heroOf(null, rec)).toEqual({ kind: "recommended", title: "Recommended", template: rec, subtitle: "Glutes last trained 9 days ago" });
  });
  it("shows no card with nothing to suggest", () => {
    expect(heroOf(null, null)).toBeNull();
  });
});

describe("rowSubtitle", () => {
  it("adds minutes only when the template has an estimate", () => {
    expect(rowSubtitle(6, null)).toBe("6 exercises");
    expect(rowSubtitle(1, 45)).toBe("1 exercise · 45 min");
  });
});

describe("startAsk", () => {
  it("starts straight away with nothing in progress", () => {
    expect(startAsk(null, "Legs")).toBeNull();
  });
  it("asks to exit early or resume the workout in progress", () => {
    expect(startAsk({ name: "Full Body P2" }, "Push P1")).toEqual({
      title: "Workout in Progress",
      message: "Full Body P2 is still in progress. Exit it early to start Push P1?",
      discard: "Exit Early and Start",
      resume: "Resume Full Body P2",
    });
  });
});

describe("startDecision", () => {
  it("starts when nothing is in progress, whatever it names", () => {
    expect(startDecision(null, undefined)).toBe("start");
    expect(startDecision(null, "gone")).toBe("start");
  });
  it("refuses a second workout while one is in progress", () => {
    expect(startDecision("w1", undefined)).toBe("refuse");
    expect(startDecision("w1", null)).toBe("refuse");
    expect(startDecision("w1", "w2")).toBe("refuse");
  });
  it("replaces the in-progress workout only when the start names it", () => {
    expect(startDecision("w1", "w1")).toBe("replace");
  });
});
