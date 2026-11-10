/**
 * A stretch between sets (plan 3 of the measures work, Frank's call of 2026-11-09: "the pec stretch is kind of like a
 * rest, so in between sets, we should put a pec stretch and then a countdown timer for 30 seconds"). Nippard writes the
 * pair as two adjacent rows of one superset, the lift then a static stretch, each note starting "Superset A." (Cable
 * Press Around with Pec Stretch, Bottom-Half Lat Pull-Over with Static Lat Stretch, Lean-In Lateral Raise with Delt
 * Stretch, EZ-Bar Curl with Bicep Static Stretch). After each set of the lift the active workout moves to the stretch
 * and starts its hold, then comes back for the lift's next set. Supersets of two lifts are not handled here.
 */

import type { Measure } from "./measure";

type Row = { id: string; notes: string | null; exercises: { measure?: Measure | null } };

// a workout row's note may lead with the template variant: "Top Set · Superset A. ..."
const SUPERSET = /(?:^|·)\s*superset\s+([a-z])\b/i;

/** The superset letter a row's note opens with ("Superset A. ..." is "A"), or null. */
export function supersetOf(notes: string | null): string | null {
  const m = notes ? SUPERSET.exec(notes) : null;
  return m ? m[1].toUpperCase() : null;
}

/** Each paired lift's row id to its stretch's, and each stretch's back to its lift, in workout order. */
export function stretchPairs(rows: readonly Row[]): { stretchOf: Map<string, string>; liftOf: Map<string, string> } {
  const stretchOf = new Map<string, string>();
  const liftOf = new Map<string, string>();
  for (let i = 0; i + 1 < rows.length; i++) {
    const lift = rows[i];
    const stretch = rows[i + 1];
    if (stretch.exercises.measure !== "hold" || lift.exercises.measure === "hold") continue;
    const letter = supersetOf(lift.notes);
    if (!letter || supersetOf(stretch.notes) !== letter) continue;
    stretchOf.set(lift.id, stretch.id);
    liftOf.set(stretch.id, lift.id);
  }
  return { stretchOf, liftOf };
}
