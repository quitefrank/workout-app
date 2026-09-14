import { describe, expect, it } from "vitest";
import { formatDose, parseDose } from "../dose";

describe("parseDose", () => {
  it("parses sets x reps", () => {
    expect(parseDose("3 x 10-12")).toEqual({
      sets: { min: 3, max: 3 },
      reps: { min: 10, max: 12 },
      rir: null,
      seconds: null,
      modifier: null,
    });
  });

  it("parses a single rep count", () => {
    expect(parseDose("3 x 15")?.reps).toEqual({ min: 15, max: 15 });
  });

  it("parses reps in reserve written out", () => {
    expect(parseDose("4 x leave 1-2 in reserve")).toEqual({
      sets: { min: 4, max: 4 },
      reps: null,
      rir: { min: 1, max: 2 },
      seconds: null,
      modifier: null,
    });
  });

  it("parses reps in reserve abbreviated", () => {
    expect(parseDose("3 x RIR 2-3")?.rir).toEqual({ min: 2, max: 3 });
  });

  it("parses timed holds", () => {
    expect(parseDose("3 x 20-40 sec")).toEqual({
      sets: { min: 3, max: 3 },
      reps: null,
      rir: null,
      seconds: { min: 20, max: 40 },
      modifier: null,
    });
  });

  it("keeps a trailing modifier", () => {
    expect(parseDose("4 x 10-15 slow")?.modifier).toBe("slow");
    expect(parseDose("3 x 12 each side")?.modifier).toBe("each side");
    expect(parseDose("3 x 20-30 sec each side")).toMatchObject({
      seconds: { min: 20, max: 30 },
      modifier: "each side",
    });
  });

  it("accepts a sets range and a multiplication sign", () => {
    expect(parseDose("3-4 × 8")?.sets).toEqual({ min: 3, max: 4 });
  });

  it("does not read a modifier starting with s as seconds", () => {
    expect(parseDose("4 x 10-15 slow")?.seconds).toBeNull();
    expect(parseDose("3 x 10 strict")?.reps).toEqual({ min: 10, max: 10 });
  });

  it("rejects what it cannot classify", () => {
    expect(parseDose("3 x banana")).toBeNull();
    expect(parseDose("x 10")).toBeNull();
    expect(parseDose("")).toBeNull();
    expect(parseDose("3 sets of 10")).toBeNull();
    expect(parseDose("3 x 12-10")).toBeNull();
    expect(parseDose("3 x 1 min")).toBeNull();
    expect(parseDose("3 x 20 seconds")).toBeNull();
    expect(parseDose("3 x 8 RIR 2")).toBeNull();
    expect(parseDose("3 x 10 leave 2 in reserve")).toBeNull();
    expect(parseDose("3 x 10-12 x 2")).toBeNull();
    expect(parseDose("3 x 10-12 reps")).toBeNull();
    expect(parseDose("3 x 20 sec.")).toBeNull();
  });

  it("keeps word-only modifiers", () => {
    expect(parseDose("3 x 20 sec hold")?.modifier).toBe("hold");
    expect(parseDose("3 x 10 super slow")?.modifier).toBe("super slow");
  });
});

describe("formatDose", () => {
  it("round-trips the four shapes", () => {
    for (const s of ["3 x 10-12", "4 x RIR 1-2", "3 x 20-40 sec", "3 x 12 each side"]) {
      const d = parseDose(s);
      expect(d).not.toBeNull();
      expect(formatDose(d!)).toBe(s);
    }
  });

  it("normalises the written-out reserve form", () => {
    expect(formatDose(parseDose("4 x leave 1-2 in reserve")!)).toBe("4 x RIR 1-2");
  });

  it("renders a sets-only dose", () => {
    expect(formatDose({ sets: { min: 3, max: 3 }, reps: null, rir: null, seconds: null, modifier: null })).toBe("3 sets");
  });

  it("trims a hand-built modifier", () => {
    expect(formatDose({ sets: { min: 3, max: 3 }, reps: { min: 10, max: 10 }, rir: null, seconds: null, modifier: "  slow  " })).toBe("3 x 10 slow");
  });
});
