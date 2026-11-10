import { describe, expect, it } from "vitest";
import type { LastTime, SetRow } from "@/lib/data/queries";
import { best, buildRows, repTarget, isDone, newRecord, nextRow, progress, rowLabel, step, swappedFrom, totals } from "../active";

const set = (n: number, weight: number | null, reps: number | null, warm = false, drop = false): SetRow => ({
  id: `s${n}`,
  set_number: n,
  is_warm_up: warm,
  is_drop_set: drop,
  weight,
  reps,
  seconds: null,
  incline: null,
  speed: null,
  distance: null,
  rpe: null,
  notes: null,
  completed_at: "2026-11-08T12:00:00Z",
});

const cardio = { seconds: null, incline: null, speed: null, distance: null };

const bench = {
  prescribed_sets_min: 1,
  prescribed_sets_max: 1,
  prescribed_reps_min: 3,
  prescribed_reps_max: 5,
  warm_up_sets_min: 3,
  warm_up_sets_max: 4,
  sets: [] as SetRow[],
};

const benchLast: LastTime = {
  completedAt: "2026-07-21T12:00:00Z",
  sets: [
    { set_number: 1, is_warm_up: true, is_drop_set: false, weight: 50, reps: 4, ...cardio },
    { set_number: 2, is_warm_up: true, is_drop_set: false, weight: 70, reps: 4, ...cardio },
    { set_number: 3, is_warm_up: true, is_drop_set: false, weight: 90, reps: 4, ...cardio },
    { set_number: 4, is_warm_up: false, is_drop_set: false, weight: 180, reps: 4, ...cardio },
  ],
};

describe("buildRows", () => {
  it("lays out the prescription's warm-ups and working sets, prefilled from last time", () => {
    const rows = buildRows(bench, benchLast);
    expect(rows.map((r) => r.label)).toEqual(["W", "W", "W", "W", "1"]);
    expect(rows.map((r) => r.weight)).toEqual([50, 70, 90, 90, 180]);
    expect(rows[4].reps).toBe(4);
    expect(rows[3].last).toBeNull();
  });

  it("fills rows with the sets already logged, warm-ups and working sets apart", () => {
    const rows = buildRows({ ...bench, sets: [set(1, 50, 4, true), set(2, 185, 4)] }, benchLast);
    expect(rows[0].set?.id).toBe("s1");
    expect(rows[1].set).toBeNull();
    expect(rows[4].set?.id).toBe("s2");
    expect(rows[4].weight).toBe(185);
    expect(nextRow(rows)).toBe(1);
  });

  it("uses the prescribed reps when there is no history", () => {
    const rows = buildRows({ ...bench, warm_up_sets_min: null, warm_up_sets_max: null }, null);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ kind: "work", weight: null, reps: 5 });
  });

  it("gives an exercise with no prescription one row, so it can be finished", () => {
    const rows = buildRows({ prescribed_sets_min: null, prescribed_sets_max: null, prescribed_reps_min: null, prescribed_reps_max: null, warm_up_sets_min: null, warm_up_sets_max: null, sets: [] }, null);
    expect(rows).toHaveLength(1);
  });

  it("adds rows for extra sets and marks drop sets", () => {
    const rows = buildRows({ ...bench, warm_up_sets_min: 0, warm_up_sets_max: 0, sets: [set(1, 180, 4), set(2, 140, 8, false, true)] }, null);
    expect(rows.map((r) => r.label)).toEqual(["1", "D"]);
    expect(isDone(rows)).toBe(true);
  });

  it("carries the weight down to the next row when last time had fewer sets", () => {
    const rows = buildRows({ ...bench, prescribed_sets_max: 3, warm_up_sets_max: 0, warm_up_sets_min: 0 }, benchLast);
    expect(rows.map((r) => r.weight)).toEqual([180, 180, 180]);
  });
});

describe("rowLabel", () => {
  it("names warm-ups and sets by their own count", () => {
    const rows = buildRows(bench, benchLast);
    expect(rowLabel(rows, 1)).toBe("Warm-up 2 of 4");
    expect(rowLabel(rows, 4)).toBe("Set 1 of 1");
  });
});

describe("progress and totals", () => {
  it("counts logged rows over every row", () => {
    const a = buildRows({ ...bench, sets: [set(1, 50, 4, true)] }, null);
    const b = buildRows({ ...bench, warm_up_sets_max: 0, warm_up_sets_min: 0, sets: [] }, null);
    expect(progress([a, b])).toEqual({ logged: 1, total: 6, percent: 17 });
  });

  it("leaves warm-ups out of working sets and volume", () => {
    expect(totals([set(1, 50, 4, true), set(2, 180, 4), set(3, 140, 8, false, true)])).toEqual({ sets: 2, volume: 180 * 4 + 140 * 8 });
  });
});

describe("records", () => {
  const history = [
    { exercise_id: "b", workout_id: "w1", weight: 180, reps: 4, completed_at: "2026-07-21", floor: null },
    { exercise_id: "b", workout_id: "w0", weight: 170, reps: 8, completed_at: "2026-07-01", floor: null },
  ];

  it("takes the heaviest weight and best estimated 1RM", () => {
    expect(best(history)).toEqual({ weight: 180, e1rm: 215.33 });
    expect(best([])).toBeNull();
  });

  it("prefers a heavier weight, then a better 1RM, and nothing on a first session", () => {
    const prev = best(history);
    expect(newRecord([set(1, 185, 3)], prev)).toEqual({ kind: "weight", value: 185, previous: 180 });
    expect(newRecord([set(1, 175, 10)], prev)).toEqual({ kind: "e1rm", value: 233, previous: 215 });
    expect(newRecord([set(1, 150, 5)], prev)).toBeNull();
    expect(newRecord([set(1, 185, 3)], null)).toBeNull();
    expect(newRecord([set(1, 300, 1, true)], prev)).toBeNull();
  });
});

describe("step", () => {
  it("moves weight by 5 lb or 2.5 kg and reps by 1, never below zero", () => {
    expect(step(180, "weight", 1, "lbs")).toBe(185);
    expect(step(80, "weight", -1, "kg")).toBe(77.5);
    expect(step(null, "reps", 1, "lbs")).toBe(1);
    expect(step(0, "reps", -1, "lbs")).toBe(0);
  });
});

describe("swappedFrom", () => {
  it("remembers where the row started and forgets it once the row is back", () => {
    expect(swappedFrom({ exerciseId: "bench", swappedFrom: null }, "db")).toBe("bench");
    expect(swappedFrom({ exerciseId: "db", swappedFrom: "bench" }, "machine")).toBe("bench");
    expect(swappedFrom({ exerciseId: "db", swappedFrom: "bench" }, "bench")).toBeNull();
  });
});

describe("repTarget", () => {
  const rx = (min: number | null, max: number | null) => ({ prescribed_reps_min: min, prescribed_reps_max: max });
  it("shows the prescription for a working set", () => {
    expect(repTarget(rx(8, 8), { kind: "work", reps: 6 })).toBe("8x");
    expect(repTarget(rx(8, 10), { kind: "work", reps: 6 })).toBe("8–10x");
    expect(repTarget(rx(null, 12), { kind: "drop", reps: null })).toBe("12x");
  });
  it("falls back to the row's reps, and to nothing", () => {
    expect(repTarget(rx(8, 10), { kind: "warm", reps: 5 })).toBe("5x");
    expect(repTarget(rx(null, null), { kind: "work", reps: 7 })).toBe("7x");
    expect(repTarget(rx(null, null), { kind: "warm", reps: null })).toBeNull();
    expect(repTarget(rx(8, 8), null)).toBeNull();
  });
});

describe("measures (migration 0027)", () => {
  const plain = {
    prescribed_sets_min: 2,
    prescribed_sets_max: 2,
    prescribed_reps_min: null,
    prescribed_reps_max: null,
    warm_up_sets_min: null,
    warm_up_sets_max: null,
    sets: [] as SetRow[],
  };

  it("prefills a held stretch with 30 seconds and heads it with the duration", () => {
    const we = { ...plain, prescribed_seconds_min: null, prescribed_seconds_max: null, exercises: { measure: "hold" as const } };
    const rows = buildRows(we, null);
    expect(rows.map((r) => r.seconds)).toEqual([30, 30]);
    expect(repTarget(we, rows[0])).toBe("30s");
  });

  it("prefills a plank from its prescribed seconds", () => {
    const we = { ...plain, prescribed_seconds_min: 30, prescribed_seconds_max: 30, exercises: { measure: "time" as const } };
    expect(buildRows(we, null)[0].seconds).toBe(30);
    expect(repTarget(we, buildRows(we, null)[0])).toBe("30s");
  });

  it("carries a treadmill's last incline, speed and time, with no rep target", () => {
    const we = { ...plain, prescribed_sets_min: 1, prescribed_sets_max: 1, exercises: { measure: "treadmill" as const } };
    const last: LastTime = {
      completedAt: "2026-11-01T12:00:00Z",
      sets: [{ set_number: 1, is_warm_up: false, is_drop_set: false, weight: null, reps: null, seconds: 600, incline: 5, speed: 6, distance: null }],
    };
    const [row] = buildRows(we, last);
    expect([row.incline, row.speed, row.seconds]).toEqual([5, 6, 600]);
    expect(repTarget(we, row)).toBeNull();
  });

  it("keeps the rep target for reps-only work", () => {
    const we = { ...plain, prescribed_reps_min: 10, prescribed_reps_max: 12, exercises: { measure: "reps" as const } };
    expect(repTarget(we, buildRows(we, null)[0])).toBe("10–12x");
  });
});
