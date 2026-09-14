import { describe, expect, it } from "vitest";
import { restrictionState, STALE_AFTER_DAYS } from "../state";
import type { Clearance } from "../types";

function c(partial: Partial<Clearance> & Pick<Clearance, "effectiveFrom" | "kind">): Clearance {
  return {
    createdAt: `${partial.effectiveFrom}T00:00:00Z`,
    valuePct: null,
    valueText: null,
    phaseId: null,
    source: "clinic",
    voidedAt: null,
    ...partial,
  };
}

describe("restrictionState", () => {
  it("starts at zero load, boot on, nothing cleared, when there are no clearances", () => {
    const s = restrictionState([], "2000-03-01");
    expect(s).toEqual({
      clearedLoadPct: 0,
      ankleRomCleared: false,
      bootStatus: "on",
      wedgesRemoved: 0,
      strengthGate: null,
      currentPhaseId: null,
      daysSinceLastClearance: null,
      isStale: false,
    });
  });

  it("takes the latest effective weight-bearing clearance", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 0, phaseId: "p0" }),
        c({ effectiveFrom: "2000-03-22", kind: "weight_bearing", valuePct: 25, phaseId: "p1" }),
        c({ effectiveFrom: "2000-03-29", kind: "weight_bearing", valuePct: 50, phaseId: "p2", source: "self" }),
      ],
      "2000-03-30",
    );
    expect(s.clearedLoadPct).toBe(50);
    expect(s.currentPhaseId).toBe("p2");
  });

  it("ignores a clearance whose effective date is still ahead", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25, phaseId: "p1" }),
        c({ effectiveFrom: "2000-04-01", kind: "weight_bearing", valuePct: 75, phaseId: "p3", source: "planned" }),
      ],
      "2000-03-15",
    );
    expect(s.clearedLoadPct).toBe(25);
    expect(s.currentPhaseId).toBe("p1");
  });

  it("ignores a voided clearance", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
        c({ effectiveFrom: "2000-03-08", kind: "weight_bearing", valuePct: 75, voidedAt: "2000-03-09T10:00:00Z" }),
      ],
      "2000-03-10",
    );
    expect(s.clearedLoadPct).toBe(25);
  });

  it("clears ankle range of motion only when an ankle_rom clearance exists", () => {
    expect(restrictionState([c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 100 })], "2000-03-02").ankleRomCleared).toBe(false);
    expect(restrictionState([c({ effectiveFrom: "2000-03-01", kind: "ankle_rom" })], "2000-03-02").ankleRomCleared).toBe(true);
  });

  it("walks boot status from on to weaning to off", () => {
    const weaning = [c({ effectiveFrom: "2000-05-01", kind: "boot_weaning" })];
    const off = [...weaning, c({ effectiveFrom: "2000-05-05", kind: "out_of_boot" })];
    expect(restrictionState([], "2000-05-10").bootStatus).toBe("on");
    expect(restrictionState(weaning, "2000-05-10").bootStatus).toBe("weaning");
    expect(restrictionState(off, "2000-05-10").bootStatus).toBe("off");
  });

  it("counts wedge removals", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-04-12", kind: "wedge_removal" }),
        c({ effectiveFrom: "2000-04-19", kind: "wedge_removal" }),
        c({ effectiveFrom: "2000-04-26", kind: "wedge_removal", voidedAt: "2000-04-26T12:00:00Z" }),
      ],
      "2000-04-30",
    );
    expect(s.wedgesRemoved).toBe(2);
  });

  it("reports the latest strength gate text", () => {
    const s = restrictionState(
      [c({ effectiveFrom: "2000-09-01", kind: "strength_gate", valueText: "80% strength" })],
      "2000-09-02",
    );
    expect(s.strengthGate).toBe("80% strength");
  });

  it("flags a stale log after STALE_AFTER_DAYS with nothing written", () => {
    const list = [c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 })];
    expect(STALE_AFTER_DAYS).toBe(21);
    expect(restrictionState(list, "2000-03-22").isStale).toBe(false);
    expect(restrictionState(list, "2000-03-23").isStale).toBe(true);
    expect(restrictionState(list, "2000-03-23").daysSinceLastClearance).toBe(22);
  });

  it("is not stale when a planned entry was written recently, and days-since never goes negative", () => {
    const list = [
      c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
      c({ effectiveFrom: "2000-04-15", kind: "weight_bearing", valuePct: 50, source: "planned", createdAt: "2000-03-20T09:00:00Z" }),
    ];
    const s = restrictionState(list, "2000-04-01");
    expect(s.isStale).toBe(false);
    expect(s.daysSinceLastClearance).toBe(31);
  });

  it("is stale when the only recent-looking entry is a planned row written long ago", () => {
    const list = [
      c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
      c({ effectiveFrom: "2001-03-01", kind: "weight_bearing", valuePct: 100, source: "planned", createdAt: "2000-03-01T09:00:00Z" }),
    ];
    expect(restrictionState(list, "2000-09-01").isStale).toBe(true);
  });

  it("breaks a same-day tie by write time, whatever the array order", () => {
    const planned = c({ effectiveFrom: "2000-03-08", kind: "weight_bearing", valuePct: 25, source: "planned", createdAt: "2000-03-01T09:00:00Z" });
    const clinic = c({ effectiveFrom: "2000-03-08", kind: "weight_bearing", valuePct: 50, source: "clinic", createdAt: "2000-03-08T14:00:00Z" });
    expect(restrictionState([planned, clinic], "2000-03-09").clearedLoadPct).toBe(50);
    expect(restrictionState([clinic, planned], "2000-03-09").clearedLoadPct).toBe(50);
  });

  it("falls back to an earlier phase when the latest row names none", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25, phaseId: "p1" }),
        c({ effectiveFrom: "2000-03-08", kind: "wedge_removal" }),
      ],
      "2000-03-09",
    );
    expect(s.currentPhaseId).toBe("p1");
  });

  it("fails closed to zero load when a weight-bearing row has no percentage", () => {
    const s = restrictionState(
      [
        c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
        c({ effectiveFrom: "2000-03-08", kind: "weight_bearing", valuePct: null }),
      ],
      "2000-03-09",
    );
    expect(s.clearedLoadPct).toBe(0);
  });

  it("rejects a malformed today or effective date", () => {
    expect(() => restrictionState([], "March 1")).toThrow(/Not an ISO date/);
    expect(() => restrictionState([c({ effectiveFrom: "", kind: "ankle_rom" })], "2000-03-01")).toThrow(/Not an ISO date/);
  });

  it("does not mutate its input", () => {
    const list = [
      c({ effectiveFrom: "2000-03-08", kind: "weight_bearing", valuePct: 50 }),
      c({ effectiveFrom: "2000-03-01", kind: "weight_bearing", valuePct: 25 }),
    ];
    restrictionState(list, "2000-03-09");
    expect(list[0].effectiveFrom).toBe("2000-03-08");
  });
});
