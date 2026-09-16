import { describe, expect, it } from "vitest";
import { frequencyViolation } from "../frequency";
import type { AuthoringExercise } from "../types";

const pullUps: AuthoringExercise = {
  id: "pull-ups",
  name: "Pull-ups",
  muscleGroup: "Back",
  supportRequired: "hanging",
  loadDirection: "vertical",
  loadsBootedFoot: false,
  ankleInvolvement: false,
  floorTransferRequired: false,
  equipmentNeeded: ["pull_up_bar"],
  minHoursBetweenSessions: 72,
  maxSessionsPerWeek: 2,
};

const row: AuthoringExercise = { ...pullUps, id: "row", name: "Row", minHoursBetweenSessions: null, maxSessionsPerWeek: null };

function s(completedAt: string, exerciseIds: string[]) {
  return { completedAt, date: completedAt.slice(0, 10), exerciseIds };
}

describe("frequencyViolation", () => {
  const history = [s("2000-03-06T18:00:00Z", ["pull-ups", "row"])];

  it("returns null for an exercise with no caps", () => {
    expect(frequencyViolation(row, history, "2000-03-07T18:00:00Z", "2000-03-07")).toBeNull();
  });

  it("warns inside the minimum gap", () => {
    const v = frequencyViolation(pullUps, history, "2000-03-08T18:00:00Z", "2000-03-08");
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/48 of 72 hours/);
  });

  it("passes at exactly the minimum gap", () => {
    expect(frequencyViolation(pullUps, history, "2000-03-09T18:00:00Z", "2000-03-09")).toBeNull();
  });

  it("ignores sessions after the proposed time", () => {
    const later = [s("2000-03-10T18:00:00Z", ["pull-ups"])];
    expect(frequencyViolation(pullUps, later, "2000-03-09T18:00:00Z", "2000-03-09")).toBeNull();
  });

  it("warns when the weekly cap would be exceeded", () => {
    const twoThisWeek = [
      s("2000-03-06T18:00:00Z", ["pull-ups"]), // Monday
      s("2000-03-09T18:00:00Z", ["pull-ups"]), // Thursday
    ];
    const v = frequencyViolation(pullUps, twoThisWeek, "2000-03-12T18:00:00Z", "2000-03-12"); // Sunday
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/2 per week/);
  });

  it("resets the weekly count on Monday", () => {
    const twoLastWeek = [
      s("2000-03-06T18:00:00Z", ["pull-ups"]),
      s("2000-03-09T18:00:00Z", ["pull-ups"]),
    ];
    expect(frequencyViolation(pullUps, twoLastWeek, "2000-03-13T18:00:00Z", "2000-03-13")).toBeNull();
  });

  it("counts the week by the logged calendar date, not the UTC instant", () => {
    // A Sunday 20:00 Toronto session is Monday 00:00 UTC. It belongs to Sunday's week.
    const twoThisWeek = [
      s("2000-03-07T22:00:00Z", ["pull-ups"]), // Tuesday evening Toronto
      s("2000-03-10T22:00:00Z", ["pull-ups"]), // Friday evening Toronto
    ];
    const v = frequencyViolation(pullUps, twoThisWeek, "2000-03-13T00:00:00Z", "2000-03-12");
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/session 3 this week/);
  });

  it("validates every timestamp and date up front", () => {
    expect(() => frequencyViolation(row, [s("yesterday", ["row"])], "2000-03-07T18:00:00Z", "2000-03-07")).toThrow(/Not a timestamp/);
    expect(() => frequencyViolation(row, [{ completedAt: "2000-03-06T18:00:00Z", date: "3/6", exerciseIds: [] }], "2000-03-07T18:00:00Z", "2000-03-07")).toThrow(/Not an ISO date/);
    expect(() => frequencyViolation(row, [], "2000-03-07T18:00:00Z", "March 7")).toThrow(/Not an ISO date/);
  });
});
