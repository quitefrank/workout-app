/**
 * The programme contract. A programme is blocks of weeks; each week has
 * ordered days; each day has ordered exercises with a prescription.
 * Every seeded training programme and, later, every programme imported
 * through the app, arrives in this shape.
 *
 * Doses are strings parseDose accepts ("1 x 3-5", "1 x 45 min",
 * "1 x AMRAP", "2 x 30 sec hold"). Anything the source wrote that does
 * not fit (per-set rep lists, drop sets) goes into `notes`.
 */

export type ProgramJsonExercise = {
  name: string;
  /** Warm-up sets as written, "3-4" or null. */
  warmUp: string | null;
  dose: string;
  rpe: string | null;
  /** Rest as written, "~3-4 min" or null. */
  rest: string | null;
  sub1: string | null;
  sub2: string | null;
  notes: string | null;
};

export type ProgramJsonDay = {
  name: string;
  exercises: ProgramJsonExercise[];
};

export type ProgramJsonWeek = {
  week: number;
  days: ProgramJsonDay[];
};

export type ProgramJsonBlock = {
  name: string;
  weeks: ProgramJsonWeek[];
};

export type ProgramJson = {
  name: string;
  kind: "training";
  description: string;
  citation: string | null;
  sourceUrl: string | null;
  blocks: ProgramJsonBlock[];
};

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function str(v: unknown, path: string): string {
  if (typeof v !== "string" || v.trim() === "") throw new Error(`${path}: expected a non-empty string`);
  return v.trim();
}

function strOrNull(v: unknown, path: string): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") throw new Error(`${path}: expected a string or null`);
  const t = v.trim();
  return t === "" ? null : t;
}

/**
 * Throws with a path on the first shape error. Returns the typed programme.
 * Shape only: whether each dose parses is checked at seed time, not here.
 */
export function validateProgramJson(input: unknown): ProgramJson {
  if (!isRecord(input)) throw new Error("programme: expected an object");
  const name = str(input.name, "name");
  if (input.kind !== "training") throw new Error("kind: expected \"training\"");
  const description = str(input.description, "description");
  const citation = strOrNull(input.citation, "citation");
  const sourceUrl = strOrNull(input.sourceUrl, "sourceUrl");
  if (!Array.isArray(input.blocks) || input.blocks.length === 0) throw new Error("blocks: expected a non-empty array");

  let expectedWeek = 1;
  const blocks: ProgramJsonBlock[] = input.blocks.map((b, bi) => {
    const bp = `blocks[${bi}]`;
    if (!isRecord(b)) throw new Error(`${bp}: expected an object`);
    const bname = str(b.name, `${bp}.name`);
    if (!Array.isArray(b.weeks) || b.weeks.length === 0) throw new Error(`${bp}.weeks: expected a non-empty array`);
    const weeks: ProgramJsonWeek[] = b.weeks.map((w, wi) => {
      const wp = `${bp}.weeks[${wi}]`;
      if (!isRecord(w)) throw new Error(`${wp}: expected an object`);
      if (w.week !== expectedWeek) throw new Error(`${wp}.week: expected ${expectedWeek}, got ${JSON.stringify(w.week)}`);
      const weekNumber = expectedWeek;
      expectedWeek++;
      if (!Array.isArray(w.days) || w.days.length === 0) throw new Error(`${wp}.days: expected a non-empty array`);
      const seenDays = new Set<string>();
      const days: ProgramJsonDay[] = w.days.map((d, di) => {
        const dp = `${wp}.days[${di}]`;
        if (!isRecord(d)) throw new Error(`${dp}: expected an object`);
        const dname = str(d.name, `${dp}.name`);
        if (seenDays.has(dname)) throw new Error(`${dp}.name: duplicate day "${dname}" in week ${weekNumber}`);
        seenDays.add(dname);
        if (!Array.isArray(d.exercises) || d.exercises.length === 0) throw new Error(`${dp}.exercises: expected a non-empty array`);
        const exercises: ProgramJsonExercise[] = d.exercises.map((e, ei) => {
          const ep = `${dp}.exercises[${ei}]`;
          if (!isRecord(e)) throw new Error(`${ep}: expected an object`);
          return {
            name: str(e.name, `${ep}.name`),
            warmUp: strOrNull(e.warmUp, `${ep}.warmUp`),
            dose: str(e.dose, `${ep}.dose`),
            rpe: strOrNull(e.rpe, `${ep}.rpe`),
            rest: strOrNull(e.rest, `${ep}.rest`),
            sub1: strOrNull(e.sub1, `${ep}.sub1`),
            sub2: strOrNull(e.sub2, `${ep}.sub2`),
            notes: strOrNull(e.notes, `${ep}.notes`),
          };
        });
        return { name: dname, exercises };
      });
      return { week: weekNumber, days };
    });
    return { name: bname, weeks };
  });

  return { name, kind: "training", description, citation, sourceUrl, blocks };
}

/** Total weeks across blocks. */
export function programWeeks(p: ProgramJson): number {
  return p.blocks.reduce((n, b) => n + b.weeks.length, 0);
}
