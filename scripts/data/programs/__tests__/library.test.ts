// @vitest-environment node

import { describe, expect, it } from "vitest";
import { LIBRARY_ALIASES, LIBRARY_ATTRIBUTES, MUSCLE_GROUP_NAMES } from "../library";
import { exerciseSlug } from "../../../lib/exercise-name";

describe("library map", () => {
  it("keys are slugs", () => {
    for (const k of [...Object.keys(LIBRARY_ALIASES), ...Object.values(LIBRARY_ALIASES), ...Object.keys(LIBRARY_ATTRIBUTES)]) {
      expect(k).toBe(exerciseSlug(k, null));
    }
  });

  it("an alias key never also has attributes, and never aliases itself", () => {
    for (const [from, to] of Object.entries(LIBRARY_ALIASES)) {
      expect(from).not.toBe(to);
      expect(LIBRARY_ATTRIBUTES[from]).toBeUndefined();
    }
  });

  it("every attribute names a known muscle group", () => {
    for (const [slug, a] of Object.entries(LIBRARY_ATTRIBUTES)) {
      expect(MUSCLE_GROUP_NAMES, slug).toContain(a.muscleGroup);
    }
  });
});
