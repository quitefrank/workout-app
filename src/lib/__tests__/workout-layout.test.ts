import { describe, expect, it } from "vitest";
import { glassSteppersFrom, pillSwapFrom, workoutVersionFrom } from "../workout-layout";

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

describe("pillSwapFrom", () => {
  it("is on unless its cookie says 0", () => {
    expect(pillSwapFrom(() => undefined)).toBe(true);
    expect(pillSwapFrom((n) => (n === "workout_pill_swap" ? "1" : undefined))).toBe(true);
    expect(pillSwapFrom((n) => (n === "workout_pill_swap" ? "0" : undefined))).toBe(false);
  });
});
