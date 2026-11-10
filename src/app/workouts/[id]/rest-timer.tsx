"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Rest timer. It stores when rest ends, not a countdown, so it survives
 * a reload or the phone sleeping, and chimes once when rest is over.
 */

export type Timer = {
  endsAt: number | null;
  total: number;
  remaining: number;
  start: (seconds: number) => void;
  add: (seconds: number) => void;
  stop: () => void;
};

type Stored = { endsAt: number; total: number };

// localStorage is the timers' store (rest here, the set timer in set-timer.tsx); this event tells this tab it changed ("storage" covers other tabs)
const CHANGED = "rest-timer-change";

export const readRaw = (key: string): string | null => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const parse = (raw: string | null): Stored | null => {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.endsAt === "number" && typeof v?.total === "number" ? v : null;
  } catch {
    return null;
  }
};

export const write = (key: string, v: object | null) => {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {
    // private mode: nothing persists, and the timer cannot run
  }
  window.dispatchEvent(new Event(CHANGED));
};

export const subscribe = (onChange: () => void) => {
  window.addEventListener(CHANGED, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED, onChange);
    window.removeEventListener("storage", onChange);
  };
};

export function useRestTimer(workoutId: string): Timer {
  const key = `rest:${workoutId}`;
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const state = parse(raw);
  const [now, setNow] = useState(() => Date.now());
  const audio = useRef<AudioContext | null>(null);
  const chimed = useRef<number | null>(null);

  const endsAt = state?.endsAt ?? null;
  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [endsAt]);

  const remaining = endsAt != null ? Math.max(0, Math.ceil((endsAt - now) / 1000)) : 0;

  useEffect(() => {
    if (endsAt == null || remaining > 0 || chimed.current === endsAt) return;
    chimed.current = endsAt;
    // A rest that ran out while the page was closed ends quietly
    if (Date.now() - endsAt < 5000) {
      chime(audio.current);
      navigator.vibrate?.([200, 100, 200]);
    }
    const t = window.setTimeout(() => write(key, null), 2500);
    return () => window.clearTimeout(t);
  }, [remaining, endsAt, key]);

  const start = useCallback(
    (seconds: number) => {
      if (seconds <= 0) return;
      // Unlock audio inside the tap that started rest; iOS refuses sound otherwise
      try {
        audio.current ??= new AudioContext();
        void audio.current.resume();
      } catch {
        audio.current = null;
      }
      setNow(Date.now());
      write(key, { endsAt: Date.now() + seconds * 1000, total: seconds });
    },
    [key],
  );

  const add = useCallback(
    (seconds: number) => {
      const cur = parse(readRaw(key));
      if (!cur) return;
      write(key, { endsAt: Math.max(Date.now(), cur.endsAt + seconds * 1000), total: Math.max(1, cur.total + seconds) });
    },
    [key],
  );

  const stop = useCallback(() => write(key, null), [key]);

  return { endsAt, total: state?.total ?? 0, remaining, start, add, stop };
}

export function chime(ctx: AudioContext | null) {
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    for (const [i, f] of [880, 1320].entries()) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.25, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35);
      o.connect(g).connect(ctx.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.4);
    }
  } catch {
    // no sound is fine
  }
}
