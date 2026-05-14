/**
 * Parse a Notion Sessions "Weight" CSV into structured set rows.
 *
 * The original format stores per-set weights as a comma-separated list.
 * Two real examples from DB Bench Press (Flat):
 *
 *   "50, 70, 90, 160"
 *     -> three warm-up sets at 50, 70, 90 lbs (warmUpMax=3)
 *        and one working set at 160 lbs
 *
 *   "50, 60, 70, 100(5), 100(4)"
 *     -> three warm-ups, then 100x5 and 100x4 working sets
 *
 * Rules:
 *   - Split on `,` and trim whitespace.
 *   - Drop empty tokens silently (typos like `50,,60` should not block import).
 *   - The first N tokens are warm-up sets, where N = warmUpMax.
 *   - `100(5)` parses as weight=100, reps=5.
 *   - `100` parses as weight=100, reps=<midpoint of prescribedReps>
 *     (falls back to fallbackReps when prescribedReps is null).
 *   - Decimal weights are allowed: `45.5(8)`.
 *   - Tokens that fail to match the regex are logged as errors. The
 *     parser continues; the failing token does not produce a set row.
 *   - set_number is 1-indexed, counting all non-empty tokens (including
 *     ones that fail to parse), so positional set numbering matches
 *     what Frank sees in Notion.
 */

export type RepsRange = {
  min: number;
  max: number;
};

export type ParsedSet = {
  setNumber: number;
  isWarmUp: boolean;
  weight: number;
  reps: number | null;
};

export type ParseError = {
  setNumber: number;
  token: string;
  reason: string;
};

export type ParseInput = {
  weightCsv: string | null | undefined;
  warmUpMax: number | null | undefined;
  prescribedReps?: RepsRange | null;
  fallbackReps?: number | null;
};

export type ParseResult = {
  sets: ParsedSet[];
  errors: ParseError[];
};

const TOKEN_RE = /^(\d+(?:\.\d+)?)(?:\s*\(\s*(\d+)\s*\))?$/;

export function parseWeightCsv(input: ParseInput): ParseResult {
  const errors: ParseError[] = [];
  const sets: ParsedSet[] = [];

  const raw = (input.weightCsv ?? "").trim();
  if (!raw) {
    return { sets, errors };
  }

  const tokens = raw
    .split(",")
    .map((t) => t.trim())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) {
    return { sets, errors };
  }

  const warmUpCount = Math.max(0, input.warmUpMax ?? 0);
  const repsMidpoint = computeRepsMidpoint(
    input.prescribedReps ?? null,
    input.fallbackReps ?? null,
  );

  tokens.forEach((token, index) => {
    const setNumber = index + 1;
    const isWarmUp = index < warmUpCount;
    const parsed = parseToken(token);

    if (!parsed) {
      errors.push({
        setNumber,
        token,
        reason: `does not match weight or weight(reps) format`,
      });
      return;
    }

    const reps =
      parsed.reps != null
        ? parsed.reps
        : repsMidpoint;

    sets.push({
      setNumber,
      isWarmUp,
      weight: parsed.weight,
      reps,
    });
  });

  return { sets, errors };
}

function parseToken(token: string): { weight: number; reps: number | null } | null {
  const match = TOKEN_RE.exec(token);
  if (!match) return null;
  const weight = Number.parseFloat(match[1]);
  if (!Number.isFinite(weight)) return null;
  const reps = match[2] !== undefined ? Number.parseInt(match[2], 10) : null;
  if (reps !== null && !Number.isFinite(reps)) return null;
  return { weight, reps };
}

function computeRepsMidpoint(
  range: RepsRange | null,
  fallback: number | null,
): number | null {
  if (range && Number.isFinite(range.min) && Number.isFinite(range.max)) {
    return Math.round((range.min + range.max) / 2);
  }
  if (fallback != null && Number.isFinite(fallback)) {
    return Math.round(fallback);
  }
  return null;
}
