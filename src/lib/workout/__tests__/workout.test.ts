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
  setsToLine,
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
  weekNumber,
  weekCells,
  sameWeekdayIn,
  dayTitle,
  parseYearMonth,
  shiftMonth,
  weekStarts,
  workoutDay,
} from "../dates";
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

  it("reads drop sets out under their own label", () => {
    const s = (weight: number, reps: number, is_drop_set = false) => ({ is_warm_up: false, is_drop_set, weight, reps });
    expect(setsToLine([s(150, 8), s(150, 7), s(100, 12, true)])).toBe("150(8), 150(7) · Drop 100(12)");
    expect(setsToLine([s(100, 12, true)])).toBe("Drop 100(12)");
    expect(setsToLine([s(150, 8)])).toBe("150(8)");
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

  it("builds whole Monday-first weeks", () => {
    const weeks = monthGrid({ year: 2026, month: 10 });
    // October 2026 starts on a Thursday
    expect(weeks[0].map((c) => c.day)).toEqual([28, 29, 30, 1, 2, 3, 4]);
    expect(weeks[0][0].inMonth).toBe(false);
    expect(weeks.every((w) => w.length === 7)).toBe(true);
    expect(weeks.flat().filter((c) => c.inMonth)).toHaveLength(31);
    expect(gridBounds({ year: 2026, month: 10 })).toEqual({ from: "2026-09-28", to: "2026-11-01" });
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

  it("finds the month a date sits in", () => {
    expect(monthOf("2026-10-24")).toEqual({ year: 2026, month: 10 });
  });

  it("numbers weeks from Monday to Sunday, across month and year ends", () => {
    expect(weekNumber("1970-01-05")).toBe(0);
    expect(weekNumber("2026-11-02")).toBe(weekNumber("2026-11-08"));
    expect(weekNumber("2026-11-09")).toBe(weekNumber("2026-11-08") + 1);
    expect(weekNumber("2026-12-28")).toBe(weekNumber("2027-01-03"));
  });

  it("lists a week's seven days, Monday first", () => {
    const week = weekCells(weekNumber("2026-11-04"));
    expect(week.map((c) => c.date)).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"]);
    expect(week[2].day).toBe(4);
    expect(weekCells(weekNumber("2026-12-30")).at(-1)?.date).toBe("2027-01-03");
  });

  it("keeps the weekday when moved to another week, as a swipe of the strip does", () => {
    const week = weekNumber("2026-10-26");
    expect(sameWeekdayIn("2026-10-26", week + 1)).toBe("2026-11-02");
    expect(sameWeekdayIn("2026-10-26", week + 3)).toBe("2026-11-16");
    expect(sameWeekdayIn("2026-10-26", week - 1)).toBe("2026-10-19");
    expect(sameWeekdayIn("2026-10-26", week)).toBe("2026-10-26");
  });

  it("titles a day with its short weekday, and today as today, never with a year", () => {
    expect(dayTitle("2026-11-04", "2026-11-04")).toBe("Today, Nov 4");
    expect(dayTitle("2026-11-03", "2026-11-04")).toBe("Tue, Nov 3");
    expect(dayTitle("2026-11-11", "2026-11-04")).toBe("Wed, Nov 11");
    expect(dayTitle("2027-03-06", "2026-11-04")).toBe("Sat, Mar 6");
  });

  it("labels a day in full", () => {
    expect(longDayLabel("2026-10-24")).toBe("Saturday, Oct 24");
  });
});

describe("progress", () => {
  const rows: TopSet[] = [
    { exercise_id: "bench", workout_id: "w1", weight: 100, reps: 5, completed_at: "2026-09-01T10:00:00Z", floor: null },
    { exercise_id: "bench", workout_id: "w2", weight: 100, reps: 4, completed_at: "2026-09-08T10:00:00Z", floor: null },
    { exercise_id: "bench", workout_id: "w3", weight: 105, reps: 5, completed_at: "2026-09-15T10:00:00Z", floor: null },
    { exercise_id: "squat", workout_id: "w3", weight: 200, reps: 3, completed_at: "2026-09-15T10:00:00Z", floor: null },
  ];

  it("keeps PRs separate per floor", () => {
    const crunch: TopSet[] = [
      { exercise_id: "crunch", workout_id: "a", weight: 130, reps: 10, completed_at: "2026-09-01T10:00:00Z", floor: "downstairs" },
      // far lighter, but the first session on this floor: a baseline, not beaten by the other floor
      { exercise_id: "crunch", workout_id: "b", weight: 40, reps: 10, completed_at: "2026-09-02T10:00:00Z", floor: "upstairs" },
      // a PR upstairs, though it is well below the downstairs best
      { exercise_id: "crunch", workout_id: "c", weight: 50, reps: 10, completed_at: "2026-09-03T10:00:00Z", floor: "upstairs" },
      // not a PR downstairs, though it beats everything upstairs
      { exercise_id: "crunch", workout_id: "d", weight: 120, reps: 10, completed_at: "2026-09-04T10:00:00Z", floor: "downstairs" },
    ];
    expect(prs(crunch).map((p) => p.workout_id)).toEqual(["c"]);
  });

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
