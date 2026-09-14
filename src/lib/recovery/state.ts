/**
 * The live position, derived only from the clearance log. Nothing here
 * reads the calendar against the reference phases; that is what makes a
 * fall or a slow week show up honestly instead of being papered over.
 */

import { assertIsoDate, dayIndex } from "./dates";
import type {
  BootStatus,
  Clearance,
  ClearanceKind,
  RestrictionState,
} from "./types";

/** Days without a new clearance entry before the log is called out of date. */
export const STALE_AFTER_DAYS = 21;

/** Chronological, with the write time breaking ties on the same day. */
function byEffectiveThenCreated(a: Clearance, b: Clearance): number {
  if (a.effectiveFrom !== b.effectiveFrom) {
    return a.effectiveFrom < b.effectiveFrom ? -1 : 1;
  }
  return Date.parse(a.createdAt) - Date.parse(b.createdAt);
}

function latestOfKind(list: Clearance[], kind: ClearanceKind): Clearance | null {
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i].kind === kind) return list[i];
  }
  return null;
}

/**
 * Derive the restriction state on a given day from the clearance log.
 * Voided rows are ignored. Rows dated after today do not count toward
 * the state, but the write time of every live row counts toward
 * staleness: the log is stale when nothing has been written to it for
 * STALE_AFTER_DAYS, whatever dates the rows carry.
 */
export function restrictionState(
  clearances: Clearance[],
  today: string,
): RestrictionState {
  assertIsoDate(today);
  const live = clearances.filter((c) => c.voidedAt === null);
  for (const c of live) assertIsoDate(c.effectiveFrom);
  live.sort(byEffectiveThenCreated);
  const list = live.filter((c) => c.effectiveFrom <= today);

  // A weight-bearing row without a percentage fails closed to 0. The
  // database refuses such a row; this is the fallback if one ever arrives.
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

  const lastInEffect = list.length > 0 ? list[list.length - 1].effectiveFrom : null;
  const daysSinceLastClearance =
    lastInEffect === null ? null : dayIndex(lastInEffect, today);

  let lastWrite: string | null = null;
  for (const c of live) {
    if (lastWrite === null || c.createdAt > lastWrite) lastWrite = c.createdAt;
  }
  const isStale =
    lastWrite !== null && dayIndex(lastWrite.slice(0, 10), today) > STALE_AFTER_DAYS;

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
