import { describe, expect, it } from "vitest";
import {
  displayWeight,
  doseText,
  formatClock,
  formatNumber,
  formatRest,
  prescriptionParts,
  range,
  setShorthand,
  setsToCsv,
  type Prescription,
} from "../format";
import {
  dayLabel,
  durationMinutes,
  gridBounds,
  localDate,
  longDayLabel,
  monthGrid,
  monthOf,
  shiftDate,
  shiftDateMonth,
  weekIndexOf,
  parseYearMonth,
  shiftMonth,
  weekStarts,
  workoutDay,
} from "../dates";
import { siblingFor } from "../machine-location";
import { bests, latestByExercise, prs, type TopSet } from "../progress";

const empty: Prescription = {
  prescribed_sets_min: null,
  prescribed_sets_max: null,
  prescribed_reps_min: null,
  prescribed_reps_max: null,
  prescribed_rir_min: null,
  prescribed_rir_max: null,
  prescribed_seconds_min: null,
  prescribed_seconds_max: null,
  prescribed_rest_seconds: null,
  prescribed_rpe: null,
  warm_up_sets_min: null,
  warm_up_sets_max: null,
};

describe("format", () => {
  it("renders ranges", () => {
    expect(range(3, 5)).toBe("3-5");
    expect(range(3, 3)).toBe("3");
    expect(range(null, 4)).toBe("4");
    expect(range(null, null)).toBeNull();
  });

  it("trims numeric noise", () => {
    expect(formatNumber("100.00")).toBe("100");
    expect(formatNumber(42.5)).toBe("42.5");
    expect(formatNumber(null)).toBe("");
  });

  it("drops the unit for machine readings", () => {
    expect(displayWeight(160, "dumbbell", "lbs")).toBe("160 lbs");
    expect(displayWeight("12.00", "machine", "lbs")).toBe("12");
    expect(displayWeight(8, "cardio_machine", "kg")).toBe("8");
    expect(displayWeight(null, "barbell", "lbs")).toBe("");
  });

  it("writes sets back in the Notion Weight format", () => {
    expect(
      setsToCsv([
        { is_warm_up: true, weight: 50, reps: 10 },
        { is_warm_up: true, weight: "70.00", reps: null },
        { is_warm_up: false, weight: 100, reps: 5 },
        { is_warm_up: false, weight: null, reps: 12 },
        { is_warm_up: false, weight: 42.5, reps: null },
      ]),
    ).toBe("50, 70, 100(5), 0(12), 42.5");
    expect(setsToCsv([])).toBe("");
  });

  it("writes set shorthand", () => {
    expect(setShorthand(160, 4)).toBe("160 × 4");
    expect(setShorthand(null, 12)).toBe("12 reps");
    expect(setShorthand(100, null)).toBe("100");
  });

  it("formats rest and clocks", () => {
    expect(formatRest(180)).toBe("3 min");
    expect(formatRest(90)).toBe("1 min 30 s");
    expect(formatRest(45)).toBe("45 s");
    expect(formatRest(null)).toBeNull();
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3723)).toBe("1:02:03");
    expect(formatClock(-4)).toBe("0:00");
  });

  it("writes the dose as reps, seconds or RIR", () => {
    expect(doseText({ ...empty, prescribed_sets_min: 3, prescribed_sets_max: 3, prescribed_reps_min: 6, prescribed_reps_max: 8 })).toBe("3 × 6-8");
    expect(doseText({ ...empty, prescribed_sets_min: 2, prescribed_seconds_min: 30, prescribed_seconds_max: 45 })).toBe("2 × 30-45 s");
    expect(doseText({ ...empty, prescribed_sets_min: 3, prescribed_rir_min: 1, prescribed_rir_max: 2 })).toBe("3 × RIR 1-2");
    expect(doseText({ ...empty, prescribed_sets_min: 1 })).toBe("1 set");
    expect(doseText(empty)).toBeNull();
  });

  it("lists warm-ups, dose, RPE and rest in order", () => {
    expect(
      prescriptionParts({
        ...empty,
        warm_up_sets_min: 3,
        warm_up_sets_max: 4,
        prescribed_sets_min: 1,
        prescribed_reps_min: 4,
        prescribed_reps_max: 6,
        prescribed_rpe: "8-9",
        prescribed_rest_seconds: 210,
      }),
    ).toEqual(["3-4 warm-up", "1 × 4-6", "RPE 8-9", "3 min 30 s rest"]);
    expect(prescriptionParts({ ...empty, warm_up_sets_min: 0, warm_up_sets_max: 0 })).toEqual([]);
  });
});

describe("dates", () => {
  it("reads the local day in New York, not UTC", () => {
    expect(localDate("2026-10-13T02:30:00Z")).toBe("2026-10-12");
    expect(localDate("2026-10-13T05:00:00Z")).toBe("2026-10-13");
  });

  it("prefers the scheduled date for a workout's day", () => {
    expect(workoutDay({ scheduled_for: "2026-10-01", completed_at: "2026-10-03T12:00:00Z", started_at: null })).toBe("2026-10-01");
    expect(workoutDay({ scheduled_for: null, completed_at: "2026-10-03T02:00:00Z", started_at: null })).toBe("2026-10-02");
    expect(workoutDay({ scheduled_for: null, completed_at: null, started_at: null })).toBeNull();
  });

  it("parses and shifts months", () => {
    expect(parseYearMonth("2026-10")).toEqual({ year: 2026, month: 10 });
    expect(parseYearMonth("2026-13")).toBeNull();
    expect(parseYearMonth("oct")).toBeNull();
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2026, month: 1 }, -1)).toEqual({ year: 2025, month: 12 });
  });

  it("builds whole Sunday-first weeks", () => {
    const weeks = monthGrid({ year: 2026, month: 10 });
    // October 2026 starts on a Thursday
    expect(weeks[0].map((c) => c.day)).toEqual([27, 28, 29, 30, 1, 2, 3]);
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(gridBounds({ year: 2026, month: 10 })).toEqual({ from: "2026-09-27", to: "2026-10-31" });
  });

  it("lists the Mondays of recent weeks", () => {
    // 2026-10-12 is a Monday, 2026-10-18 the Sunday after it
    expect(weekStarts("2026-10-12", 3)).toEqual(["2026-09-28", "2026-10-05", "2026-10-12"]);
    expect(weekStarts("2026-10-18", 1)).toEqual(["2026-10-12"]);
  });

  it("labels days and durations", () => {
    expect(dayLabel("2026-10-12")).toBe("Mon, Oct 12");
    expect(durationMinutes("2026-10-12T10:00:00Z", "2026-10-12T11:05:00Z")).toBe(65);
    expect(durationMinutes(null, "2026-10-12T11:05:00Z")).toBeNull();
  });
});

describe("calendar navigation", () => {
  it("moves dates by days across month and year ends", () => {
    expect(shiftDate("2026-10-31", 1)).toBe("2026-11-01");
    expect(shiftDate("2026-01-03", -7)).toBe("2025-12-27");
    expect(shiftDate("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("moves dates by months, keeping the day where the month has it", () => {
    expect(shiftDateMonth("2026-10-24", 1)).toBe("2026-11-24");
    expect(shiftDateMonth("2026-01-31", 1)).toBe("2026-02-28");
    expect(shiftDateMonth("2026-01-15", -1)).toBe("2025-12-15");
  });

  it("finds the month and the grid week a date sits in", () => {
    expect(monthOf("2026-10-24")).toEqual({ year: 2026, month: 10 });
    const weeks = monthGrid({ year: 2026, month: 10 });
    // October 2026 starts on a Thursday: Sep 27 to Oct 3 is week 0, Oct 24 closes week 3
    expect(weekIndexOf(weeks, "2026-09-27")).toBe(0);
    expect(weekIndexOf(weeks, "2026-10-24")).toBe(3);
    expect(weekIndexOf(weeks, "2026-12-25")).toBe(0);
  });

  it("labels a day in full", () => {
    expect(longDayLabel("2026-10-24")).toBe("Saturday, Oct 24");
  });
});

describe("machine location", () => {
  const lib = [
    { id: "a", name: "Chest Press", machine_location: "upstairs" as const },
    { id: "b", name: "Chest Press", machine_location: "downstairs" as const },
    { id: "c", name: "Leg Extension", machine_location: "upstairs" as const },
    { id: "d", name: "Bench Press", machine_location: null },
  ];

  it("swaps to the sibling on the other floor", () => {
    expect(siblingFor(lib[0], "downstairs", lib).id).toBe("b");
    expect(siblingFor(lib[1], "upstairs", lib).id).toBe("a");
  });

  it("keeps the row when there is no sibling, no location, or no choice", () => {
    expect(siblingFor(lib[2], "downstairs", lib).id).toBe("c");
    expect(siblingFor(lib[3], "upstairs", lib).id).toBe("d");
    expect(siblingFor(lib[0], null, lib).id).toBe("a");
  });
});

describe("progress", () => {
  const rows: TopSet[] = [
    { exercise_id: "bench", workout_id: "w1", weight: 100, reps: 5, completed_at: "2026-09-01T10:00:00Z" },
    { exercise_id: "bench", workout_id: "w2", weight: 100, reps: 4, completed_at: "2026-09-08T10:00:00Z" },
    { exercise_id: "bench", workout_id: "w3", weight: 105, reps: 5, completed_at: "2026-09-15T10:00:00Z" },
    { exercise_id: "squat", workout_id: "w3", weight: 200, reps: 3, completed_at: "2026-09-15T10:00:00Z" },
  ];

  it("finds the latest top set per exercise", () => {
    const m = latestByExercise(rows);
    expect(m.get("bench")?.workout_id).toBe("w3");
    expect(m.get("squat")?.weight).toBe(200);
  });

  it("finds the heaviest set and the best estimated 1RM", () => {
    const b = bests(rows.filter((r) => r.exercise_id === "bench"));
    expect(b.heaviest?.workout_id).toBe("w3");
    expect(b.bestE1rm?.e1rm).toBe(122.5);
  });

  it("counts a PR only when it beats an earlier session", () => {
    const out = prs(rows);
    expect(out.map((p) => p.workout_id)).toEqual(["w3"]);
    expect(out[0].previous).toBeCloseTo(116.67, 2);
  });
});
