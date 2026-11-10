"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { loggedSeconds, parseStoredSetTimer, viewSetTimer, type SetTimerMode, type StoredSetTimer, type SetTimerView } from "@/lib/workout/set-timer";
import { chime, readRaw, subscribe, write } from "./rest-timer";

/**
 * The timer that runs during a set: a static stretch's hold counting down, or an outdoor run's stopwatch counting up
 * (the model is `src/lib/workout/set-timer.ts`). Stored in localStorage like the rest timer, so it survives a reload or
 * the phone sleeping. A hold chimes at zero and hands itself to `onHoldDone`, which logs the set.
 */
export type SetTimer = {
  state: StoredSetTimer | null;
  view: SetTimerView | null;
  start: (weId: string, row: number, mode: SetTimerMode, total: number) => void;
  /** Lengthen or shorten a running hold, never below one second */
  add: (seconds: number) => void;
  stop: () => void;
  /** Stop the timer and return the seconds to log (a finished hold its length, else the time so far) */
  finish: () => number | null;
};

export function useSetTimer(workoutId: string, onHoldDone: (t: StoredSetTimer) => void): SetTimer {
  const key = `set-timer:${workoutId}`;
  const raw = useSyncExternalStore(subscribe, () => readRaw(key), () => null);
  const state = parseStoredSetTimer(raw);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const handled = useRef<number | null>(null);
  const done = useRef(onHoldDone);
  useEffect(() => {
    done.current = onHoldDone;
  });

  const startedAt = state?.startedAt ?? null;
  useEffect(() => {
    if (startedAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [startedAt]);

  const view = state ? viewSetTimer(state, now) : null;

  const holdDone = view?.done ?? false;
  useEffect(() => {
    const t = parseStoredSetTimer(raw);
    if (!t || t.mode !== "hold" || !holdDone || handled.current === t.startedAt) return;
    handled.current = t.startedAt;
    // a hold that ran out while the page was closed logs quietly
    if (Date.now() - (t.startedAt + t.total * 1000) < 5000) {
      chime(audio.current);
      navigator.vibrate?.([200, 100, 200]);
    }
    done.current(t);
  }, [raw, holdDone]);

  const start = useCallback(
    (weId: string, row: number, mode: SetTimerMode, total: number) => {
      // unlock audio inside the tap, as the rest timer does; iOS refuses sound otherwise
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        audio.current = null;
      }
      setNow(Date.now());
      write(key, { weId, row, mode, startedAt: Date.now(), total } satisfies StoredSetTimer);
    },
    [key, setNow],
  );

  const add = useCallback(
    (seconds: number) => {
      const cur = parseStoredSetTimer(readRaw(key));
      if (!cur || cur.mode !== "hold") return;
      const elapsed = (Date.now() - cur.startedAt) / 1000;
      write(key, { ...cur, total: Math.max(Math.ceil(elapsed) + 1, cur.total + seconds) });
    },
    [key],
  );

  const stop = useCallback(() => write(key, null), [key]);

  const finish = useCallback(() => {
    const cur = parseStoredSetTimer(readRaw(key));
    write(key, null);
    return cur ? loggedSeconds(cur, Date.now()) : null;
  }, [key]);

  return { state, view, start, add, stop, finish };
}
