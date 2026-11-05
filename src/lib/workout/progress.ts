/**
 * History reductions the screens need from the top-set view: latest
 * performance per exercise, lifetime bests, and which sessions set a
 * new estimated 1RM. Pure, so the PR rule has tests.
 */

import { epley } from "./format";
import { floorKey, type MachineLocation } from "./machine-location";

export type TopSet = {
  exercise_id: string;
  workout_id: string;
  weight: number;
  reps: number;
  completed_at: string; // the workout's completed_at
  floor: MachineLocation | null;
};

/** Most recent top set per exercise, whichever floor it was on. It carries its floor, for the label. */
export function latestByExercise(rows: readonly TopSet[]): Map<string, TopSet> {
  const out = new Map<string, TopSet>();
  for (const r of rows) {
    const cur = out.get(r.exercise_id);
    if (!cur || r.completed_at > cur.completed_at) out.set(r.exercise_id, r);
  }
  return out;
}

export type Bests = { heaviest: TopSet | null; bestE1rm: (TopSet & { e1rm: number }) | null };

export function bests(rows: readonly TopSet[]): Bests {
  let heaviest: TopSet | null = null;
  let bestE1rm: (TopSet & { e1rm: number }) | null = null;
  for (const r of rows) {
    if (!heaviest || r.weight > heaviest.weight) heaviest = r;
    const e = epley(r.weight, r.reps);
    if (!bestE1rm || e > bestE1rm.e1rm) bestE1rm = { ...r, e1rm: e };
  }
  return { heaviest, bestE1rm };
}

export type Pr = TopSet & { e1rm: number; previous: number };

/**
 * Sessions whose top set beat every earlier estimated 1RM for the same
 * exercise on the same floor. The first session on a floor is a baseline,
 * not a PR.
 */
export function prs(rows: readonly TopSet[]): Pr[] {
  const sorted = [...rows].sort((a, b) => a.completed_at.localeCompare(b.completed_at));
  const best = new Map<string, number>();
  const out: Pr[] = [];
  for (const r of sorted) {
    const e = epley(r.weight, r.reps);
    const key = floorKey(r.exercise_id, r.floor);
    const prev = best.get(key);
    if (prev !== undefined && e > prev) out.push({ ...r, e1rm: e, previous: prev });
    if (prev === undefined || e > prev) best.set(key, e);
  }
  return out;
}
