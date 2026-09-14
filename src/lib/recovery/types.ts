/**
 * Domain types for the recovery layer. Hand-written and independent of
 * the generated Supabase types so the pure modules can be tested with
 * plain objects. Dates are ISO calendar strings (YYYY-MM-DD); datetimes
 * are ISO strings with a time zone.
 */

export type SupportType =
  | "hanging"
  | "lying"
  | "seated_supported"
  | "standing_supported"
  | "standing_free";

export type LoadDirection = "vertical" | "sagittal" | "lateral" | "none";

export type EquipmentItem =
  | "cable_tower"
  | "dumbbells"
  | "adjustable_bench"
  | "half_rack"
  | "pull_up_bar"
  | "plate_tree"
  | "mat"
  | "medicine_ball"
  | "stability_ball"
  | "treadmill"
  | "elliptical"
  | "stepper"
  | "spin_bike"
  | "upright_bike"
  | "resistance_band"
  | "hanging_ab_straps"
  | "barbell"
  | "rower"
  | "leg_press"
  | "calf_machine"
  | "assisted_pull_up"
  | "captains_chair"
  | "chest_press_machine"
  | "shoulder_press_machine"
  | "step_platform"
  | "bathroom_scale";

export type ClearanceKind =
  | "weight_bearing"
  | "ankle_rom"
  | "wedge_removal"
  | "boot_weaning"
  | "out_of_boot"
  | "strength_gate";

export type ClearanceSource = "clinic" | "self" | "planned";

export type Clearance = {
  effectiveFrom: string;
  /** ISO datetime the row was written. Tiebreak for rows sharing an effectiveFrom. */
  createdAt: string;
  kind: ClearanceKind;
  valuePct: number | null;
  valueText: string | null;
  phaseId: string | null;
  source: ClearanceSource;
  voidedAt: string | null;
};

export type BootStatus = "on" | "weaning" | "off";

export type RestrictionState = {
  clearedLoadPct: number;
  ankleRomCleared: boolean;
  bootStatus: BootStatus;
  wedgesRemoved: number;
  strengthGate: string | null;
  currentPhaseId: string | null;
  daysSinceLastClearance: number | null;
  isStale: boolean;
};

/** The subset of an exercise row the authoring rules read. */
export type AuthoringExercise = {
  id: string;
  name: string;
  supportRequired: SupportType | null;
  loadDirection: LoadDirection | null;
  loadsBootedFoot: boolean | null;
  ankleInvolvement: boolean | null;
  floorTransferRequired: boolean | null;
  equipmentNeeded: EquipmentItem[] | null;
  minHoursBetweenSessions: number | null;
  maxSessionsPerWeek: number | null;
};

export type VerdictLevel = "ok" | "warn" | "blocked";

export type Verdict = {
  level: VerdictLevel;
  /** Rule number from the design spec, section 6. 0 when no rule applies. */
  rule: number;
  reason: string;
};
