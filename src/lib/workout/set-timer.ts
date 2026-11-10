/**
 * A timer that runs during a set, not after it (plan 2 of the measures work, Frank's calls of 2026-11-09):
 *
 * - `hold`: a static stretch counts down its seconds (30 when none are written). Tapping the circle starts it; at zero
 *   the set logs itself with those seconds. Tapping again before then logs the seconds held so far.
 * - `watch`: an outdoor run counts up. Tapping the circle starts it, tapping again stops it and logs the distance with
 *   the time it ran, so time is kept by the app and never typed.
 *
 * It stores when it started, not a running count, so it survives a reload or the phone sleeping. Pure, so it has tests.
 */

export type SetTimerMode = "hold" | "watch";

export type StoredSetTimer = {
  weId: string;
  /** The set row it belongs to */
  row: number;
  mode: SetTimerMode;
  startedAt: number;
  /** A hold's length in seconds; unused by a watch */
  total: number;
};

export type SetTimerView = {
  /** Whole seconds since it started */
  elapsed: number;
  /** Whole seconds left on a hold; 0 for a watch */
  remaining: number;
  /** A hold that has reached zero */
  done: boolean;
};

export function viewSetTimer(t: StoredSetTimer, now: number): SetTimerView {
  const elapsed = Math.max(0, Math.floor((now - t.startedAt) / 1000));
  if (t.mode === "watch") return { elapsed, remaining: 0, done: false };
  const remaining = Math.max(0, Math.ceil((t.startedAt + t.total * 1000 - now) / 1000));
  return { elapsed: Math.min(elapsed, t.total), remaining, done: remaining === 0 };
}

/** The seconds a stopped timer logs: a finished hold its full length, an early stop or a watch the time so far. */
export function loggedSeconds(t: StoredSetTimer, now: number): number {
  const v = viewSetTimer(t, now);
  return t.mode === "hold" && v.done ? t.total : v.elapsed;
}

export function parseStoredSetTimer(raw: string | null): StoredSetTimer | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    if (
      typeof v?.weId === "string" &&
      typeof v?.row === "number" &&
      (v?.mode === "hold" || v?.mode === "watch") &&
      typeof v?.startedAt === "number" &&
      typeof v?.total === "number"
    )
      return v;
  } catch {
    // a bad value is no timer
  }
  return null;
}
