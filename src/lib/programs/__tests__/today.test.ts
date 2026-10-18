import { describe, expect, it } from "vitest";
import { programToday } from "../today";
import type { ProgramPhase } from "../next";
import type { Clearance } from "../../recovery/types";

const t = (id: string, category = "push") => ({ id, name: id, category });

const PHASES: ProgramPhase[] = [
  { id: "p5", position: 5, weekFrom: 5, weekTo: 6, templates: [t("push"), t("pull", "pull")] },
  { id: "p6", position: 6, weekFrom: 6, weekTo: 8, templates: [t("rehab68", "rehab"), t("push"), t("pull", "pull")] },
  { id: "p7", position: 7, weekFrom: 8, weekTo: 12, templates: [t("physio", "rehab"), t("e3-2", "rehab"), t("push")] },
];

const clearance = (effectiveFrom: string, createdAt: string, phaseId: string): Clearance => ({
  effectiveFrom,
  createdAt,
  kind: "weight_bearing",
  valuePct: 100,
  valueText: null,
  phaseId,
  source: "planned",
  voidedAt: null,
});

describe("programToday, recovery", () => {
  const base = {
    kind: "recovery" as const,
    phases: PHASES,
    completions: [],
    injuryDate: "2000-01-03",
    chosenPosition: null,
  };

  it("counts the day and week from day 0 and reads the phase off the calendar when the log is stale", () => {
    const r = programToday({ ...base, today: "2000-03-11", clearances: [clearance("2000-02-07", "2000-01-20T10:00:00Z", "p5")] });
    if (r.kind !== "recovery") throw new Error();
    expect(r.day).toBe(68);
    expect(r.week).toBe(9);
    expect(r.logStale).toBe(true);
    expect(r.inForce).toMatchObject({ reason: "calendar", phase: { position: 7 }, loggedPosition: 5 });
    expect(r.rehab.map((x) => x.id)).toEqual(["physio", "e3-2"]);
    expect(r.next?.id).toBe("push");
  });

  it("follows a current clearance log over the calendar", () => {
    const r = programToday({ ...base, today: "2000-03-11", clearances: [clearance("2000-03-01", "2000-03-01T10:00:00Z", "p6")] });
    expect(r.inForce).toMatchObject({ reason: "log", phase: { position: 6 }, calendarPosition: 7 });
  });

  it("shows the phase one week behind only where it differs", () => {
    const atBoundary = programToday({ ...base, today: "2000-02-28", clearances: [] });
    if (atBoundary.kind !== "recovery") throw new Error();
    expect(atBoundary.week).toBe(8);
    expect(atBoundary.weekBehindPosition).toBe(6);
    const inside = programToday({ ...base, today: "2000-03-11", clearances: [] });
    if (inside.kind !== "recovery") throw new Error();
    expect(inside.weekBehindPosition).toBeNull();
  });

  it("takes a phase set by hand", () => {
    const r = programToday({ ...base, today: "2000-03-11", clearances: [], chosenPosition: 6 });
    expect(r.inForce).toMatchObject({ reason: "chosen", phase: { position: 6 } });
  });
});

describe("programToday, training", () => {
  it("runs the days in sequence", () => {
    const r = programToday({
      kind: "training",
      phases: PHASES.slice(0, 2),
      completions: [{ templateId: "pull", completedAt: "2000-01-10T10:00:00Z" }],
      today: "2000-01-11",
      injuryDate: null,
      clearances: [],
      chosenPosition: null,
    });
    expect(r).toMatchObject({ kind: "training", next: { id: "rehab68" }, inForce: { phase: { position: 6 } } });
  });
});
