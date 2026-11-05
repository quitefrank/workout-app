import { describe, expect, it } from "vitest";
import { metricBest, metricSeries, type ExerciseSession } from "../exercise-metrics";

const set = (weight: number | null, reps: number | null, warmUp = false, number = 1) => ({ number, warmUp, weight, reps, seconds: null });
const session = (completedAt: string, sets: ExerciseSession["sets"]): ExerciseSession => ({ workoutId: completedAt, name: "Push", completedAt, sets });

const sessions = [
  session("2026-10-01T10:00:00Z", [set(135, 5, true), set(100, 10), set(110, 5)]),
  session("2026-10-08T10:00:00Z", [set(110, 5)]),
  session("2026-10-15T10:00:00Z", [set(90, 15)]),
];

describe("metricSeries", () => {
  it("takes each session's heaviest working set and ignores warm-ups", () => {
    expect(metricSeries(sessions, "heaviest").map((p) => p.value)).toEqual([110, 110, 90]);
  });
  it("scores volume as weight times reps", () => {
    expect(metricSeries(sessions, "volume").map((p) => p.value)).toEqual([1000, 550, 1350]);
  });
  it("skips sessions with no working set", () => {
    expect(metricSeries([session("2026-10-01T10:00:00Z", [set(null, 10), set(50, null), set(50, 5, true)])], "e1rm")).toEqual([]);
  });
});

describe("metricBest", () => {
  it("keeps the earliest session on a tie", () => {
    expect(metricBest(sessions, "heaviest")?.at).toBe("2026-10-01T10:00:00Z");
  });
  it("finds the best volume wherever it falls", () => {
    expect(metricBest(sessions, "volume")).toMatchObject({ weight: 90, reps: 15 });
  });
  it("is null with nothing logged", () => {
    expect(metricBest([], "e1rm")).toBeNull();
  });
});
