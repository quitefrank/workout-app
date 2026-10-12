"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { TimerIcon } from "@/components/icons";
import { formatClock } from "@/lib/workout/format";

/**
 * Rest timer. It stores when rest ends, not a countdown, so it survives
 * a reload or the phone sleeping, and chimes once when rest is over.
 */

type Timer = {
  endsAt: number | null;
  total: number;
  remaining: number;
  start: (seconds: number) => void;
  add: (seconds: number) => void;
  stop: () => void;
};

type Stored = { endsAt: number; total: number };

// localStorage is the timer's store; this event tells this tab it changed ("storage" covers other tabs)
const CHANGED = "rest-timer-change";

const readRaw = (key: string): string | null => {
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

const write = (key: string, v: Stored | null) => {
  try {
    if (v) localStorage.setItem(key, JSON.stringify(v));
    else localStorage.removeItem(key);
  } catch {
    // private mode: nothing persists, and the timer cannot run
  }
  window.dispatchEvent(new Event(CHANGED));
};

const subscribe = (onChange: () => void) => {
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

function chime(ctx: AudioContext | null) {
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

export function RestTimer({ timer }: { timer: Timer }) {
  if (timer.endsAt == null) return null;
  const done = timer.remaining === 0;
  const progress = timer.total ? 1 - timer.remaining / timer.total : 1;
  return (
    <div
      role="timer"
      aria-live="polite"
      aria-label={done ? "Rest over" : `Rest, ${timer.remaining} seconds left`}
      className="glass pointer-events-auto relative flex h-[50px] w-full items-center gap-2 overflow-hidden pl-4 pr-1.5"
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 -z-0 bg-blue/15 transition-[width] duration-300 ease-linear"
        style={{ width: `${progress * 100}%` }}
      />
      <TimerIcon size={20} className={done ? "relative text-green" : "relative text-blue"} />
      <span className="tabular relative flex-1 text-[20px] font-semibold">{done ? "Rest over" : formatClock(timer.remaining)}</span>
      {!done && (
        <>
          <TimerChip onClick={() => timer.add(-15)}>−15</TimerChip>
          <TimerChip onClick={() => timer.add(15)}>+15</TimerChip>
        </>
      )}
      <TimerChip onClick={timer.stop}>{done ? "Dismiss" : "Skip"}</TimerChip>
    </div>
  );
}

function TimerChip({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="tabular relative h-9 rounded-full bg-fill px-3 text-[15px] font-semibold">
      {children}
    </button>
  );
}
