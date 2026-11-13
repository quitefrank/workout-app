import { describe, expect, it } from "vitest";
import type { SetRow } from "@/lib/data/queries";
import { deletePlan, NO_DROP, rowsFor, shiftDrafts } from "../row-delete";
import { valuesOf } from "../active";

const set = (n: number, weight: number, warm = false): SetRow => ({
  id: `s${n}`,
  set_number: n,
  is_warm_up: warm,
  is_drop_set: false,
  weight,
  reps: 8,
  seconds: null,
  incline: null,
  speed: null,
  distance: null,
  rpe: null,
  notes: null,
  completed_at: "2026-11-12T12:00:00Z",
});

const we = (sets: SetRow[] = [], work = 3, warm = 1) => ({
  prescribed_sets_min: work,
  prescribed_sets_max: work,
  prescribed_reps_min: 8,
  prescribed_reps_max: 10,
  warm_up_sets_min: warm,
  warm_up_sets_max: warm,
  sets,
});

const labels = (rows: ReturnType<typeof rowsFor>) => rows.map((r) => `${r.label}${r.set ? "*" : ""}`).join(" ");

describe("rowsFor", () => {
  it("drops unlogged rows off the end of each block and appends added rows", () => {
    expect(labels(rowsFor(we(), null))).toBe("W 1 2 3");
    expect(labels(rowsFor(we(), null, 0, { warm: 1, work: 1 }))).toBe("1 2");
    expect(labels(rowsFor(we(), null, 2, { warm: 0, work: 1 }))).toBe("W 1 2 3 4");
  });
  it("never hides a logged row, so a stale drop stops counting", () => {
    expect(labels(rowsFor(we([set(1, 100), set(2, 100), set(3, 100)], 3, 0), null, 0, { warm: 0, work: 1 }))).toBe("1* 2* 3*");
  });
});

describe("deletePlan", () => {
  it("an unlogged prescribed row drops one", () => {
    const p = deletePlan(we(), null, 0, NO_DROP, 2)!;
    expect(p).toEqual({ setId: null, extra: 0, drop: { warm: 0, work: 1 } });
    expect(labels(rowsFor(we(), null, p.extra, p.drop))).toBe("W 1 2");
  });
  it("an unlogged warm-up drops a warm-up", () => {
    expect(deletePlan(we(), null, 0, NO_DROP, 0)!.drop).toEqual({ warm: 1, work: 0 });
  });
  it("an unlogged working row spends an added row first", () => {
    expect(deletePlan(we(), null, 2, NO_DROP, 1)).toEqual({ setId: null, extra: 1, drop: NO_DROP });
  });
  it("a logged row within the prescription deletes its set and drops the row it would leave behind", () => {
    const sets = [set(1, 100), set(2, 110)];
    const p = deletePlan(we(sets, 3, 0), null, 0, NO_DROP, 1)!;
    expect(p).toEqual({ setId: "s2", extra: 0, drop: { warm: 0, work: 1 } });
    expect(labels(rowsFor(we([sets[0]], 3, 0), null, p.extra, p.drop))).toBe("1* 2");
  });
  it("a logged row past the prescription only deletes its set", () => {
    const sets = [set(1, 100), set(2, 100), set(3, 100), set(4, 100)];
    expect(deletePlan(we(sets, 3, 0), null, 0, NO_DROP, 3)).toEqual({ setId: "s4", extra: 0, drop: NO_DROP });
  });
  it("refuses the last row", () => {
    expect(deletePlan(we([], 1, 0), null, 0, NO_DROP, 0)).toBeNull();
  });
});

describe("shiftDrafts", () => {
  it("moves the values of the unlogged rows after the deleted one up a place and keeps the rest", () => {
    const rows = rowsFor(we(), null);
    const shown = [100, 135, 145, 155].map((w) => valuesOf({ weight: w, reps: 8 }));
    const before = { "a:0": shown[0], "a:2": valuesOf({ weight: 999, reps: 1 }), "b:2": shown[0] };
    const out = shiftDrafts(before, "a", rows, shown, 1);
    expect(out["a:0"]).toBe(shown[0]);
    expect(out["a:1"]).toBe(shown[2]);
    expect(out["a:2"]).toBe(shown[3]);
    expect(out["a:3"]).toBeUndefined();
    expect(out["b:2"]).toBe(shown[0]);
  });
});
