import { describe, expect, it } from "vitest";
import { mainLift, workingSlugs } from "../workout-art";

describe("workingSlugs", () => {
  it("drops the warm-up walk, stretches and activation drills, so the first is the main lift", () => {
    expect(
      workingSlugs([
        { slug: "warm-up-walk", group: "Cardio" },
        { slug: "arm-circles", group: "Stretches" },
        { slug: "cable-external-rotations", group: "Shoulders" },
        { slug: "bench-press-flat", group: "Chest" },
        { slug: "larsen-press", group: "Chest" },
      ]),
    ).toEqual(["bench-press-flat", "larsen-press"]);
  });

  it("keeps everything when the workout is all cardio and stretches", () => {
    expect(
      workingSlugs([
        { slug: "warm-up-run", group: "Cardio" },
        { slug: "ankle-roll", group: "Stretches" },
        { slug: "running", group: "Cardio" },
      ]),
    ).toEqual(["warm-up-run", "ankle-roll", "running"]);
  });

  it("skips exercises with no slug", () => {
    expect(workingSlugs([{ slug: null, group: "Chest" }, { slug: "dips", group: "Chest" }])).toEqual(["dips"]);
  });
});

describe("mainLift", () => {
  const has = (s: string) => s !== "back-squat";

  it("is the first drawn lift, so an undrawn first lift falls through to the next", () => {
    expect(mainLift(["back-squat", "leg-press", "leg-curl"], has)).toBe("leg-press");
  });

  it("is null when nothing is drawn", () => {
    expect(mainLift(["back-squat", null], has)).toBeNull();
    expect(mainLift([], has)).toBeNull();
  });
});
