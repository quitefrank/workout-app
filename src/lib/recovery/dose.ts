/**
 * A dose is sets times one of: reps, reps in reserve, or seconds, with
 * an optional trailing modifier ("slow", "each side"). Minutes are read
 * as seconds ("1 x 45 min" is 2700 seconds) and AMRAP is a sets-only
 * dose whose modifier is "AMRAP". parseDose reads the strings the
 * prototype used so the seed can carry them over; formatDose renders a
 * dose for display. Anything parseDose cannot classify returns null
 * rather than a guess.
 */

import {
  parseRange,
  type Range,
} from "../../../scripts/lib/parse-prescription";

export type Dose = {
  sets: Range;
  reps: Range | null;
  rir: Range | null;
  seconds: Range | null;
  modifier: string | null;
};

const RANGE = "\\d+(?:\\s*[-\\u2013\\u2014]\\s*\\d+)?";
/** A trailing modifier: words only, no digits, and not a unit or keyword. */
const MOD = "(?:\\s+(?!(?:sec|secs|seconds|s|min|mins|minutes|rir|reps?|sets?|leave|x|\\u00d7)\\b)(?=[a-z])(\\D+?))?";
const SETS_RE = new RegExp(`^\\s*(${RANGE})\\s*[x\\u00d7]\\s*(.+?)\\s*$`, "i");
const RIR_LONG_RE = new RegExp(`^leave\\s+(${RANGE})\\s+in\\s+reserve${MOD}$`, "i");
const RIR_SHORT_RE = new RegExp(`^rir\\s+(${RANGE})${MOD}$`, "i");
const SECONDS_RE = new RegExp(`^(${RANGE})\\s*(?:sec|secs|seconds|s)\\b${MOD}$`, "i");
const MINUTES_RE = new RegExp(`^(${RANGE})\\s*(?:min|mins|minutes)\\b${MOD}$`, "i");
const AMRAP_RE = new RegExp(`^amrap${MOD}$`, "i");
const REPS_RE = new RegExp(`^(${RANGE})${MOD}$`, "i");

function modifierOf(raw: string | undefined): string | null {
  const t = (raw ?? "").trim();
  return t.length > 0 ? t : null;
}

/** Parse "3 x 10-12", "4 x RIR 1-2", "3 x 20-40 sec", "1 x 45 min", "1 x AMRAP", each with an optional trailing modifier. */
export function parseDose(input: string): Dose | null {
  const m = SETS_RE.exec(input);
  if (!m) return null;
  const sets = parseRange(m[1]);
  if (!sets) return null;
  const rest = m[2];

  const rir = RIR_LONG_RE.exec(rest) ?? RIR_SHORT_RE.exec(rest);
  if (rir) {
    const r = parseRange(rir[1]);
    if (!r) return null;
    return { sets, reps: null, rir: r, seconds: null, modifier: modifierOf(rir[2]) };
  }

  const sec = SECONDS_RE.exec(rest);
  if (sec) {
    const r = parseRange(sec[1]);
    if (!r) return null;
    return { sets, reps: null, rir: null, seconds: r, modifier: modifierOf(sec[2]) };
  }

  const mins = MINUTES_RE.exec(rest);
  if (mins) {
    const r = parseRange(mins[1]);
    if (!r) return null;
    return { sets, reps: null, rir: null, seconds: { min: r.min * 60, max: r.max * 60 }, modifier: modifierOf(mins[2]) };
  }

  const amrap = AMRAP_RE.exec(rest);
  if (amrap) {
    return { sets, reps: null, rir: null, seconds: null, modifier: `AMRAP${amrap[1] ? " " + amrap[1].trim() : ""}` };
  }

  const reps = REPS_RE.exec(rest);
  if (reps) {
    const r = parseRange(reps[1]);
    if (!r) return null;
    return { sets, reps: r, rir: null, seconds: null, modifier: modifierOf(reps[2]) };
  }

  return null;
}

function range(r: Range): string {
  return r.min === r.max ? `${r.min}` : `${r.min}-${r.max}`;
}

/**
 * Render a dose for display. The written-out reserve form normalises to
 * "RIR". Seconds render as minutes when both ends divide evenly and the
 * dose is at least two minutes, so "90 sec" stays in seconds.
 */
export function formatDose(d: Dose): string {
  let body: string;
  if (d.rir) body = `RIR ${range(d.rir)}`;
  else if (d.seconds) {
    const wholeMinutes = d.seconds.min % 60 === 0 && d.seconds.max % 60 === 0 && d.seconds.min >= 120;
    body = wholeMinutes
      ? `${range({ min: d.seconds.min / 60, max: d.seconds.max / 60 })} min`
      : `${range(d.seconds)} sec`;
  }
  else if (d.reps) body = range(d.reps);
  else body = "";
  const mod = d.modifier?.trim();
  if (!body && mod?.toUpperCase().startsWith("AMRAP")) return `${range(d.sets)} x ${mod}`;
  const head = body ? `${range(d.sets)} x ${body}` : `${range(d.sets)} sets`;
  return mod ? `${head} ${mod}` : head;
}
