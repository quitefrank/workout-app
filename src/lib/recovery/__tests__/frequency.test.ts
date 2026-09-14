import { describe, expect, it } from "vitest";
import { frequencyViolation, isoWeekStart } from "../frequency";
import type { AuthoringExercise } from "../types";

const pullUps: AuthoringExercise = {
  id: "pull-ups",
  name: "Pull-ups",
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

describe("isoWeekStart", () => {
  it("returns the Monday of the week, as an ISO date", () => {
    expect(isoWeekStart("2000-03-01T10:00:00Z")).toBe("2000-02-28"); // Wednesday
    expect(isoWeekStart("2000-02-28T00:00:00Z")).toBe("2000-02-28"); // Monday
    expect(isoWeekStart("2000-03-05T23:00:00Z")).toBe("2000-02-28"); // Sunday
  });
});

describe("frequencyViolation", () => {
  const history = [
    { completedAt: "2000-03-06T18:00:00Z", exerciseIds: ["pull-ups", "row"] },
  ];

  it("returns null for an exercise with no caps", () => {
    expect(frequencyViolation(row, history, "2000-03-07T18:00:00Z")).toBeNull();
  });

  it("warns inside the minimum gap", () => {
    const v = frequencyViolation(pullUps, history, "2000-03-08T18:00:00Z");
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/48 of 72 hours/);
  });

  it("passes at exactly the minimum gap", () => {
    expect(frequencyViolation(pullUps, history, "2000-03-09T18:00:00Z")).toBeNull();
  });

  it("ignores sessions after the proposed time", () => {
    const later = [{ completedAt: "2000-03-10T18:00:00Z", exerciseIds: ["pull-ups"] }];
    expect(frequencyViolation(pullUps, later, "2000-03-09T18:00:00Z")).toBeNull();
  });

  it("warns when the weekly cap would be exceeded", () => {
    const twoThisWeek = [
      { completedAt: "2000-03-06T18:00:00Z", exerciseIds: ["pull-ups"] }, // Monday
      { completedAt: "2000-03-09T18:00:00Z", exerciseIds: ["pull-ups"] }, // Thursday
    ];
    const v = frequencyViolation(pullUps, twoThisWeek, "2000-03-12T18:00:00Z"); // Sunday, 72h later
    expect(v).toMatchObject({ level: "warn" });
    expect(v?.reason).toMatch(/2 per week/);
  });

  it("resets the weekly count on Monday", () => {
    const twoLastWeek = [
      { completedAt: "2000-03-06T18:00:00Z", exerciseIds: ["pull-ups"] },
      { completedAt: "2000-03-09T18:00:00Z", exerciseIds: ["pull-ups"] },
    ];
    expect(frequencyViolation(pullUps, twoLastWeek, "2000-03-13T18:00:00Z")).toBeNull();
  });
});
