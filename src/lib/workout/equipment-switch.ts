import type { SetRowView } from "./active";

/**
 * An equipment switch mid-exercise, shown as one exercise (Frank's calls, 2026-11-13). Picking other equipment after a
 * set is logged keeps the database as it is: `swapExercise` adds the new version as its own row right after, with
 * `swapped_from_exercise_id`, so history and records stay with each version. On screen the rows join into one entry:
 * the earlier rows' logged sets, then the current row's sets, under the current version, with the equipment of each set
 * so the Journal can show an Equipment column. The workout screen merges once, here, and each set still logs, edits and
 * deletes against its own row (`locate`).
 */

/** What the merge reads of a workout exercise */
export type SwitchRow = {
  id: string;
  swapped_from_exercise_id: string | null;
  exercises: { id: string; movement: string | null; option_equipment: string | null };
};

type EntryLike = { we: SwitchRow; rows: SetRowView[] };

/** One row of the database inside a merged entry: the entry as built for that row, and which of its rows are shown */
export type Part<E extends EntryLike> = { entry: E; rows: number[] };

export type Merged<E extends EntryLike> = E & {
  /** The rows the entry joins, first to current; absent on an entry that is one row */
  parts?: Part<E>[];
  /** Each shown set's equipment, parallel to `rows`; absent on an entry that is one row */
  equipment?: (string | null)[];
};

/** The exercise a row was first, before any swap */
const origin = (we: SwitchRow) => we.swapped_from_exercise_id ?? we.exercises.id;

/** `b` is `a` on other equipment: switched from what `a` started as, in the same family, on different equipment */
export function isEquipmentSwitch(a: SwitchRow, b: SwitchRow): boolean {
  return (
    !!b.swapped_from_exercise_id &&
    b.swapped_from_exercise_id === origin(a) &&
    !!a.exercises.movement &&
    a.exercises.movement === b.exercises.movement &&
    a.exercises.option_equipment !== b.exercises.option_equipment
  );
}

const logged = (rows: SetRowView[]) => rows.some((r) => r.set);

/**
 * Join each run of equipment switches into one entry. An earlier row joins only while it has a logged set, and shows
 * only its logged sets (what it still prescribed moved to the new row). Working sets are numbered through the whole
 * entry, so the switch reads as one exercise ("Set 2 of 3").
 */
export function mergeSwitched<E extends EntryLike>(entries: readonly E[]): Merged<E>[] {
  const out: Merged<E>[] = [];
  let group: E[] = [];
  const flush = () => {
    if (group.length === 1) out.push(group[0]);
    else if (group.length > 1) out.push(join(group));
    group = [];
  };
  for (const e of entries) {
    const prev = group[group.length - 1];
    if (prev && logged(prev.rows) && isEquipmentSwitch(prev.we, e.we)) group.push(e);
    else {
      flush();
      group = [e];
    }
  }
  flush();
  return out;
}

function join<E extends EntryLike>(group: E[]): Merged<E> {
  const last = group[group.length - 1];
  const parts: Part<E>[] = group.map((entry, k) => ({
    entry,
    rows: entry.rows.map((r, i) => (k === group.length - 1 || r.set ? i : -1)).filter((i) => i >= 0),
  }));
  let n = 0;
  const rows: SetRowView[] = [];
  const equipment: (string | null)[] = [];
  for (const p of parts) {
    for (const i of p.rows) {
      const r = p.entry.rows[i];
      rows.push(r.kind === "work" ? { ...r, label: String(++n) } : r);
      equipment.push(p.entry.we.exercises.option_equipment);
    }
  }
  return { ...last, rows, parts, equipment };
}

/** The row of the database a shown set belongs to, and its index there */
export function locate<E extends EntryLike>(entry: Merged<E>, i: number): { entry: E; i: number } {
  if (!entry.parts) return { entry, i };
  let at = i;
  for (const p of entry.parts) {
    if (at < p.rows.length) return { entry: p.entry, i: p.rows[at] };
    at -= p.rows.length;
  }
  const last = entry.parts[entry.parts.length - 1];
  return { entry: last.entry, i: last.entry.rows.length };
}

/** The row of the database a logged set belongs to */
export function ownerOf<E extends EntryLike>(entry: Merged<E>, setId: string): E {
  return entry.parts?.find((p) => p.entry.rows.some((r) => r.set?.id === setId))?.entry ?? entry;
}

/**
 * The working sets the new row prescribes after a switch: what the old row prescribed less what was logged on it, at
 * least one, so the joined exercise still adds up to the prescription. No prescription stays none.
 */
export function remainingSets(min: number | null, max: number | null, loggedWorking: number): { min: number | null; max: number | null } {
  const less = (n: number | null) => (n == null ? null : Math.max(1, n - loggedWorking));
  return { min: less(min), max: less(max) };
}

/** More than one equipment among the shown sets: the Journal adds its Equipment column */
export const mixedEquipment = (entry: Merged<EntryLike>): boolean => new Set(entry.equipment ?? []).size > 1;
