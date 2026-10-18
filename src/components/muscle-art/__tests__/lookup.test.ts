import { describe, expect, it } from "vitest";
import { artFor } from "../lookup";
import { muscleSlug } from "../slug";

const table = { chest: { body: "M0 0", hit: "M1 1", line: "M2 2" } };

describe("muscle art lookup", () => {
  it("slugs a group name", () => {
    expect(muscleSlug("Chest")).toBe("chest");
    expect(muscleSlug(" Lower Back ")).toBe("lower-back");
  });

  it("finds art by group name, any case", () => {
    expect(artFor("Chest", table)).toBe(table.chest);
    expect(artFor("CHEST", table)).toBe(table.chest);
  });

  it("returns null for a group with no art", () => {
    expect(artFor("Neck", table)).toBeNull();
    expect(artFor(null, table)).toBeNull();
  });
});
