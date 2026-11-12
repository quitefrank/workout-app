import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_IMAGE_SLUGS } from "../exercise-image-slugs";
import { EXERCISE_IMAGE_STANDINS } from "../exercise-image-standins";

const HAS = new Set(EXERCISE_IMAGE_SLUGS);

describe("exercise images", () => {
  it("has a file for every slug it lists", () => {
    expect(EXERCISE_IMAGE_SLUGS.filter((s) => !existsSync(`public/exercises/${s}.webp`))).toEqual([]);
  });

  it("points every stand-in at an exercise with its own image", () => {
    expect(Object.entries(EXERCISE_IMAGE_STANDINS).filter(([, to]) => !HAS.has(to))).toEqual([]);
  });

  it("drops a stand-in once the exercise has its own image", () => {
    expect(Object.keys(EXERCISE_IMAGE_STANDINS).filter((s) => HAS.has(s))).toEqual([]);
  });
});
