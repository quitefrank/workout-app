import { describe, expect, it } from "vitest";
import { axisChoices, byEntryName, exerciseTitle, oneEntryPerMovement, optionFor, unavailableReason, type MovementOption } from "../movements";

const o = (id: string, equipment: string, position: string | null, technique: string | null = null): MovementOption => ({
  id,
  slug: id,
  name: id,
  title: null,
  equipment,
  position,
  technique,
  hasFloors: false,
});

// A slice of the Curl family: EZ-Bar cannot do Hammer, Bayesian needs Cable, Preacher has its own variations
const CURL = [
  o("ez", "EZ-Bar", "Standing"),
  o("ez-rev", "EZ-Bar", "Standing", "Reverse"),
  o("db", "Dumbbell", "Standing"),
  o("db-hammer", "Dumbbell", "Standing", "Hammer"),
  o("db-incline", "Dumbbell", "Incline"),
  o("db-preacher", "Dumbbell", "Preacher"),
  o("db-preacher-bh", "Dumbbell", "Preacher", "Bottom-Half"),
  o("cable", "Cable", "Standing"),
  o("cable-bayes", "Cable", "Bayesian"),
  o("bb-preacher", "Barbell", "Preacher"),
];
const at = (id: string) => CURL.find((x) => x.id === id)!;

describe("choices", () => {
  it("lists each value once, in the family's order", () => {
    expect(axisChoices(CURL, "equipment")).toEqual(["EZ-Bar", "Dumbbell", "Cable", "Barbell"]);
    expect(axisChoices(CURL, "position")).toEqual(["Standing", "Incline", "Preacher", "Bayesian"]);
    expect(axisChoices(CURL, "variation")).toEqual(["Standard", "Reverse", "Hammer", "Bottom-Half"]);
  });
  it("has no positions when the family has none", () => {
    expect(axisChoices([o("a", "Cable", null), o("b", "Cable", null, "V-Bar")], "position")).toEqual([]);
  });
});

describe("equipment is the parent", () => {
  it("keeps position and variation when the new equipment has them", () => {
    expect(optionFor(CURL, at("db-preacher"), "equipment", "Barbell")?.id).toBe("bb-preacher");
    expect(optionFor(CURL, at("ez"), "equipment", "Cable")?.id).toBe("cable");
  });
  it("falls back to the standard version when a child does not exist", () => {
    expect(optionFor(CURL, at("db-hammer"), "equipment", "EZ-Bar")?.id).toBe("ez");
    expect(optionFor(CURL, at("db-incline"), "equipment", "Cable")?.id).toBe("cable");
    expect(optionFor(CURL, at("db-preacher-bh"), "equipment", "Barbell")?.id).toBe("bb-preacher");
  });
  it("picks a position or variation only where it exists", () => {
    expect(optionFor(CURL, at("db"), "position", "Preacher")?.id).toBe("db-preacher");
    expect(optionFor(CURL, at("ez"), "position", "Incline")).toBeNull();
    expect(optionFor(CURL, at("db"), "variation", "Hammer")?.id).toBe("db-hammer");
    expect(optionFor(CURL, at("ez"), "variation", "Hammer")).toBeNull();
  });
});

describe("unavailable choices say what they need", () => {
  it("names the equipment or position a choice needs", () => {
    expect(unavailableReason(CURL, at("ez"), "variation", "Hammer")).toBe("Needs Dumbbell");
    expect(unavailableReason(CURL, at("ez"), "position", "Bayesian")).toBe("Needs Cable");
    expect(unavailableReason(CURL, at("db"), "variation", "Bottom-Half")).toBe("Needs Preacher");
  });
  it("says what rules it out when many could", () => {
    expect(unavailableReason(CURL, at("cable"), "position", "Preacher")).toBe("Needs Dumbbell or Barbell");
    const many = [...CURL, o("m-preacher", "Machine", "Preacher")];
    expect(unavailableReason(many, at("cable"), "position", "Preacher")).toBe("Not on Cable");
  });
  it("never blocks equipment or what is already possible", () => {
    expect(unavailableReason(CURL, at("ez"), "equipment", "Cable")).toBe("");
    expect(unavailableReason(CURL, at("ez"), "variation", "Reverse")).toBe("");
  });
});

describe("titles", () => {
  it("shows the version title, else the row's own name", () => {
    expect(exerciseTitle({ name: "DB Bench Press", title: "Dumbbell Bench Press" })).toBe("Dumbbell Bench Press");
    expect(exerciseTitle({ name: "Cable Press Around", title: null })).toBe("Cable Press Around");
  });
});

describe("byEntryName", () => {
  it("sorts a movement by its own name, not its row's", () => {
    const out = byEntryName([
      { name: "Bottom-Half Preacher Curls", movement: "Curl" },
      { name: "Spider Curl", movement: null },
      { name: "Bayesian Cable Curl", movement: null },
    ]);
    expect(out.map((i) => i.name)).toEqual(["Bayesian Cable Curl", "Bottom-Half Preacher Curls", "Spider Curl"]);
  });
});

describe("oneEntryPerMovement", () => {
  const item = (id: string, movement: string | null, last: unknown = null) => ({ id, movement, last });
  it("keeps stand-alone rows and shows each movement once, in the first one's place", () => {
    const out = oneEntryPerMovement([item("a", "Bench"), item("x", null), item("b", "Bench")]);
    expect(out.map((i) => i.id)).toEqual(["a", "x"]);
  });
  it("prefers the row with history", () => {
    const out = oneEntryPerMovement([item("a", "Bench"), item("b", "Bench", { weight: 1 }), item("c", "Bench", { weight: 2 })]);
    expect(out.map((i) => i.id)).toEqual(["b"]);
  });
});
