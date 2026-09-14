/**
 * Per-exercise frequency caps: a minimum gap in hours between sessions
 * that contain the exercise, and a maximum count per calendar week. The
 * pull-up rule (72 hours, twice a week) comes from the user's injury
 * history, not from any protocol. Where this runs is decided by the
 * screens spec; the function itself is pure.
 *
 * The hour gap is measured between instants. The weekly count uses the
 * calendar date each session was logged on, so a late-evening session
 * stays in the week the user lived it in, whatever UTC says.
 */

import { assertIsoDate, isoWeekStart } from "./dates";
import type { AuthoringExercise, Verdict } from "./types";

export type SessionRecord = {
  /** ISO datetime with zone. */
  completedAt: string;
  /** Local calendar date the session was logged on, YYYY-MM-DD. */
  date: string;
  exerciseIds: string[];
};

const MS_PER_HOUR = 3_600_000;

function parseInstant(value: string): number {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`Not a timestamp: ${value}`);
  return ms;
}

/**
 * Null when the proposed session breaks neither cap. Otherwise a warn
 * verdict naming the cap. Sessions after the proposed instant are
 * ignored. Every session is validated up front, whether or not it
 * contains the exercise.
 */
export function frequencyViolation(
  ex: AuthoringExercise,
  history: SessionRecord[],
  proposedAt: string,
  proposedDate: string,
): Verdict | null {
  const proposedMs = parseInstant(proposedAt);
  assertIsoDate(proposedDate);
  const parsed = history.map((h) => {
    const ms = parseInstant(h.completedAt);
    assertIsoDate(h.date);
    return { ms, date: h.date, exerciseIds: h.exerciseIds };
  });

  if (ex.minHoursBetweenSessions === null && ex.maxSessionsPerWeek === null) {
    return null;
  }

  const prior = parsed.filter((h) => h.exerciseIds.includes(ex.id) && h.ms <= proposedMs);

  if (ex.maxSessionsPerWeek !== null) {
    const weekStart = isoWeekStart(proposedDate);
    const inWeek = prior.filter((h) => isoWeekStart(h.date) === weekStart).length;
    if (inWeek + 1 > ex.maxSessionsPerWeek) {
      return {
        level: "warn",
        rule: 0,
        reason: `${ex.name}: would be session ${inWeek + 1} this week, cap is ${ex.maxSessionsPerWeek} per week`,
      };
    }
  }

  if (ex.minHoursBetweenSessions !== null && prior.length > 0) {
    const last = Math.max(...prior.map((h) => h.ms));
    const hours = (proposedMs - last) / MS_PER_HOUR;
    if (hours < ex.minHoursBetweenSessions) {
      return {
        level: "warn",
        rule: 0,
        reason: `${ex.name}: ${Math.floor(hours)} of ${ex.minHoursBetweenSessions} hours since the last session`,
      };
    }
  }

  return null;
}
