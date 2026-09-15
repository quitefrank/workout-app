/**
 * Split a programme's exercise spelling into the base exercise and the
 * set type it carries, so "Bench Press (Top Set)" resolves to the same
 * library row as "Bench Press" and the set type lives on the template
 * row (template_exercises.variant).
 *
 * Only known set-type words move to the variant; any other
 * parenthetical ("(Side Delt)", "(Flat)") is part of the name. A
 * leading "Slow Eccentric", "Slow" or "Tempo" is a set type too; a
 * leading "Pause" or "Enhanced-Eccentric" is part of the exercise, as
 * in Frank's Notion rows. A rep hint or a seconds suffix is dropped,
 * since the dose already says it.
 * A cell naming two movements joined by " + " is a superset performed
 * as one set; splitCompound turns it into two rows.
 */

export type VariantSplit = {
  name: string;
  variant: string | null;
  /** Text removed from the name that carried no information beyond the dose. */
  dropped: string | null;
};

/** Spellings no rule can derive. Exact match after whitespace collapse. */
const ALIASES: Record<string, VariantSplit> = {
  "EZ-Bar Modified Bicep 21's": { name: "EZ-Bar Curl", variant: "Modified 21's", dropped: null },
  "Squat or Machine Squat": { name: "Squat", variant: null, dropped: null },
};

/** Parenthetical set types, matched whole and case-insensitively; the variant keeps the source spelling. */
const SET_TYPE_RE = /^(top set|back ?off(?: amrap)?|feeder sets?|failure set|heavy|light|drop ?set|rest[- ]?pause|myo[- ]?reps?|amrap|cluster|(?:reverse )?21'?s|descending rom|metabolic|optional)$/i;
const REP_HINT_RE = /^\d+(?:\s*-\s*\d+)?\s*reps?$/i;
const SECONDS_RE = /^\d+\s*s(?:ec)?$/i;
const TEMPO_RE = /^\d+\s*up,?\s*\d+\s*down$/i;
const TRAILING_PAREN_RE = /^(.*?)\s*\(([^()]*)\)\s*$/;
const TRAILING_SECONDS_RE = /^(.*?)\s+(\d+s)$/i;
const TRAILING_SCHEME_RE = /^(.*?)\s+(ladder|(?:reverse )?21'?s)$/i;
/** A leading technique phrase that is a set type, not part of the exercise; "pause" and "enhanced-eccentric" stay in the name, as in Notion. */
const LEADING_TECHNIQUE_RE = /^(slow eccentric|slow|tempo)\s+(.+)$/i;
const LEADING_HALF_RE = /^(squeeze|stretch)-only\s+(.+)$/i;

function collapse(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** A trailing scheme word as the variant: "21s" is spelled "21's", a leading "reverse" is capitalised, "ladder" keeps the source spelling. */
function schemeVariant(raw: string): string {
  if (!/21'?s$/i.test(raw)) return raw;
  return raw.replace(/21'?s$/i, "21's").replace(/^reverse\s+/i, "Reverse ");
}

export function splitVariant(rawName: string): VariantSplit {
  let name = collapse(rawName);
  const alias = ALIASES[name];
  if (alias) return { ...alias };

  const variantParts: string[] = [];
  let dropped: string | null = null;

  const half = LEADING_HALF_RE.exec(name);
  if (half) {
    variantParts.push(`${half[1][0].toUpperCase()}${half[1].slice(1).toLowerCase()}-only`);
    name = half[2];
  }

  const technique = LEADING_TECHNIQUE_RE.exec(name);
  if (technique) {
    variantParts.push(technique[1].split(" ").map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join(" "));
    name = technique[2];
  }

  const paren = TRAILING_PAREN_RE.exec(name);
  if (paren) {
    const inner = collapse(paren[2]);
    if (REP_HINT_RE.test(inner) || SECONDS_RE.test(inner)) {
      dropped = inner;
      name = paren[1];
    } else if (TEMPO_RE.test(inner)) {
      variantParts.push(`(${inner})`);
      name = paren[1];
    } else if (SET_TYPE_RE.test(inner)) {
      variantParts.push(inner);
      name = paren[1];
    }
  }

  // Scheme before seconds: "21s" is the 21's scheme, not 21 seconds.
  const scheme = TRAILING_SCHEME_RE.exec(name);
  if (scheme) {
    variantParts.push(schemeVariant(scheme[2]));
    name = scheme[1];
  }

  const seconds = TRAILING_SECONDS_RE.exec(name);
  if (seconds) {
    dropped = seconds[2];
    name = seconds[1];
  }

  return { name: collapse(name), variant: variantParts.length ? variantParts.join(" ") : null, dropped };
}

/**
 * "A + B" (or "A + B + C") is two or more movements done as one set;
 * anything else is one name. A combo lift spelled with "+" ("Clean +
 * Press") would need an ALIASES entry checked here first; none so far.
 */
export function splitCompound(rawName: string): string[] {
  const collapsed = collapse(rawName);
  const parts = collapsed.split(/\s\+\s/);
  return parts.length > 1 ? parts.map(collapse) : [collapsed];
}
