/**
 * Pure display helpers for the screens. No Supabase import, so they
 * run in tests and on either side of the server boundary.
 */

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "cardio_machine"
  | "other";

export type WeightUnit = "lbs" | "kg";

export type Prescription = {
  prescribed_sets_min: number | null;
  prescribed_sets_max: number | null;
  prescribed_reps_min: number | null;
  prescribed_reps_max: number | null;
  prescribed_rir_min: number | null;
  prescribed_rir_max: number | null;
  prescribed_seconds_min: number | null;
  prescribed_seconds_max: number | null;
  prescribed_rest_seconds: number | null;
  prescribed_rpe: string | null;
  warm_up_sets_min: number | null;
  warm_up_sets_max: number | null;
};

/** "3-5", "3", or null when both ends are empty. */
export function range(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min == null) return String(max);
  if (max == null || max === min) return String(min);
  return `${min}-${max}`;
}

/** Trim trailing zeros: 100.00 reads 100, 42.50 reads 42.5. */
export function formatNumber(n: number | string | null | undefined): string {
  if (n == null || n === "") return "";
  const v = typeof n === "string" ? Number(n) : n;
  if (!Number.isFinite(v)) return "";
  return String(Math.round(v * 100) / 100);
}

/** Machine and cardio readings are raw numbers; free weights carry the unit. */
export function isRawReading(equipment: EquipmentType | null | undefined): boolean {
  return equipment === "machine" || equipment === "cardio_machine";
}

export function displayWeight(
  weight: number | string | null | undefined,
  equipment: EquipmentType | null | undefined,
  unit: WeightUnit,
): string {
  const n = formatNumber(weight);
  if (!n) return "";
  return isRawReading(equipment) ? n : `${n} ${unit}`;
}

/** "160 × 4", the top-set shorthand the library badges use. */
export function setShorthand(
  weight: number | string | null | undefined,
  reps: number | null | undefined,
): string {
  const w = formatNumber(weight);
  if (!w) return reps != null ? `${reps} reps` : "";
  return reps != null ? `${w} × ${reps}` : w;
}

/** "3 min", "90 s", "2 min 30 s". */
export function formatRest(seconds: number | null | undefined): string | null {
  if (seconds == null || seconds <= 0) return null;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  if (m === 0) return `${s} s`;
  return s === 0 ? `${m} min` : `${m} min ${s} s`;
}

/** Clock for timers: 1:05, 12:00, 1:02:03. */
export function formatClock(totalSeconds: number): string {
  const t = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const ss = String(s).padStart(2, "0");
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${ss}`;
  return `${m}:${ss}`;
}

/** The working dose as one line: "3 × 6-8", "2 × 30-45 s", "3 × RIR 1-2". */
export function doseText(p: Prescription): string | null {
  const sets = range(p.prescribed_sets_min, p.prescribed_sets_max);
  const reps = range(p.prescribed_reps_min, p.prescribed_reps_max);
  const secs = range(p.prescribed_seconds_min, p.prescribed_seconds_max);
  const rir = range(p.prescribed_rir_min, p.prescribed_rir_max);
  const per = reps ?? (secs ? `${secs} s` : rir ? `RIR ${rir}` : null);
  if (sets && per) return `${sets} × ${per}`;
  if (sets) return `${sets} ${sets === "1" ? "set" : "sets"}`;
  return per;
}

/** Everything a prescription says, as short labelled parts. */
export function prescriptionParts(p: Prescription): string[] {
  const parts: string[] = [];
  const warm = range(p.warm_up_sets_min, p.warm_up_sets_max);
  if (warm && warm !== "0") parts.push(`${warm} warm-up`);
  const dose = doseText(p);
  if (dose) parts.push(dose);
  if (p.prescribed_rpe) parts.push(`RPE ${p.prescribed_rpe}`);
  const rest = formatRest(p.prescribed_rest_seconds);
  if (rest) parts.push(`${rest} rest`);
  return parts;
}

/** Epley, as the analytics view computes it. */
export function epley(weight: number, reps: number): number {
  return Math.round(weight * (1 + reps / 30) * 100) / 100;
}

export function midpoint(min: number | null, max: number | null): number | null {
  if (min == null && max == null) return null;
  if (min == null) return max;
  if (max == null) return min;
  return Math.round((min + max) / 2);
}

export const CATEGORY_LABELS: Record<string, string> = {
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  arms: "Arms",
  full_body: "Full Body",
  cardio: "Cardio",
  abs: "Abs",
  rehab: "Rehab",
};

export const CATEGORY_ORDER = ["push", "pull", "legs", "arms", "full_body", "abs", "cardio", "rehab"];

export const EQUIPMENT_LABELS: Record<EquipmentType, string> = {
  barbell: "Barbell",
  dumbbell: "Dumbbell",
  machine: "Machine",
  cable: "Cable",
  bodyweight: "Bodyweight",
  cardio_machine: "Cardio machine",
  other: "Other",
};

/**
 * Logged sets back in the Notion Weight format: warm-ups bare, working
 * sets with their reps, "50, 70, 90, 100(5), 100(4)". A set with reps
 * and no weight (bodyweight) writes as 0.
 */
export function setsToCsv(
  sets: readonly { is_warm_up: boolean; weight: number | string | null; reps: number | null }[],
): string {
  return sets
    .map((s) => {
      const w = formatNumber(s.weight) || "0";
      return !s.is_warm_up && s.reps != null ? `${w}(${s.reps})` : w;
    })
    .join(", ");
}
