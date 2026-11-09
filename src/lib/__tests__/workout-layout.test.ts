import { describe, expect, it } from "vitest";
import { VIEWS, workoutViewFrom } from "../workout-layout";

const jar = (c: Record<string, string>) => (name: string) => c[name];

describe("workout views", () => {
  it("defaults to View 1", () => {
    expect(workoutViewFrom(jar({}))).toBe(1);
  });

  it("reads the saved view", () => {
    expect(workoutViewFrom(jar({ workout_view: "2" }))).toBe(2);
    expect(workoutViewFrom(jar({ workout_view: "3" }))).toBe(3);
    expect(workoutViewFrom(jar({ workout_view: "4" }))).toBe(4);
    expect(workoutViewFrom(jar({ workout_view: "5" }))).toBe(5);
  });

  it("keeps the centred log button for someone who picked it before views", () => {
    expect(workoutViewFrom(jar({ workout_log: "centred" }))).toBe(3);
    expect(workoutViewFrom(jar({ workout_log: "pill" }))).toBe(1);
    expect(workoutViewFrom(jar({ workout_layout: "centred" }))).toBe(3);
    expect(workoutViewFrom(jar({ workout_layout: "pill" }))).toBe(1);
  });

  it("prefers a saved view over the old choices, and ignores values it does not know", () => {
    expect(workoutViewFrom(jar({ workout_view: "3", workout_log: "pill" }))).toBe(3);
    expect(workoutViewFrom(jar({ workout_view: "6" }))).toBe(1);
    expect(workoutViewFrom(jar({ workout_view: "7" }))).toBe(1);
  });

  it("holds Frank's five views", () => {
    expect(VIEWS[1]).toMatchObject({ log: "pill", sets: "header", setStyle: "circles", reps: false, upNext: "always", pillDots: false, swap: "pill" });
    expect(VIEWS[2]).toMatchObject({ log: "pill", sets: "pill", setStyle: "text", reps: false, upNext: "always", pillDots: false, swap: "pill" });
    expect(VIEWS[3]).toMatchObject({ log: "centred", sets: "header", setStyle: "text", reps: false, upNext: "always", swap: "toolbar" });
    expect(VIEWS[4]).toMatchObject({ log: "pill", sets: "header", setStyle: "text", reps: true, upNext: "last", pillDots: false, swap: "pill" });
    expect(VIEWS[5]).toMatchObject({ log: "pill", sets: "header", setStyle: "text", reps: true, upNext: "last", pillDots: true, swap: "menu" });
  });
});
