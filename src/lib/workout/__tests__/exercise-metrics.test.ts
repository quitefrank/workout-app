import { describe, expect, it } from "vitest";
import { latestFloor, metricBest, metricSeries, sessionsOnFloor, type ExerciseSession } from "../exercise-metrics";

const set = (weight: number | null, reps: number | null, warmUp = false, number = 1) => ({ number, warmUp, dropSet: false, weight, reps, seconds: null });
const session = (completedAt: string, sets: ExerciseSession["sets"]): ExerciseSession => ({ workoutId: completedAt, name: "Push", completedAt, floor: null, sets });

const sessions = [
  session("2026-10-01T10:00:00Z", [set(135, 5, true), set(100, 10), set(110, 5)]),
  session("2026-10-08T10:00:00Z", [set(110, 5)]),
  session("2026-10-15T10:00:00Z", [set(90, 15)]),
];

describe("metricSeries", () => {
  it("takes each session's heaviest working set and ignores warm-ups", () => {
    expect(metricSeries(sessions, "heaviest").map((p) => p.value)).toEqual([110, 110, 90]);
  });
  it("skips sessions with no working set", () => {
    expect(metricSeries([session("2026-10-01T10:00:00Z", [set(null, 10), set(50, null), set(50, 5, true)])], "e1rm")).toEqual([]);
  });
});

describe("drop sets", () => {
  it("never count as a session's best set", () => {
    const drop = { ...set(100, 30), dropSet: true };
    const s = session("2026-10-01T10:00:00Z", [set(150, 8), drop]);
    expect(metricSeries([s], "e1rm").map((p) => p.weight)).toEqual([150]);
  });
});

describe("metricBest", () => {
  it("keeps the earliest session on a tie", () => {
    expect(metricBest(sessions, "heaviest")?.at).toBe("2026-10-01T10:00:00Z");
  });
  it("finds the best one rep max wherever it falls", () => {
    expect(metricBest(sessions, "e1rm")).toMatchObject({ weight: 90, reps: 15 });
  });
  it("is null with nothing logged", () => {
    expect(metricBest([], "e1rm")).toBeNull();
  });
});

describe("floors", () => {
  const up = { ...session("2026-10-01T10:00:00Z", [set(40, 10)]), floor: "upstairs" as const };
  const down = { ...session("2026-10-08T10:00:00Z", [set(130, 10)]), floor: "downstairs" as const };

  it("works out PRs over one floor only", () => {
    expect(metricBest(sessionsOnFloor([up, down], "upstairs"), "heaviest")?.weight).toBe(40);
    expect(metricBest(sessionsOnFloor([up, down], "downstairs"), "heaviest")?.weight).toBe(130);
  });
  it("finds the floor used most recently", () => {
    expect(latestFloor([up, down])).toBe("downstairs");
    expect(latestFloor([down, up])).toBe("downstairs");
    expect(latestFloor(sessions)).toBeNull();
  });
});
