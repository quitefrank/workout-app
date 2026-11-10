import { describe, expect, it } from "vitest";
import {
  FIELDS,
  fieldLabel,
  formatDuration,
  formatField,
  hasValue,
  measureOf,
  parseField,
  prescribedSeconds,
  restsByDefault,
  stepField,
  summarize,
} from "../measure";

describe("FIELDS", () => {
  it("shows one, two, three or no steppers by measure", () => {
    expect(FIELDS.weight_reps).toEqual(["weight", "reps"]);
    expect(FIELDS.reps).toEqual(["reps"]);
    expect(FIELDS.time).toEqual(["seconds"]);
    expect(FIELDS.hold).toEqual([]);
    expect(FIELDS.treadmill).toEqual(["incline", "speed", "seconds"]);
    expect(FIELDS.outdoor).toEqual(["distance"]);
  });

  it("defaults a missing measure to weight × reps", () => {
    expect(measureOf(null)).toBe("weight_reps");
    expect(measureOf({})).toBe("weight_reps");
    expect(measureOf({ measure: "reps" })).toBe("reps");
  });
});

describe("labels", () => {
  it("names each stepper", () => {
    expect(fieldLabel("weight", "weight_reps", "lbs")).toBe("lbs");
    expect(fieldLabel("reps", "weight_reps", "lbs")).toBe("Reps");
    expect(fieldLabel("reps", "weight_steps", "lbs")).toBe("Steps");
    expect(fieldLabel("speed", "treadmill", "lbs")).toBe("km/h");
    expect(fieldLabel("distance", "outdoor", "kg")).toBe("km");
  });
});

describe("stepField", () => {
  it("steps by Frank's sizes", () => {
    expect(stepField(135, "weight", 1, "lbs")).toBe(140);
    expect(stepField(60, "weight", -1, "kg")).toBe(57.5);
    expect(stepField(8, "reps", 1, "lbs")).toBe(9);
    expect(stepField(600, "seconds", 1, "lbs")).toBe(630);
    expect(stepField(5, "incline", 1, "lbs")).toBe(5.5);
    expect(stepField(6, "speed", -1, "lbs")).toBe(5.5);
    expect(stepField(null, "distance", 1, "lbs")).toBe(0.5);
  });

  it("never goes below zero", () => {
    expect(stepField(10, "seconds", -1, "lbs")).toBe(0);
    expect(stepField(null, "incline", -1, "lbs")).toBe(0);
  });
});

describe("parseField and formatField", () => {
  it("reads time as m:ss or bare seconds", () => {
    expect(parseField("seconds", "1:30")).toBe(90);
    expect(parseField("seconds", "10:00")).toBe(600);
    expect(parseField("seconds", "45")).toBe(45);
    expect(parseField("seconds", "1:75")).toBeUndefined();
  });

  it("rounds whole fields and keeps decimals elsewhere", () => {
    expect(parseField("reps", "8.4")).toBe(8);
    expect(parseField("speed", "6.5")).toBe(6.5);
    expect(parseField("weight", "")).toBeNull();
    expect(parseField("weight", "-5")).toBeUndefined();
  });

  it("shows time as m:ss", () => {
    expect(formatField("seconds", 630)).toBe("10:30");
    expect(formatField("incline", 2.5)).toBe("2.5");
    expect(formatField("reps", null)).toBe("");
  });
});

describe("summarize", () => {
  it("writes a set in one line per measure", () => {
    expect(summarize("weight_reps", { weight: 135, reps: 8 }, "lbs")).toBe("135 lbs × 8");
    expect(summarize("reps", { reps: 12 }, "lbs")).toBe("12 reps");
    expect(summarize("weight_steps", { weight: 70, reps: 40 }, "lbs")).toBe("70 lbs × 40 steps");
    expect(summarize("hold", { seconds: 30 }, "lbs")).toBe("0:30");
    expect(summarize("treadmill", { incline: 5, speed: 6, seconds: 600 }, "lbs")).toBe("5% · 6 km/h · 10:00");
    expect(summarize("outdoor", { distance: 5.2, seconds: 1800 }, "lbs")).toBe("5.2 km · 30:00");
    expect(summarize("outdoor", { distance: 5 }, "lbs")).toBe("5 km");
  });
});

describe("durations and defaults", () => {
  it("formats a header duration", () => {
    expect(formatDuration(30)).toBe("30s");
    expect(formatDuration(600)).toBe("10 min");
    expect(formatDuration(630)).toBe("10:30");
  });

  it("holds 30 seconds when nothing is written", () => {
    const none = { prescribed_seconds_min: null, prescribed_seconds_max: null };
    expect(prescribedSeconds("hold", none)).toBe(30);
    expect(prescribedSeconds("time", none)).toBeNull();
    expect(prescribedSeconds("time", { prescribed_seconds_min: 20, prescribed_seconds_max: 30 })).toBe(30);
  });

  it("rests by default only after lifts", () => {
    expect(restsByDefault("weight_reps")).toBe(true);
    expect(restsByDefault("reps")).toBe(true);
    expect(restsByDefault("hold")).toBe(false);
    expect(restsByDefault("treadmill")).toBe(false);
  });

  it("needs a value to log, except a hold", () => {
    expect(hasValue("hold", {})).toBe(true);
    expect(hasValue("reps", { weight: 10 })).toBe(false);
    expect(hasValue("treadmill", { speed: 6 })).toBe(true);
  });
});
