/**
 * The live position, derived only from the clearance log. Nothing here
 * reads the calendar against the reference phases; that is what makes a
 * fall or a slow week show up honestly instead of being papered over.
 */

import { dayIndex } from "./dates";
import type {
  BootStatus,
  Clearance,
  ClearanceKind,
  RestrictionState,
} from "./types";

/** Days without a new clearance entry before the log is called out of date. */
export const STALE_AFTER_DAYS = 21;

function inEffect(clearances: Clearance[], today: string): Clearance[] {
  return clearances
    .filter((c) => c.voidedAt === null && c.effectiveFrom <= today)
    .sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
}

function latestOfKind(list: Clearance[], kind: ClearanceKind): Clearance | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].kind === kind) return list[i];
  }
  return null;
}

export function restrictionState(
  clearances: Clearance[],
  today: string,
): RestrictionState {
  const list = inEffect(clearances, today);

  const weightBearing = latestOfKind(list, "weight_bearing");
  const clearedLoadPct = weightBearing?.valuePct ?? 0;

  const ankleRomCleared = latestOfKind(list, "ankle_rom") !== null;

  let bootStatus: BootStatus = "on";
  if (latestOfKind(list, "out_of_boot")) bootStatus = "off";
  else if (latestOfKind(list, "boot_weaning")) bootStatus = "weaning";

  const wedgesRemoved = list.filter((c) => c.kind === "wedge_removal").length;

  const strengthGate = latestOfKind(list, "strength_gate")?.valueText ?? null;

  let currentPhaseId: string | null = null;
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].phaseId !== null) {
      currentPhaseId = list[i].phaseId;
      break;
    }
  }

  // Staleness looks at every non-voided entry, including planned future
  // ones: a planned entry means the log was maintained.
  const dates = clearances
    .filter((c) => c.voidedAt === null)
    .map((c) => c.effectiveFrom)
    .sort();
  const last = dates.length > 0 ? dates[dates.length - 1] : null;
  const daysSinceLastClearance = last === null ? null : dayIndex(last, today);
  const isStale =
    daysSinceLastClearance !== null && daysSinceLastClearance > STALE_AFTER_DAYS;

  return {
    clearedLoadPct,
    ankleRomCleared,
    bootStatus,
    wedgesRemoved,
    strengthGate,
    currentPhaseId,
    daysSinceLastClearance,
    isStale,
  };
}
