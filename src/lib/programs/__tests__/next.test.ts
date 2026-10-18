import { describe, expect, it } from "vitest";
import { nextInSequence, nextTemplates, phaseInForce, type ProgramPhase } from "../next";

const RECOVERY: ProgramPhase[] = [
  { id: "p1", position: 1, weekFrom: 0, weekTo: 2, templates: [] },
  { id: "p6", position: 6, weekFrom: 6, weekTo: 8, templates: [] },
  { id: "p7", position: 7, weekFrom: 8, weekTo: 12, templates: [] },
  { id: "p8", position: 8, weekFrom: 12, weekTo: null, templates: [] },
];

describe("phaseInForce", () => {
  it("takes a phase the user chose over everything else", () => {
    const r = phaseInForce(RECOVERY, { chosenPosition: 6, loggedPhaseId: "p1", logStale: false, week: 9 });
    expect(r).toMatchObject({ phase: { position: 6 }, reason: "chosen" });
  });

  it("takes the clearance log's phase while the log is current", () => {
    const r = phaseInForce(RECOVERY, { chosenPosition: null, loggedPhaseId: "p6", logStale: false, week: 9 });
    expect(r).toMatchObject({ phase: { position: 6 }, reason: "log", calendarPosition: 7 });
  });

  it("falls back to the calendar when the log is stale, and says what the log said", () => {
    const r = phaseInForce(RECOVERY, { chosenPosition: null, loggedPhaseId: "p1", logStale: true, week: 9 });
    expect(r).toMatchObject({ phase: { position: 7 }, reason: "calendar", loggedPosition: 1 });
  });

  it("reads an open-ended last phase from the calendar", () => {
    const r = phaseInForce(RECOVERY, { chosenPosition: null, loggedPhaseId: null, logStale: false, week: 40 });
    expect(r.phase?.position).toBe(8);
  });

  it("ignores a chosen position that is not a phase", () => {
    const r = phaseInForce(RECOVERY, { chosenPosition: 99, loggedPhaseId: null, logStale: false, week: 9 });
    expect(r).toMatchObject({ phase: { position: 7 }, reason: "calendar" });
  });

  it("starts a programme with no calendar at its first phase", () => {
    const r = phaseInForce(RECOVERY, { chosenPosition: null, loggedPhaseId: null, logStale: false, week: null });
    expect(r).toMatchObject({ phase: { position: 1 }, reason: "start" });
  });
});

const t = (id: string, category: string | null = "push") => ({ id, name: id, category });

describe("nextInSequence", () => {
  const weeks: ProgramPhase[] = [
    { id: "w1", position: 1, weekFrom: 0, weekTo: 1, templates: [t("w1a"), t("w1b")] },
    { id: "w2", position: 2, weekFrom: 1, weekTo: 2, templates: [t("w2a"), t("w2b")] },
  ];

  it("starts at the first day of the first week", () => {
    expect(nextInSequence(weeks, [])).toMatchObject({ template: { id: "w1a" }, phase: { position: 1 }, finished: false });
  });

  it("moves to the day after the most recent one completed, across a week boundary", () => {
    expect(nextInSequence(weeks, [{ templateId: "w1b", completedAt: "2026-10-10T10:00:00Z" }])).toMatchObject({
      template: { id: "w2a" },
      phase: { position: 2 },
    });
  });

  it("goes by the latest completion, not the furthest day, so a repeated week stays repeated", () => {
    const r = nextInSequence(weeks, [
      { templateId: "w2a", completedAt: "2026-10-10T10:00:00Z" },
      { templateId: "w1a", completedAt: "2026-10-12T10:00:00Z" },
    ]);
    expect(r.template?.id).toBe("w1b");
  });

  it("says the programme is finished after its last day", () => {
    const r = nextInSequence(weeks, [{ templateId: "w2b", completedAt: "2026-10-10T10:00:00Z" }]);
    expect(r).toMatchObject({ template: null, finished: true });
  });
});

describe("nextTemplates", () => {
  const phase: ProgramPhase = {
    id: "p7",
    position: 7,
    weekFrom: 8,
    weekTo: 12,
    templates: [t("rehab", "rehab"), t("push"), t("pull", "pull"), t("legs", "legs")],
  };

  it("keeps rehab apart from the training rotation and starts the rotation at the top", () => {
    const r = nextTemplates(phase, []);
    expect(r.rehab.map((x) => x.id)).toEqual(["rehab"]);
    expect(r.next?.id).toBe("push");
  });

  it("suggests the template after the last one completed, wrapping round", () => {
    expect(nextTemplates(phase, [{ templateId: "push", completedAt: "2026-10-16T10:00:00Z" }]).next?.id).toBe("pull");
    expect(
      nextTemplates(phase, [
        { templateId: "pull", completedAt: "2026-10-15T10:00:00Z" },
        { templateId: "legs", completedAt: "2026-10-17T10:00:00Z" },
      ]).next?.id,
    ).toBe("push");
  });

  it("does not let a rehab session move the rotation", () => {
    const r = nextTemplates(phase, [
      { templateId: "push", completedAt: "2026-10-16T10:00:00Z" },
      { templateId: "rehab", completedAt: "2026-10-17T10:00:00Z" },
    ]);
    expect(r.next?.id).toBe("pull");
    expect(r.lastRehab?.templateId).toBe("rehab");
  });

  it("has no next when the phase holds only rehab", () => {
    const r = nextTemplates({ ...phase, templates: [t("rehab", "rehab")] }, []);
    expect(r.next).toBeNull();
    expect(r.rehab).toHaveLength(1);
  });
});
