import { describe, expect, it } from "vitest";
import { glassSteppersFrom, PILL_STYLES, pillStyleFrom, pillSwapFrom, workoutVersionFrom } from "../workout-layout";

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

describe("pillStyleFrom", () => {
  it("reads the three iOS 27 styles and defaults to Ladder's pill", () => {
    expect(pillStyleFrom(() => undefined)).toBe("ladder");
    expect(pillStyleFrom((n) => (n === "workout_pill_style" ? "split" : undefined))).toBe("split");
    expect(pillStyleFrom((n) => (n === "workout_pill_style" ? "capsule" : undefined))).toBe("capsule");
    expect(pillStyleFrom((n) => (n === "workout_pill_style" ? "leading" : undefined))).toBe("leading");
    expect(pillStyleFrom((n) => (n === "workout_pill_style" ? "nonsense" : undefined))).toBe("ladder");
  });

  it("puts the log check 28pt from the screen's edge in every style", () => {
    // capsule: 21pt inset plus 7pt in; split and leading: the circle at the inset; Ladder: 20pt plus 8pt
    expect(PILL_STYLES.capsule.inset + (PILL_STYLES.capsule.height - 36) / 2).toBe(28);
    expect(PILL_STYLES.split.inset).toBe(28);
    expect(PILL_STYLES.leading.inset).toBe(28);
    expect(PILL_STYLES.ladder.inset + 8).toBe(28);
  });
});
