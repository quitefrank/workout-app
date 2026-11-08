/**
 * The active workout's model, pure so it has tests. A workout exercise becomes a list of set rows: the warm-ups and
 * working sets its prescription asks for, filled by the sets already logged, and prefilled from the same set last time
 * on this floor. The focus screen works through the rows in order; the Journal shows them all.
 */

import type { LastTime, SetRow, WorkoutExerciseRow } from "@/lib/data/queries";
import { epley } from "./format";
import type { TopSet } from "./progress";

export type RowKind = "warm" | "work" | "drop";

export type SetRowView = {
  kind: RowKind;
  /** "W", "D" or the working set's number */
  label: string;
  /** The logged set, when there is one */
  set: SetRow | null;
  /** The same set last time on this floor */
  last: { weight: number | null; reps: number | null } | null;
  /** What the row starts with: the logged values, else last time, else the row before it, else the prescription */
  weight: number | null;
  reps: number | null;
};

type Prescribed = Pick<
  WorkoutExerciseRow,
  "prescribed_sets_min" | "prescribed_sets_max" | "prescribed_reps_min" | "prescribed_reps_max" | "warm_up_sets_min" | "warm_up_sets_max"
> & { sets: SetRow[] };

/** Working sets the prescription asks for (its upper bound), 0 when it does not say. */
export function workTarget(we: Pick<Prescribed, "prescribed_sets_min" | "prescribed_sets_max">): number {
  return we.prescribed_sets_max ?? we.prescribed_sets_min ?? 0;
}

export function warmTarget(we: Pick<Prescribed, "warm_up_sets_min" | "warm_up_sets_max">): number {
  return we.warm_up_sets_max ?? we.warm_up_sets_min ?? 0;
}

export function buildRows(we: Prescribed, lastTime: LastTime | null): SetRowView[] {
  const warmLogged = we.sets.filter((s) => s.is_warm_up);
  const workLogged = we.sets.filter((s) => !s.is_warm_up);
  const lastWarm = lastTime?.sets.filter((s) => s.is_warm_up) ?? [];
  const lastWork = lastTime?.sets.filter((s) => !s.is_warm_up && !s.is_drop_set) ?? [];
  const prescribedReps = we.prescribed_reps_max ?? we.prescribed_reps_min ?? null;
  const rows: SetRowView[] = [];

  const warmCount = Math.max(warmTarget(we), warmLogged.length);
  let prevWeight: number | null = null;
  for (let i = 0; i < warmCount; i++) {
    const set = warmLogged[i] ?? null;
    const last = lastWarm[i] ? { weight: lastWarm[i].weight, reps: lastWarm[i].reps } : null;
    const weight: number | null = set ? set.weight : (last?.weight ?? prevWeight);
    rows.push({ kind: "warm", label: "W", set, last, weight, reps: set ? set.reps : (last?.reps ?? null) });
    prevWeight = weight;
  }

  // An exercise with no prescription still has one row, so it can be logged and finished
  const workCount = Math.max(workTarget(we), workLogged.length, warmCount === 0 ? 1 : 0);
  prevWeight = null;
  let n = 0;
  for (let i = 0; i < workCount; i++) {
    const set = workLogged[i] ?? null;
    const last = lastWork[i] ? { weight: lastWork[i].weight, reps: lastWork[i].reps } : (lastWork.length ? { weight: lastWork[lastWork.length - 1].weight, reps: lastWork[lastWork.length - 1].reps } : null);
    const kind: RowKind = set?.is_drop_set ? "drop" : "work";
    if (kind === "work") n++;
    const weight: number | null = set ? set.weight : (last?.weight ?? prevWeight);
    const reps = set ? set.reps : (last?.reps ?? prescribedReps);
    rows.push({ kind, label: kind === "drop" ? "D" : String(n), set, last: lastWork[i] ? last : null, weight, reps });
    prevWeight = weight;
  }
  return rows;
}

/** The first row still to log, or -1 when every row is logged. */
export function nextRow(rows: readonly SetRowView[]): number {
  return rows.findIndex((r) => !r.set);
}

export function isDone(rows: readonly SetRowView[]): boolean {
  return rows.length > 0 && rows.every((r) => r.set);
}

/** "Warm-up 2 of 3" or "Set 1 of 2", for VoiceOver and the rest screen. */
export function rowLabel(rows: readonly SetRowView[], i: number): string {
  const row = rows[i];
  if (!row) return "";
  if (row.kind === "warm") {
    const warm = rows.filter((r) => r.kind === "warm");
    return `Warm-up ${warm.indexOf(row) + 1} of ${warm.length}`;
  }
  const work = rows.filter((r) => r.kind !== "warm");
  return `Set ${work.indexOf(row) + 1} of ${work.length}`;
}

/** Logged rows over all rows, across the workout. */
export function progress(all: readonly (readonly SetRowView[])[]): { logged: number; total: number; percent: number } {
  let logged = 0;
  let total = 0;
  for (const rows of all) {
    total += rows.length;
    logged += rows.filter((r) => r.set).length;
  }
  return { logged, total, percent: total ? Math.round((100 * logged) / total) : 0 };
}

/** Working sets and volume (weight × reps) logged so far. Warm-ups count toward neither. */
export function totals(sets: readonly SetRow[]): { sets: number; volume: number } {
  let n = 0;
  let volume = 0;
  for (const s of sets) {
    if (s.is_warm_up) continue;
    n++;
    volume += (s.weight ?? 0) * (s.reps ?? 0);
  }
  return { sets: n, volume };
}

export type Best = { weight: number; e1rm: number };

/** The heaviest weight and best estimated 1RM in a history of top sets, or null when there is none. */
export function best(history: readonly TopSet[]): Best | null {
  if (history.length === 0) return null;
  let weight = 0;
  let e1rm = 0;
  for (const t of history) {
    weight = Math.max(weight, t.weight);
    e1rm = Math.max(e1rm, epley(t.weight, t.reps));
  }
  return { weight, e1rm };
}

export type NewRecord = { kind: "weight" | "e1rm"; value: number; previous: number };

/**
 * What today's working sets beat: a heavier weight first, else a better estimated 1RM. Nothing on a first session,
 * which is a baseline, as the PR rule in progress.ts has it.
 */
export function newRecord(today: readonly SetRow[], previous: Best | null): NewRecord | null {
  if (!previous) return null;
  const work = today.filter((s) => !s.is_warm_up && !s.is_drop_set && s.weight != null && s.reps != null && s.reps > 0);
  if (work.length === 0) return null;
  const heaviest = Math.max(...work.map((s) => s.weight!));
  if (heaviest > previous.weight) return { kind: "weight", value: heaviest, previous: previous.weight };
  const e = Math.max(...work.map((s) => epley(s.weight!, s.reps!)));
  if (e > previous.e1rm + 0.5) return { kind: "e1rm", value: Math.round(e), previous: Math.round(previous.e1rm) };
  return null;
}

/** One stepper tap: 5 lb or 2.5 kg for weight, 1 for reps, never below zero. */
export function step(value: number | null, field: "weight" | "reps", dir: 1 | -1, unit: "lbs" | "kg"): number {
  const by = field === "reps" ? 1 : unit === "kg" ? 2.5 : 5;
  return Math.max(0, Math.round(((value ?? 0) + dir * by) * 100) / 100);
}

/** What swapping a row to `to` leaves in swapped_from: the exercise it started as, or nothing once it is back. */
export function swappedFrom(current: { exerciseId: string; swappedFrom: string | null }, to: string): string | null {
  const origin = current.swappedFrom ?? current.exerciseId;
  return origin === to ? null : origin;
}
