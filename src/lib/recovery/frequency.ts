/**
 * Per-exercise frequency caps: a minimum gap in hours between sessions
 * that contain the exercise, and a maximum count per ISO week. The
 * pull-up rule (72 hours, twice a week) comes from the user's injury
 * history, not from any protocol. Where this runs is decided by the
 * screens spec; the function itself is pure.
 */

import type { AuthoringExercise, Verdict } from "./types";

export type SessionRecord = {
  /** ISO datetime with zone. */
  completedAt: string;
  exerciseIds: string[];
};

const MS_PER_HOUR = 3_600_000;
const MS_PER_DAY = 86_400_000;

/** Monday 00:00 UTC of the ISO week containing the datetime, as YYYY-MM-DD. */
export function isoWeekStart(datetime: string): string {
  const ms = Date.parse(datetime);
  if (Number.isNaN(ms)) throw new Error(`Not a timestamp: ${datetime}`);
  const d = new Date(ms);
  const dayOfWeek = (d.getUTCDay() + 6) % 7; // Monday = 0
  const mondayMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - dayOfWeek * MS_PER_DAY;
  return new Date(mondayMs).toISOString().slice(0, 10);
}

/**
 * Null when the proposed session breaks neither cap. Otherwise a warn
 * verdict naming the cap. Sessions after the proposed time are ignored.
 */
export function frequencyViolation(
  ex: AuthoringExercise,
  history: SessionRecord[],
  proposedAt: string,
): Verdict | null {
  if (ex.minHoursBetweenSessions === null && ex.maxSessionsPerWeek === null) {
    return null;
  }
  const proposedMs = Date.parse(proposedAt);
  if (Number.isNaN(proposedMs)) throw new Error(`Not a timestamp: ${proposedAt}`);
  const prior = history
    .filter((h) => h.exerciseIds.includes(ex.id))
    .map((h) => {
      const t = Date.parse(h.completedAt);
      if (Number.isNaN(t)) throw new Error(`Not a timestamp: ${h.completedAt}`);
      return t;
    })
    .filter((t) => t <= proposedMs);

  if (ex.minHoursBetweenSessions !== null && prior.length > 0) {
    const last = Math.max(...prior);
    const hours = (proposedMs - last) / MS_PER_HOUR;
    if (hours < ex.minHoursBetweenSessions) {
      return {
        level: "warn",
        rule: 0,
        reason: `${ex.name}: ${Math.floor(hours)} of ${ex.minHoursBetweenSessions} hours since the last session`,
      };
    }
  }

  if (ex.maxSessionsPerWeek !== null) {
    const weekStart = isoWeekStart(proposedAt);
    const inWeek = prior.filter((t) => isoWeekStart(new Date(t).toISOString()) === weekStart).length;
    if (inWeek + 1 > ex.maxSessionsPerWeek) {
      return {
        level: "warn",
        rule: 0,
        reason: `${ex.name}: would be session ${inWeek + 1} this week, cap is ${ex.maxSessionsPerWeek} per week`,
      };
    }
  }

  return null;
}
