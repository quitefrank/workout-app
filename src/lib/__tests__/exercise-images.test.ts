import { existsSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EXERCISE_IMAGE_SLUGS } from "../exercise-image-slugs";

describe("exercise images", () => {
  it("has a file for every slug it lists", () => {
    expect(EXERCISE_IMAGE_SLUGS.filter((s) => !existsSync(`public/exercises/${s}.webp`))).toEqual([]);
  });
});
