import { describe, expect, it } from "vitest";
import { parseWeightCsv } from "../parse-weight-csv";

describe("parseWeightCsv", () => {
  it("returns no sets and no errors for empty input", () => {
    const result = parseWeightCsv({
      weightCsv: "",
      warmUpMax: 3,
      prescribedReps: { min: 5, max: 8 },
    });
    expect(result.sets).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("returns no sets for whitespace-only input", () => {
    const result = parseWeightCsv({
      weightCsv: "   \t  ",
      warmUpMax: 3,
      prescribedReps: { min: 5, max: 8 },
    });
    expect(result.sets).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("handles null weightCsv", () => {
    const result = parseWeightCsv({
      weightCsv: null,
      warmUpMax: 3,
      prescribedReps: { min: 5, max: 8 },
    });
    expect(result.sets).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("parses the canonical DB Bench Press example with warm-ups only", () => {
    // From planning.md: "50, 70, 90, 160" with Warm Up=3-4, Sets=1
    const result = parseWeightCsv({
      weightCsv: "50, 70, 90, 160",
      warmUpMax: 4,
      prescribedReps: { min: 5, max: 8 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 50, reps: 7 },
      { setNumber: 2, isWarmUp: true, weight: 70, reps: 7 },
      { setNumber: 3, isWarmUp: true, weight: 90, reps: 7 },
      { setNumber: 4, isWarmUp: true, weight: 160, reps: 7 },
    ]);
  });

  it("parses warm-up at 3 with one working set: 50, 70, 90, 160", () => {
    const result = parseWeightCsv({
      weightCsv: "50, 70, 90, 160",
      warmUpMax: 3,
      prescribedReps: { min: 6, max: 6 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 50, reps: 6 },
      { setNumber: 2, isWarmUp: true, weight: 70, reps: 6 },
      { setNumber: 3, isWarmUp: true, weight: 90, reps: 6 },
      { setNumber: 4, isWarmUp: false, weight: 160, reps: 6 },
    ]);
  });

  it("parses the canonical example with reps overrides: 50, 60, 70, 100(5), 100(4)", () => {
    const result = parseWeightCsv({
      weightCsv: "50, 60, 70, 100(5), 100(4)",
      warmUpMax: 3,
      prescribedReps: { min: 8, max: 12 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 50, reps: 10 },
      { setNumber: 2, isWarmUp: true, weight: 60, reps: 10 },
      { setNumber: 3, isWarmUp: true, weight: 70, reps: 10 },
      { setNumber: 4, isWarmUp: false, weight: 100, reps: 5 },
      { setNumber: 5, isWarmUp: false, weight: 100, reps: 4 },
    ]);
  });

  it("tolerates inconsistent whitespace", () => {
    const result = parseWeightCsv({
      weightCsv: "  50,70 ,  90  ,160(3)  ",
      warmUpMax: 3,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 50, reps: 5 },
      { setNumber: 2, isWarmUp: true, weight: 70, reps: 5 },
      { setNumber: 3, isWarmUp: true, weight: 90, reps: 5 },
      { setNumber: 4, isWarmUp: false, weight: 160, reps: 3 },
    ]);
  });

  it("tolerates spaces inside the parens", () => {
    const result = parseWeightCsv({
      weightCsv: "100 ( 6 )",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: false, weight: 100, reps: 6 },
    ]);
  });

  it("supports decimal weights", () => {
    const result = parseWeightCsv({
      weightCsv: "45.5, 50.25(10)",
      warmUpMax: 1,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 45.5, reps: 5 },
      { setNumber: 2, isWarmUp: false, weight: 50.25, reps: 10 },
    ]);
  });

  it("uses fallbackReps when prescribedReps is null", () => {
    const result = parseWeightCsv({
      weightCsv: "100",
      warmUpMax: 0,
      prescribedReps: null,
      fallbackReps: 8,
    });
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: false, weight: 100, reps: 8 },
    ]);
  });

  it("returns reps=null for bare tokens when no reps source available", () => {
    const result = parseWeightCsv({
      weightCsv: "100",
      warmUpMax: 0,
      prescribedReps: null,
      fallbackReps: null,
    });
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: false, weight: 100, reps: null },
    ]);
  });

  it("rounds odd reps midpoints", () => {
    // (5 + 8) / 2 = 6.5 -> 7
    const result = parseWeightCsv({
      weightCsv: "100",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 8 },
    });
    expect(result.sets[0].reps).toBe(7);
  });

  it("treats warmUpMax=0 as all working sets", () => {
    const result = parseWeightCsv({
      weightCsv: "100, 110, 120",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.sets.every((s) => !s.isWarmUp)).toBe(true);
  });

  it("treats warmUpMax=null as all working sets", () => {
    const result = parseWeightCsv({
      weightCsv: "100, 110",
      warmUpMax: null,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.sets.every((s) => !s.isWarmUp)).toBe(true);
  });

  it("treats warmUpMax larger than token count as all warm-up", () => {
    const result = parseWeightCsv({
      weightCsv: "50, 70",
      warmUpMax: 5,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.sets.every((s) => s.isWarmUp)).toBe(true);
    expect(result.sets).toHaveLength(2);
  });

  it("drops empty tokens from double commas without erroring", () => {
    const result = parseWeightCsv({
      weightCsv: "50,,60",
      warmUpMax: 1,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 50, reps: 5 },
      { setNumber: 2, isWarmUp: false, weight: 60, reps: 5 },
    ]);
  });

  it("drops trailing comma silently", () => {
    const result = parseWeightCsv({
      weightCsv: "50, 70,",
      warmUpMax: 1,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toEqual([]);
    expect(result.sets).toHaveLength(2);
  });

  it("logs malformed weight ranges like 100-110", () => {
    const result = parseWeightCsv({
      weightCsv: "100-110",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.sets).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({
      setNumber: 1,
      token: "100-110",
    });
  });

  it("logs notes appended to a value", () => {
    const result = parseWeightCsv({
      weightCsv: "100 to failure",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].token).toBe("100 to failure");
  });

  it("logs bodyweight markers", () => {
    const result = parseWeightCsv({
      weightCsv: "BW(10)",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.sets).toEqual([]);
  });

  it("continues parsing after a malformed token in the middle", () => {
    const result = parseWeightCsv({
      weightCsv: "50, 70, BAD, 100(5)",
      warmUpMax: 2,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toMatchObject({ setNumber: 3, token: "BAD" });
    expect(result.sets).toEqual([
      { setNumber: 1, isWarmUp: true, weight: 50, reps: 5 },
      { setNumber: 2, isWarmUp: true, weight: 70, reps: 5 },
      { setNumber: 4, isWarmUp: false, weight: 100, reps: 5 },
    ]);
  });

  it("rejects negative weights", () => {
    const result = parseWeightCsv({
      weightCsv: "-50",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toHaveLength(1);
    expect(result.sets).toEqual([]);
  });

  it("rejects empty parens like 100()", () => {
    const result = parseWeightCsv({
      weightCsv: "100()",
      warmUpMax: 0,
      prescribedReps: { min: 5, max: 5 },
    });
    expect(result.errors).toHaveLength(1);
  });
});
