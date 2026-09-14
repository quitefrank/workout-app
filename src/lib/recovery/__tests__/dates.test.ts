import { describe, expect, it } from "vitest";
import {
  addDays,
  assertIsoDate,
  dayIndex,
  isoWeekStart,
  phaseWindow,
  weekIndex,
} from "../dates";

// Placeholder injury date. Real dates live in the per-user seed only.
const INJURY = "2000-03-01";

describe("dayIndex", () => {
  it("is 0 on the injury date and nothing else defines day 0", () => {
    expect(dayIndex(INJURY, "2000-03-01")).toBe(0);
  });

  it("counts calendar days forward", () => {
    expect(dayIndex(INJURY, "2000-03-02")).toBe(1);
    expect(dayIndex(INJURY, "2000-03-31")).toBe(30);
  });

  it("is negative before the injury", () => {
    expect(dayIndex(INJURY, "2000-02-28")).toBe(-2);
  });

  it("is unaffected by a daylight-saving change in between", () => {
    // 2000-04-02 was a DST change in North America.
    expect(dayIndex("2000-03-30", "2000-04-05")).toBe(6);
  });

  it("rejects a non-ISO date", () => {
    expect(() => dayIndex(INJURY, "March 1")).toThrow(/Not an ISO date/);
  });

  it("rejects a date that only looks valid", () => {
    expect(() => dayIndex(INJURY, "2000-02-30")).toThrow(/Not a calendar date/);
    expect(() => dayIndex(INJURY, "2000-13-01")).toThrow(/Not a calendar date/);
  });
});

describe("weekIndex", () => {
  it("floors days by 7", () => {
    expect(weekIndex(INJURY, "2000-03-01")).toBe(0);
    expect(weekIndex(INJURY, "2000-03-07")).toBe(0);
    expect(weekIndex(INJURY, "2000-03-08")).toBe(1);
    expect(weekIndex(INJURY, "2000-03-29")).toBe(4);
  });

  it("floors toward negative infinity before the injury", () => {
    expect(weekIndex(INJURY, "2000-02-29")).toBe(-1);
  });
});

describe("addDays", () => {
  it("crosses a month boundary", () => {
    expect(addDays("2000-02-28", 2)).toBe("2000-03-01");
  });

  it("goes backward", () => {
    expect(addDays("2000-03-01", -1)).toBe("2000-02-29");
  });

  it("rejects a fractional or NaN day count", () => {
    expect(() => addDays(INJURY, 1.5)).toThrow(/whole number/);
    expect(() => addDays(INJURY, Number.NaN)).toThrow(/whole number/);
  });
});

describe("isoWeekStart", () => {
  it("returns the Monday of the week", () => {
    expect(isoWeekStart("2000-03-01")).toBe("2000-02-28"); // Wednesday
    expect(isoWeekStart("2000-02-28")).toBe("2000-02-28"); // Monday
    expect(isoWeekStart("2000-03-05")).toBe("2000-02-28"); // Sunday
    expect(isoWeekStart("2000-01-01")).toBe("1999-12-27"); // crosses the year
  });
});

describe("assertIsoDate", () => {
  it("passes a real date and throws otherwise", () => {
    expect(() => assertIsoDate("2000-02-29")).not.toThrow();
    expect(() => assertIsoDate("2001-02-29")).toThrow();
    expect(() => assertIsoDate("")).toThrow(/Not an ISO date/);
  });
});

describe("phaseWindow", () => {
  it("runs from the first day of week_from to the last day before week_to", () => {
    expect(phaseWindow(INJURY, 2, 6)).toEqual({
      start: "2000-03-15",
      end: "2000-04-11",
    });
  });

  it("is open-ended when week_to is null", () => {
    expect(phaseWindow(INJURY, 53, null)).toEqual({
      start: "2001-03-07",
      end: null,
    });
  });
});
