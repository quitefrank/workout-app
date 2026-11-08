import { describe, expect, it } from "vitest";
import { workoutLayoutFrom } from "../workout-layout";

const jar = (c: Record<string, string>) => (name: string) => c[name];

describe("workout layout", () => {
  it("defaults to the centred check and cards", () => {
    expect(workoutLayoutFrom(jar({}))).toEqual({ log: "centred", steppers: "cards" });
  });

  it("reads each choice on its own", () => {
    expect(workoutLayoutFrom(jar({ workout_log: "pill", workout_steppers: "cards" }))).toEqual({ log: "pill", steppers: "cards" });
    expect(workoutLayoutFrom(jar({ workout_log: "centred", workout_steppers: "list" }))).toEqual({ log: "centred", steppers: "list" });
  });

  it("starts from the old single choice until a new one is saved", () => {
    expect(workoutLayoutFrom(jar({ workout_layout: "pill" }))).toEqual({ log: "pill", steppers: "list" });
    expect(workoutLayoutFrom(jar({ workout_layout: "pill", workout_steppers: "cards" }))).toEqual({ log: "pill", steppers: "cards" });
  });

  it("ignores values it does not know", () => {
    expect(workoutLayoutFrom(jar({ workout_log: "side", workout_steppers: "dial" }))).toEqual({ log: "centred", steppers: "cards" });
  });
});
