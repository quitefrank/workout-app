import { describe, expect, it } from "vitest";
import { glassSteppersFrom, journalGlassFrom, pillBottomFrom, workoutVersionFrom } from "../workout-layout";

describe("journalGlassFrom", () => {
  it("is css, match or shader, and css for anything else", () => {
    expect(journalGlassFrom(() => undefined)).toBe("css");
    expect(journalGlassFrom((n) => (n === "workout_journal_glass" ? "match" : undefined))).toBe("match");
    expect(journalGlassFrom((n) => (n === "workout_journal_glass" ? "shader" : undefined))).toBe("shader");
    expect(journalGlassFrom((n) => (n === "workout_journal_glass" ? "css" : undefined))).toBe("css");
    expect(journalGlassFrom((n) => (n === "workout_journal_glass" ? "gpu" : undefined))).toBe("css");
  });
});

describe("glassSteppersFrom", () => {
  it("is on only when its cookie says 1", () => {
    expect(glassSteppersFrom((n) => (n === "workout_glass_steppers" ? "1" : undefined))).toBe(true);
    expect(glassSteppersFrom((n) => (n === "workout_glass_steppers" ? "0" : undefined))).toBe(false);
    expect(glassSteppersFrom(() => undefined)).toBe(false);
  });
});

describe("workoutVersionFrom", () => {
  it("reads Version 2 from its cookie and defaults to Version 1", () => {
    expect(workoutVersionFrom((n) => (n === "workout_version" ? "2" : undefined))).toBe(2);
    expect(workoutVersionFrom((n) => (n === "workout_version" ? "1" : undefined))).toBe(1);
    expect(workoutVersionFrom(() => undefined)).toBe(1);
    // the old five-view cookie is ignored
    expect(workoutVersionFrom((n) => (n === "workout_view" ? "3" : undefined))).toBe(1);
  });
});

describe("pillBottomFrom", () => {
  it("is 21, 27 or 32, and 21 for anything else", () => {
    expect(pillBottomFrom(() => undefined)).toBe(21);
    expect(pillBottomFrom((n) => (n === "workout_pill_bottom" ? "27" : undefined))).toBe(27);
    expect(pillBottomFrom((n) => (n === "workout_pill_bottom" ? "32" : undefined))).toBe(32);
    expect(pillBottomFrom((n) => (n === "workout_pill_bottom" ? "40" : undefined))).toBe(21);
    expect(pillBottomFrom((n) => (n === "workout_pill_bottom" ? "x" : undefined))).toBe(21);
  });
});
