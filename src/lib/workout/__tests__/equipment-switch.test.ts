import { describe, expect, it } from "vitest";
import type { SetRowView } from "../active";
import { isEquipmentSwitch, locate, mergeSwitched, mixedEquipment, ownerOf, remainingSets, type SwitchRow } from "../equipment-switch";

const we = (id: string, exercise: string, equipment: string | null, from: string | null = null, movement: string | null = "Lateral Raise"): SwitchRow => ({
  id,
  swapped_from_exercise_id: from,
  exercises: { id: exercise, movement, option_equipment: equipment },
});

const row = (label: string, setId: string | null = null, kind: SetRowView["kind"] = "work"): SetRowView =>
  ({ kind, label, set: setId ? ({ id: setId } as SetRowView["set"]) : null, last: null, weight: null, reps: null }) as unknown as SetRowView;

const cable = we("we-cable", "ex-cable", "Cable");
const dumbbell = we("we-db", "ex-db", "Dumbbell", "ex-cable");

describe("isEquipmentSwitch", () => {
  it("is a row switched from the one before it, same family, other equipment", () => {
    expect(isEquipmentSwitch(cable, dumbbell)).toBe(true);
  });
  it("is not a swap to another family", () => {
    expect(isEquipmentSwitch(cable, we("we-x", "ex-x", "Dumbbell", "ex-cable", "Shoulder Press"))).toBe(false);
  });
  it("is not a change of position on the same equipment", () => {
    expect(isEquipmentSwitch(cable, we("we-x", "ex-x", "Cable", "ex-cable"))).toBe(false);
  });
  it("is not a row that was never swapped", () => {
    expect(isEquipmentSwitch(cable, we("we-x", "ex-x", "Dumbbell"))).toBe(false);
  });
  it("follows a second switch back to what the first row started as", () => {
    // swapExercise stamps every added row with the original exercise
    expect(isEquipmentSwitch(dumbbell, we("we-m", "ex-m", "Machine", "ex-cable"))).toBe(true);
  });
});

describe("mergeSwitched", () => {
  it("leaves a workout without switches alone", () => {
    const entries = [{ we: cable, rows: [row("1")] }];
    expect(mergeSwitched(entries)).toEqual(entries);
  });

  it("joins the logged cable set and the dumbbell sets under the dumbbell row, numbered through", () => {
    const a = { we: cable, rows: [row("W", "s0", "warm"), row("1", "s1"), row("2"), row("3")] };
    const b = { we: dumbbell, rows: [row("1"), row("2")] };
    const [m] = mergeSwitched([a, b]);
    expect(m.we).toBe(dumbbell);
    expect(m.rows.map((r) => r.label)).toEqual(["W", "1", "2", "3"]);
    expect(m.equipment).toEqual(["Cable", "Cable", "Dumbbell", "Dumbbell"]);
    expect(mixedEquipment(m)).toBe(true);
    // the cable row's unlogged sets 2 and 3 are not shown: they moved to the dumbbell row
    expect(m.parts?.map((p) => p.rows)).toEqual([[0, 1], [0, 1]]);
  });

  it("does not join a row with nothing logged", () => {
    const a = { we: cable, rows: [row("1")] };
    const b = { we: dumbbell, rows: [row("1")] };
    expect(mergeSwitched([a, b])).toHaveLength(2);
  });

  it("keeps the exercises around it apart", () => {
    const before = { we: we("we-0", "ex-0", "Barbell", null, "Squat"), rows: [row("1", "s9")] };
    const a = { we: cable, rows: [row("1", "s1")] };
    const b = { we: dumbbell, rows: [row("1")] };
    const after = { we: we("we-9", "ex-9", "Cable", null, "Crunch"), rows: [row("1")] };
    expect(mergeSwitched([before, a, b, after]).map((e) => e.we.id)).toEqual(["we-0", "we-db", "we-9"]);
  });
});

describe("locate and ownerOf", () => {
  const a = { we: cable, rows: [row("1", "s1"), row("2")] };
  const b = { we: dumbbell, rows: [row("1"), row("2")] };
  const [m] = mergeSwitched([a, b]);

  it("sends a shown set to its own row and index", () => {
    expect(locate(m, 0)).toEqual({ entry: a, i: 0 });
    expect(locate(m, 1)).toEqual({ entry: b, i: 0 });
    expect(locate(m, 2)).toEqual({ entry: b, i: 1 });
  });
  it("sends an index past the end to the current row, where Add Set puts it", () => {
    expect(locate(m, 3)).toEqual({ entry: b, i: 2 });
  });
  it("is the entry itself when it is one row", () => {
    expect(locate(a, 1)).toEqual({ entry: a, i: 1 });
  });
  it("finds a logged set's row", () => {
    expect(ownerOf(m, "s1")).toBe(a);
    expect(ownerOf(m, "nope")).toBe(m);
  });
});

describe("remainingSets", () => {
  it("is the prescription less what was logged, at least one", () => {
    expect(remainingSets(3, 3, 1)).toEqual({ min: 2, max: 2 });
    expect(remainingSets(3, 4, 3)).toEqual({ min: 1, max: 1 });
    expect(remainingSets(null, null, 2)).toEqual({ min: null, max: null });
  });
});
