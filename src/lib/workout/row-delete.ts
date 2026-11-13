/**
 * Deleting a set row in the Journal (swipe to delete). The rows come from the prescription (`buildRows`), so deleting
 * one is kept as a count per exercise: `drop` rows taken off the end of the unlogged warm-ups and working sets, and
 * `extra` rows added with + Add Set. Unlogged rows of a kind are alike apart from their values, so taking the last one
 * off and moving the values of the rows after the deleted one up a place (`shiftDrafts`) shows exactly the list less
 * that row. A logged row also deletes its set. Like + Add Set, the counts live on the screen, not in the database.
 */

import type { LastTime } from "@/lib/data/queries";
import { buildRows, valuesOf, type SetRowView } from "./active";
import type { SetValues } from "./measure";

type Prescribed = Parameters<typeof buildRows>[0];

export type Drop = { warm: number; work: number };
export const NO_DROP: Drop = { warm: 0, work: 0 };

const block = (r: SetRowView): keyof Drop => (r.kind === "warm" ? "warm" : "work");

/** Take `n` rows off the end of a block, unlogged ones only (a logged row is never hidden). */
function trim(rows: SetRowView[], kind: keyof Drop, n: number): SetRowView[] {
  if (n <= 0) return rows;
  const out = [...rows];
  for (let i = out.length - 1; i >= 0 && n > 0; i--) {
    if (block(out[i]) !== kind) continue;
    if (out[i].set) break;
    out.splice(i, 1);
    n--;
  }
  return out;
}

/** An exercise's rows: the prescription's less the deleted, then the added ones (prefilled from the last working row). */
export function rowsFor(we: Prescribed, lastTime: LastTime | null, extra = 0, drop: Drop = NO_DROP): SetRowView[] {
  const rows = trim(trim(buildRows(we, lastTime), "warm", drop.warm), "work", drop.work);
  const lastWork = [...rows].reverse().find((r) => r.kind !== "warm");
  let n = rows.filter((r) => r.kind === "work").length;
  for (let i = 0; i < extra; i++)
    rows.push({
      ...(lastWork ? valuesOf(lastWork) : valuesOf({ weight: null, reps: null })),
      kind: "work",
      label: String(++n),
      set: null,
      last: null,
    });
  return rows;
}

export type DeletePlan = { setId: string | null; extra: number; drop: Drop };

/**
 * What deleting row `i` changes. A logged row deletes its set, and drops a row too when the prescription would
 * otherwise bring it back unlogged. An unlogged working row spends an added row first; any other unlogged row drops one.
 */
export function deletePlan(we: Prescribed, lastTime: LastTime | null, extra: number, drop: Drop, i: number): DeletePlan | null {
  const rows = rowsFor(we, lastTime, extra, drop);
  const row = rows[i];
  if (!row || rows.length <= 1) return null;
  const kind = block(row);
  if (row.set) {
    const id = row.set.id;
    const count = (r: SetRowView[]) => r.filter((x) => block(x) === kind).length;
    const before = count(buildRows(we, lastTime));
    const after = count(buildRows({ ...we, sets: we.sets.filter((s) => s.id !== id) }, lastTime));
    return { setId: id, extra, drop: after < before ? drop : { ...drop, [kind]: drop[kind] + 1 } };
  }
  if (kind === "work" && extra > 0) return { setId: null, extra: extra - 1, drop };
  return { setId: null, extra, drop: { ...drop, [kind]: drop[kind] + 1 } };
}

/**
 * The drafts after deleting row `i` of an exercise: each unlogged row after it takes the values it showed one place up,
 * so nothing but the deleted row changes on screen. `shown` is every row's value as displayed before the delete.
 */
export function shiftDrafts(
  drafts: Record<string, SetValues>,
  weId: string,
  rows: readonly SetRowView[],
  shown: readonly SetValues[],
  i: number,
): Record<string, SetValues> {
  const out: Record<string, SetValues> = {};
  for (const [k, v] of Object.entries(drafts)) {
    const [id, idx] = [k.slice(0, k.lastIndexOf(":")), Number(k.slice(k.lastIndexOf(":") + 1))];
    if (id !== weId || idx < i) out[k] = v;
  }
  for (let j = i + 1; j < rows.length; j++) if (!rows[j].set) out[`${weId}:${j - 1}`] = shown[j];
  return out;
}
