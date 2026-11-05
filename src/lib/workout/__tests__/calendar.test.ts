import { describe, expect, it } from "vitest";
import { dotsByDay } from "../calendar";

describe("dotsByDay", () => {
  it("holds every day of the range, inclusive, empty or not", () => {
    expect(Object.keys(dotsByDay([], "2026-10-31", "2026-11-02"))).toEqual(["2026-10-31", "2026-11-01", "2026-11-02"]);
  });

  it("marks done and unfinished workouts, and drops days outside the range", () => {
    const days = dotsByDay(
      [
        { id: "a", day: "2026-11-01", category: "push", completedAt: "2026-11-01T12:00:00Z" },
        { id: "b", day: "2026-11-01", category: null, completedAt: null },
        { id: "c", day: "2026-12-01", category: "pull", completedAt: null },
      ],
      "2026-11-01",
      "2026-11-02",
    );
    expect(days["2026-11-01"]).toEqual([
      { id: "a", category: "push", done: true },
      { id: "b", category: null, done: false },
    ]);
    expect(days["2026-11-02"]).toEqual([]);
    expect(days["2026-12-01"]).toBeUndefined();
  });
});
