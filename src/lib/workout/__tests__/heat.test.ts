import { describe, expect, it } from "vitest";
import {
  heatOf,
  heatPercent,
  heatState,
  lastTrained,
  recommend,
  recommendReason,
  stateLine,
  windowStart,
  type HeatWorkout,
} from "../heat";

const bench = { exerciseId: "b", title: "Bench Press", group: "Chest", secondaries: ["Triceps", "Shoulders"], sets: 3 };
const curl = { exerciseId: "c", title: "Curl", group: "Biceps", secondaries: ["Forearms"], sets: 4 };
const walk = { exerciseId: "w", title: "Warm up Walk", group: "Cardio", secondaries: [], sets: 1 };

describe("windowStart", () => {
  it("rolling takes today and the six days before", () => {
    expect(windowStart("2026-07-21", "rolling")).toBe("2026-07-15");
  });
  it("week starts on Monday", () => {
    expect(windowStart("2026-07-21", "week")).toBe("2026-07-20"); // a Tuesday
    expect(windowStart("2026-07-20", "week")).toBe("2026-07-20");
    expect(windowStart("2026-07-26", "week")).toBe("2026-07-20"); // Sunday closes the week
  });
});

describe("heatOf", () => {
  const workouts: HeatWorkout[] = [
    { day: "2026-07-14", exercises: [bench] }, // outside rolling
    { day: "2026-07-16", exercises: [bench, walk] },
    { day: "2026-07-21", exercises: [bench, curl] },
    { day: "2026-07-22", exercises: [curl] }, // future
    { day: "2026-07-21", exercises: [{ ...curl, sets: 0 }] }, // nothing logged
  ];
  it("counts the main group as 1 and secondaries as half", () => {
    const h = heatOf(workouts, "2026-07-21", "rolling");
    expect(h.sets.Chest).toBe(6);
    expect(h.sets.Triceps).toBe(3);
    expect(h.sets.Biceps).toBe(4);
    expect(h.sets.Forearms).toBe(2);
    expect(h.workouts).toBe(2);
    expect(h.workingSets).toBe(11); // the walk counts as a working set, though it draws nothing
  });
  it("stepped: a set leaves when its day leaves the window", () => {
    expect(heatOf(workouts, "2026-07-21", "week").sets.Chest).toBe(3);
  });
  it("keeps where each count came from, direct first", () => {
    const h = heatOf(workouts, "2026-07-21", "rolling");
    expect(h.sources.Chest).toEqual([{ exerciseId: "b", title: "Bench Press", sets: 6, share: 1 }]);
    expect(h.sources.Shoulders).toEqual([{ exerciseId: "b", title: "Bench Press", sets: 6, share: 0.5 }]);
  });
});

describe("heatPercent", () => {
  it("ramps to the range, jumps at 10 and tops out at 20", () => {
    expect(heatPercent(0)).toBe(0);
    expect(heatPercent(5)).toBe(41);
    expect(heatPercent(10)).toBe(70);
    expect(heatPercent(15)).toBe(85);
    expect(heatPercent(20)).toBe(100);
    expect(heatPercent(30)).toBe(100);
  });
  it("states", () => {
    expect([0, 4, 10, 21].map((n) => heatState(n))).toEqual(["none", "short", "range", "past"]);
    expect(stateLine(6.5)).toBe("3.5 short of 10");
  });
});

describe("recommend", () => {
  const templates = [
    { id: "push", name: "Push", category: "push", groups: ["Chest", "Shoulders", "Triceps"] },
    { id: "legs", name: "Legs", category: "legs", groups: ["Quadriceps", "Glutes"] },
    { id: "run", name: "Run", category: "cardio", groups: ["Cardio"] },
    { id: "empty", name: "Empty", category: "arms", groups: [] },
  ];
  const workouts: HeatWorkout[] = [
    { day: "2026-07-20", exercises: [bench] },
    { day: "2026-07-01", exercises: [{ exerciseId: "s", title: "Squat", group: "Quadriceps", secondaries: ["Glutes"], sets: 3 }] },
  ];
  it("ranks the longest rested first, leaving out cardio, empties and recent ones", () => {
    const last = lastTrained(workouts, "2026-07-21");
    expect(last).toEqual({ Chest: "2026-07-20", Quadriceps: "2026-07-01" });
    const recs = recommend(templates, last, "2026-07-21", new Set());
    expect(recs.map((r) => r.template.id)).toEqual(["legs", "push"]);
    expect(recs[0]).toMatchObject({ group: "Glutes", days: null });
    expect(recommend(templates, last, "2026-07-21", new Set(["legs"])).map((r) => r.template.id)).toEqual(["push"]);
  });
  it("words the reason", () => {
    expect(recommendReason("Glutes", null)).toBe("Glutes not trained in two months");
    expect(recommendReason("Glutes", 20)).toBe("Glutes last trained over two weeks ago");
    expect(recommendReason("Back", 1)).toBe("Back last trained yesterday");
    expect(recommendReason("Back", 3)).toBe("Back last trained 3 days ago");
  });
});
