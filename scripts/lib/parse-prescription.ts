/**
 * Parse Notion's text-based prescription fields into structured numbers.
 *
 * Notion stores Sets, Reps, Warm Up, and Rest as free-form text:
 *   "3-5"        -> { min: 3, max: 5 }
 *   "3"          -> { min: 3, max: 3 }
 *   "3-4 mins"   -> 210 seconds (midpoint converted)
 *   "3 mins"     -> 180 seconds
 *   "90 sec"     -> 90 seconds
 *   ""           -> null
 *
 * These helpers stay isolated so the rules can be exercised by unit tests
 * without needing a real Notion payload.
 */

export type Range = {
  min: number;
  max: number;
};

const RANGE_RE = /^\s*(\d+)\s*(?:[-–—]\s*(\d+))?\s*$/;

/**
 * Parse "3" or "3-5" (also accepts en-dash and em-dash) into a Range.
 * Returns null if the input is empty or unparseable.
 */
export function parseRange(input: string | null | undefined): Range | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const match = RANGE_RE.exec(raw);
  if (!match) return null;
  const min = Number.parseInt(match[1], 10);
  const max = match[2] !== undefined ? Number.parseInt(match[2], 10) : min;
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  if (max < min) return null;
  return { min, max };
}

/**
 * Parse rest period text into seconds. Accepts:
 *   "3 mins" / "3 min" / "3m"     -> 180
 *   "3-4 mins"                    -> 210 (midpoint, rounded)
 *   "90 sec" / "90s" / "90"       -> 90
 *   ""                            -> null
 *
 * Numbers without a unit are treated as seconds when small (<= 30) and
 * as minutes when larger, matching how Frank writes them in Notion.
 */
export function parseRestSeconds(input: string | null | undefined): number | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;

  const unitMatch = raw.match(
    /^(\d+)\s*(?:[-–—]\s*(\d+))?\s*(min(?:ute)?s?|m|sec(?:ond)?s?|s)?\s*$/,
  );
  if (!unitMatch) return null;

  const first = Number.parseInt(unitMatch[1], 10);
  const second = unitMatch[2] !== undefined ? Number.parseInt(unitMatch[2], 10) : first;
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  const midpoint = (first + second) / 2;
  const unit = unitMatch[3];

  if (unit && /^min|^m$/.test(unit)) {
    return Math.round(midpoint * 60);
  }
  if (unit && /^sec|^s$/.test(unit)) {
    return Math.round(midpoint);
  }

  // Unitless: small numbers are minutes (you'd never write "3" to mean
  // 3 seconds of rest), larger ones are seconds.
  return midpoint <= 5 ? Math.round(midpoint * 60) : Math.round(midpoint);
}
