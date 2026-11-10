/**
 * What a set records, by exercise (migration 0027, Frank's calls of 2026-11-09). `exercises.measure` names the fields
 * the active workout's controls zone shows: two steppers side by side, one across the width, three for a treadmill, or
 * none for a held stretch. Pure, so it has tests.
 */

import { formatClock, formatNumber } from "./format";

export type Measure =
  | "weight_reps"
  | "reps"
  | "weight_steps"
  | "weight_time"
  | "time"
  | "hold"
  | "treadmill"
  | "outdoor";

export type Field = "weight" | "reps" | "seconds" | "incline" | "speed" | "distance";

export type SetValues = Record<Field, number | null>;

export const EMPTY: SetValues = { weight: null, reps: null, seconds: null, incline: null, speed: null, distance: null };

/** The steppers each measure shows, in order. A hold shows none; an outdoor run's time is kept by the app. */
export const FIELDS: Record<Measure, readonly Field[]> = {
  weight_reps: ["weight", "reps"],
  reps: ["reps"],
  weight_steps: ["weight", "reps"],
  weight_time: ["weight", "seconds"],
  time: ["seconds"],
  hold: [],
  treadmill: ["incline", "speed", "seconds"],
  outdoor: ["distance"],
};

/** A seconds hold with nothing written is 30 seconds (Frank's call, 2026-11-09). */
export const DEFAULT_HOLD_SECONDS = 30;

export function measureOf(ex: { measure?: Measure | null } | null | undefined): Measure {
  return ex?.measure ?? "weight_reps";
}

/** The label over a stepper ("LBS", "REPS", "STEPS", "TIME", "INCLINE", "KM/H", "KM"), shown in capitals by CSS. */
export function fieldLabel(field: Field, measure: Measure, unit: "lbs" | "kg"): string {
  switch (field) {
    case "weight":
      return unit;
    case "reps":
      return measure === "weight_steps" ? "Steps" : "Reps";
    case "seconds":
      return "Time";
    case "incline":
      return "Incline";
    case "speed":
      return "km/h";
    case "distance":
      return "km";
  }
}

/** One stepper tap: 5 lb or 2.5 kg, 1 rep, 30 s, 0.5 % incline, 0.5 km/h, 0.5 km. */
export function stepSize(field: Field, unit: "lbs" | "kg"): number {
  switch (field) {
    case "weight":
      return unit === "kg" ? 2.5 : 5;
    case "reps":
      return 1;
    case "seconds":
      return 30;
    default:
      return 0.5;
  }
}

/** One tap from `value`, never below zero; an empty value starts from zero. */
export function stepField(value: number | null, field: Field, dir: 1 | -1, unit: "lbs" | "kg"): number {
  return Math.max(0, Math.round(((value ?? 0) + dir * stepSize(field, unit)) * 100) / 100);
}

/** Whole numbers only: reps and seconds. */
export function isWhole(field: Field): boolean {
  return field === "reps" || field === "seconds";
}

/** The number as a stepper shows it: time as m:ss, the rest as plain numbers. */
export function formatField(field: Field, value: number | null): string {
  if (value == null) return "";
  return field === "seconds" ? formatClock(value) : formatNumber(value);
}

/**
 * A typed value: "1:30" or "90" for time (a bare number is seconds), a number otherwise. Undefined when it cannot be
 * read, null when empty.
 */
export function parseField(field: Field, text: string): number | null | undefined {
  const t = text.trim();
  if (t === "") return null;
  if (field === "seconds") {
    const m = /^(\d+):([0-5]?\d)$/.exec(t);
    if (m) return Number(m[1]) * 60 + Number(m[2]);
  }
  const n = Number(t);
  if (!Number.isFinite(n) || n < 0) return undefined;
  return isWhole(field) ? Math.round(n) : n;
}

/** A duration for a header or a summary: "30s" under two minutes, else "10 min" or "10:30". */
export function formatDuration(seconds: number): string {
  if (seconds < 120) return `${seconds}s`;
  return seconds % 60 === 0 ? `${seconds / 60} min` : formatClock(seconds);
}

/** A set in one line, for "Last time" and the Journal: "135 lbs × 8", "12 reps", "5% · 6 km/h · 10:00", "5 km". */
export function summarize(measure: Measure, v: Partial<SetValues>, unit: "lbs" | "kg"): string {
  const n = (x: number | null | undefined) => (x == null ? "–" : formatNumber(x));
  const time = (x: number | null | undefined) => (x == null ? "–" : formatClock(x));
  switch (measure) {
    case "weight_reps":
      return `${n(v.weight)} ${unit} × ${v.reps ?? "–"}`;
    case "weight_steps":
      return `${n(v.weight)} ${unit} × ${v.reps ?? "–"} steps`;
    case "reps":
      return `${v.reps ?? "–"} reps`;
    case "weight_time":
      return `${n(v.weight)} ${unit} × ${time(v.seconds)}`;
    case "time":
    case "hold":
      return time(v.seconds);
    case "treadmill":
      return `${n(v.incline)}% · ${n(v.speed)} km/h · ${time(v.seconds)}`;
    case "outdoor":
      return v.seconds != null ? `${n(v.distance)} km · ${time(v.seconds)}` : `${n(v.distance)} km`;
  }
}

/** A set for the Journal's narrow Last column, without units: "135 × 8", "12", "0:30", "6 · 10:00", "5 km". */
export function summarizeShort(measure: Measure, v: Partial<SetValues>): string {
  const n = (x: number | null | undefined) => (x == null ? "–" : formatNumber(x));
  const time = (x: number | null | undefined) => (x == null ? "–" : formatClock(x));
  switch (measure) {
    case "weight_reps":
    case "weight_steps":
      return `${n(v.weight)} × ${v.reps ?? "–"}`;
    case "reps":
      return String(v.reps ?? "–");
    case "weight_time":
      return `${n(v.weight)} × ${time(v.seconds)}`;
    case "time":
    case "hold":
      return time(v.seconds);
    case "treadmill":
      return `${n(v.speed)} · ${time(v.seconds)}`;
    case "outdoor":
      return `${n(v.distance)} km`;
  }
}

/**
 * A logged set in a finished workout's list: "135×8" (BW with no weight), "15", "0:30", "5% · 6 km/h · 10:00",
 * "5 km · 30:00". Reps-only lists say "reps" once, after the last set.
 */
export function summarizeLogged(measure: Measure, v: Partial<SetValues>, unit: "lbs" | "kg"): string {
  const w = formatNumber(v.weight ?? null) || "BW";
  switch (measure) {
    case "weight_reps":
    case "weight_steps":
      return v.reps != null ? `${w}×${v.reps}` : w;
    case "weight_time":
      return v.seconds != null ? `${w}×${formatClock(v.seconds)}` : w;
    case "reps":
      return String(v.reps ?? "–");
    default:
      return summarize(measure, v, unit);
  }
}

/** True when a set records time rather than reps, so the header shows a duration ("30s Plank"). */
export function isTimed(measure: Measure): boolean {
  return measure === "time" || measure === "hold" || measure === "weight_time";
}

/** The seconds a timed exercise's prescription asks for (its upper bound); a hold falls back to 30. */
export function prescribedSeconds(
  measure: Measure,
  we: { prescribed_seconds_min: number | null; prescribed_seconds_max: number | null },
): number | null {
  const s = we.prescribed_seconds_max ?? we.prescribed_seconds_min ?? null;
  if (s != null) return s;
  return measure === "hold" ? DEFAULT_HOLD_SECONDS : null;
}

/** Whether logging a set starts rest without a prescribed rest: only for lifts. Stretches and cardio rest only when written. */
export function restsByDefault(measure: Measure): boolean {
  return measure !== "hold" && measure !== "treadmill" && measure !== "outdoor";
}

/** True when the values hold something worth logging for this measure (a hold always does). */
export function hasValue(measure: Measure, v: Partial<SetValues>): boolean {
  if (measure === "hold") return true;
  return FIELDS[measure].some((f) => v[f] != null);
}
