import { describe, expect, it } from "vitest";
import { loggedSeconds, parseStoredSetTimer, viewSetTimer, type StoredSetTimer } from "../set-timer";

const hold: StoredSetTimer = { weId: "we1", row: 0, mode: "hold", startedAt: 1_000_000, total: 30 };
const watch: StoredSetTimer = { ...hold, mode: "watch", total: 0 };

describe("viewSetTimer", () => {
  it("counts a hold down and finishes at zero", () => {
    expect(viewSetTimer(hold, 1_000_000)).toEqual({ elapsed: 0, remaining: 30, done: false });
    expect(viewSetTimer(hold, 1_010_400)).toEqual({ elapsed: 10, remaining: 20, done: false });
    expect(viewSetTimer(hold, 1_031_000)).toEqual({ elapsed: 30, remaining: 0, done: true });
  });

  it("counts a watch up without end", () => {
    expect(viewSetTimer(watch, 1_000_000 + 1_805_000)).toEqual({ elapsed: 1805, remaining: 0, done: false });
  });
});

describe("loggedSeconds", () => {
  it("logs a finished hold's full length and an early stop's time so far", () => {
    expect(loggedSeconds(hold, 1_040_000)).toBe(30);
    expect(loggedSeconds(hold, 1_012_000)).toBe(12);
    expect(loggedSeconds(watch, 1_000_000 + 600_000)).toBe(600);
  });
});

describe("parseStoredSetTimer", () => {
  it("reads a stored timer and rejects anything else", () => {
    expect(parseStoredSetTimer(JSON.stringify(hold))).toEqual(hold);
    expect(parseStoredSetTimer(JSON.stringify({ ...hold, mode: "lap" }))).toBeNull();
    expect(parseStoredSetTimer("{bad")).toBeNull();
    expect(parseStoredSetTimer(null)).toBeNull();
  });
});
