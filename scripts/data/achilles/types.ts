/**
 * Shapes for the committed Achilles seed data. Everything here is
 * generic protocol and library content. Per-user rows have their own
 * shape in personal.example.json.
 */

import type {
  EquipmentItem,
  LoadDirection,
  SupportType,
} from "../../../src/lib/recovery/types";

export type SourceKind =
  | "trial"
  | "review"
  | "cohort"
  | "handout"
  | "convention"
  | "anecdote";

export type SourceSeed = {
  /** Stable key other seed rows reference. */
  key: string;
  citation: string;
  url: string | null;
  kind: SourceKind;
  quality: string;
  notes: string | null;
};

export type GuidanceGroup = { heading: string; items: string[] };

export type PhaseSeed = {
  position: number;
  label: string;
  block: string | null;
  weekFrom: number;
  weekTo: number | null;
  loadPct: number | null;
  gate: string | null;
  guidance: GuidanceGroup[];
  flag: string | null;
  flagSourceKey: string | null;
};

export type ProgramSeed = {
  name: string;
  kind: "recovery" | "training";
  description: string;
  citation: string | null;
  authorityNotes: string | null;
  sourceKey: string | null;
  phases: PhaseSeed[];
};

export type EquipmentType =
  | "barbell"
  | "dumbbell"
  | "machine"
  | "cable"
  | "bodyweight"
  | "cardio_machine"
  | "other";

export type AlternateSeed = {
  /** Slug of the alternate exercise. */
  slug: string;
  position: 1 | 2;
  notes: string;
};

export type ExerciseSeed = {
  name: string;
  /** Computed by exerciseSlug unless a library row is being matched by an explicit slug. */
  slug: string;
  muscleGroup: string | null;
  equipmentType: EquipmentType;
  notes: string | null;
  /** Embed URL. For the 416 Physio clips: https://player.vimeo.com/video/<id>?h=<hash> */
  videoUrl: string | null;
  /** ISO datetime the clip was checked (oEmbed title matched, player loaded). Null means unverified and the URL is not written. */
  videoVerifiedAt: string | null;
  /** Attribution shown next to the embed, e.g. "416 Physio, What exercises can you do with a walking boot" plus the article URL. */
  videoCredit: string | null;
  supportRequired: SupportType;
  loadDirection: LoadDirection;
  loadsBootedFoot: boolean;
  ankleInvolvement: boolean;
  floorTransferRequired: boolean;
  equipmentNeeded: EquipmentItem[];
  minHoursBetweenSessions: number | null;
  maxSessionsPerWeek: number | null;
  alternates: AlternateSeed[];
};

export type OverrideSeed = {
  /** Rule number from the design spec, section 6. */
  rule: number;
  reason: string;
};

export type TemplateExerciseSeed = {
  slug: string;
  /** A parseDose string: "3 x 10-12", "4 x RIR 1-2", "3 x 20-40 sec each side". */
  dose: string;
  cue: string | null;
  /** Present only when the row knowingly breaks a rule. */
  override: OverrideSeed | null;
};

export type TemplateSeed = {
  name: string;
  category: "push" | "pull" | "legs" | "arms" | "full_body" | "cardio" | "abs";
  variant: string | null;
  notes: string;
  /** How this template is spaced from others sharing a capped exercise. */
  spacingNote: string | null;
  /** Program phase positions this template is valid in; its order inside each phase is its index among the templates that share that phase, in TEMPLATES order. */
  phases: number[];
  exercises: TemplateExerciseSeed[];
};
