/**
 * Calendar math for a recovery. Day 0 is the injury date; every week
 * number counts from it. There is no offset anywhere in this module or
 * elsewhere. A fall, a slow week, an early clearance: all of that lives
 * in the clearance log, never here.
 *
 * Dates are ISO strings (YYYY-MM-DD) handled as UTC calendar days so a
 * time zone or daylight-saving change can never move a boundary.
 */

const MS_PER_DAY = 86_400_000;
const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMidnight(iso: string): number {
  const m = ISO_RE.exec(iso);
  if (!m) throw new Error(`Not an ISO date: ${iso}`);
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function fromUtcMidnight(ms: number): string {
  const d = new Date(ms);
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${mo}-${day}`;
}

export function addDays(iso: string, days: number): string {
  return fromUtcMidnight(toUtcMidnight(iso) + days * MS_PER_DAY);
}

export function dayIndex(injuryDate: string, today: string): number {
  return Math.round(
    (toUtcMidnight(today) - toUtcMidnight(injuryDate)) / MS_PER_DAY,
  );
}

export function weekIndex(injuryDate: string, today: string): number {
  return Math.floor(dayIndex(injuryDate, today) / 7);
}

export type PhaseWindow = { start: string; end: string | null };

/** Reference window of a phase: first day of week_from through the last day before week_to. */
export function phaseWindow(
  injuryDate: string,
  weekFrom: number,
  weekTo: number | null,
): PhaseWindow {
  return {
    start: addDays(injuryDate, weekFrom * 7),
    end: weekTo === null ? null : addDays(injuryDate, weekTo * 7 - 1),
  };
}
