import { describe, expect, it } from "vitest";
import { formatRest, prescriptionFacts, type Prescription } from "../format";

const empty: Prescription = {
  prescribed_sets_min: null,
  prescribed_sets_max: null,
  prescribed_reps_min: null,
  prescribed_reps_max: null,
  prescribed_rir_min: null,
  prescribed_rir_max: null,
  prescribed_seconds_min: null,
  prescribed_seconds_max: null,
  prescribed_rest_seconds: null,
  prescribed_rpe: null,
  warm_up_sets_min: null,
  warm_up_sets_max: null,
};

describe("prescriptionFacts", () => {
  it("splits a full prescription into Notion's columns", () => {
    const facts = prescriptionFacts({
      ...empty,
      warm_up_sets_min: 2,
      warm_up_sets_max: 3,
      prescribed_sets_min: 3,
      prescribed_sets_max: 3,
      prescribed_reps_min: 8,
      prescribed_reps_max: 10,
      prescribed_rpe: "8",
      prescribed_rest_seconds: 150,
    });
    expect(facts.map((f) => f.kind)).toEqual(["warm", "sets", "reps", "rpe", "rest"]);
    expect(facts.find((f) => f.kind === "sets")?.label).toBe("3 sets");
    expect(facts.find((f) => f.kind === "rest")?.text).toBe(formatRest(150));
  });

  it("reads a hold as time and RIR as its own text", () => {
    expect(prescriptionFacts({ ...empty, prescribed_seconds_min: 30, prescribed_seconds_max: 45 })).toEqual([
      { kind: "time", text: "30-45 s", label: "30-45 s hold" },
    ]);
    expect(prescriptionFacts({ ...empty, prescribed_rir_min: 2, prescribed_rir_max: 2 })[0].kind).toBe("rir");
  });

  it("drops a zero warm-up and says nothing for an empty prescription", () => {
    expect(prescriptionFacts({ ...empty, warm_up_sets_min: 0, warm_up_sets_max: 0 })).toEqual([]);
    expect(prescriptionFacts(empty)).toEqual([]);
  });

  it("uses the singular for one set", () => {
    expect(prescriptionFacts({ ...empty, prescribed_sets_min: 1, prescribed_sets_max: 1 })[0].label).toBe("1 set");
  });
});
