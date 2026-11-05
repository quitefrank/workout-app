import { describe, expect, it } from "vitest";
import { equipmentChoices, exerciseTitle, oneEntryPerMovement, optionForEquipment, optionForTechnique, optionTag, techniqueChoices, type MovementOption } from "../movements";

const o = (id: string, equipment: string, technique: string | null = null): MovementOption => ({ id, slug: id, name: id, equipment, technique, hasFloors: false });
const BENCH = [o("bb", "Barbell"), o("pause", "Barbell", "Pause"), o("db", "Dumbbell"), o("db-nld", "Dumbbell", "No Leg Drive"), o("m", "Machine", "No Leg Drive")];

describe("movement options", () => {
  it("lists each equipment once, and the techniques on one equipment", () => {
    expect(equipmentChoices(BENCH)).toEqual(["Barbell", "Dumbbell", "Machine"]);
    expect(techniqueChoices(BENCH, "Barbell")).toEqual(["Standard", "Pause"]);
    expect(techniqueChoices(BENCH, "Machine")).toEqual(["No Leg Drive"]);
  });

  it("keeps the technique when the new equipment has it", () => {
    expect(optionForEquipment(BENCH, "Dumbbell", "No Leg Drive")?.id).toBe("db-nld");
  });

  it("falls back to the standard way, then to the only way", () => {
    expect(optionForEquipment(BENCH, "Dumbbell", "Pause")?.id).toBe("db");
    expect(optionForEquipment(BENCH, "Machine", null)?.id).toBe("m");
    expect(optionForEquipment(BENCH, "Kettlebell", null)).toBeNull();
  });

  it("finds a technique by its label", () => {
    expect(optionForTechnique(BENCH, "Barbell", "Standard")?.id).toBe("bb");
    expect(optionForTechnique(BENCH, "Barbell", "Pause")?.id).toBe("pause");
  });
});

describe("titles", () => {
  const row = { name: "DB Bench Press", movement: "Bench Press", option_equipment: "Dumbbell", option_technique: null };
  it("names a row by its movement and what sets it apart", () => {
    expect(exerciseTitle(row)).toBe("Bench Press · Dumbbell");
    expect(exerciseTitle({ ...row, option_technique: "Pause" })).toBe("Bench Press · Dumbbell, Pause");
    expect(optionTag(row)).toBe("Dumbbell");
  });
  it("leaves a row with no movement alone", () => {
    expect(exerciseTitle({ name: "Larsen Press", movement: null, option_equipment: null, option_technique: null })).toBe("Larsen Press");
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
