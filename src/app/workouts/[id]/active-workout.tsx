"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { completeWorkout, discardWorkout, setMachineLocation } from "@/app/actions";
import { Button } from "@/components/button";
import { GlassButton, GlassCircleButton, GlassCircleLink } from "@/components/glass";
import { TopBar } from "@/components/top-bar";
import { CheckIcon, ChevronLeft, TrashIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { useElapsed } from "@/components/tab-bar";
import { cn } from "@/lib/cn";
import type { Settings, WorkoutDetail } from "@/lib/data/queries";
import { formatClock } from "@/lib/workout/format";
import type { MachineLocation } from "@/lib/workout/machine-location";
import { ExerciseCard, workingTarget } from "./exercise-card";
import { RestTimer, useRestTimer } from "./rest-timer";

export function ActiveWorkout({ workout, settings }: { workout: WorkoutDetail; settings: Settings }) {
  const elapsed = useElapsed(workout.started_at);
  const timer = useRestTimer(workout.id);
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [pending, start] = useTransition();

  const isDone = useCallback(
    (we: WorkoutDetail["exercises"][number]) => {
      const target = workingTarget(we);
      const working = we.sets.filter((s) => !s.is_warm_up).length;
      return target > 0 ? working >= target : we.sets.length > 0;
    },
    [],
  );

  // Open the first exercise that still has work left
  const firstOpen = useMemo(
    () => workout.exercises.find((we) => !isDone(we))?.id ?? workout.exercises[0]?.id ?? null,
    // only on first render; afterwards the user drives it
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [expanded, setExpanded] = useState<string | null>(firstOpen);

  const doneCount = workout.exercises.filter(isDone).length;
  const hasMachines = workout.exercises.some((we) => we.exercises.machine_location);
  const totalSets = workout.exercises.reduce((n, we) => n + we.sets.filter((s) => !s.is_warm_up).length, 0);

  const run = (fn: () => Promise<void>) =>
    start(async () => {
      try {
        await fn();
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <main className="mx-auto w-full max-w-[640px] flex-1" style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 180px)" }}>
      <header className="px-4 pb-3">
        <TopBar
          leading={
            <GlassCircleLink href="/" label="Back to calendar">
              <ChevronLeft size={20} />
            </GlassCircleLink>
          }
          center={
            <div className="glass flex h-11 items-center gap-2 px-4 text-[17px] font-semibold">
              <span className="tabular">{elapsed == null ? "0:00" : formatClock(elapsed)}</span>
            </div>
          }
          trailing={
            <GlassCircleButton label="Discard workout" onClick={() => setConfirmDiscard(true)}>
              <TrashIcon size={19} />
            </GlassCircleButton>
          }
        />
        <h1 className="mt-3 text-[34px] font-bold leading-[41px] tracking-[-0.01em]">{workout.templates?.name ?? "Workout"}</h1>
        <div className="flex items-center justify-between gap-3 text-[15px] font-medium text-ink-2">
          <span>
            {doneCount} of {workout.exercises.length} exercises · {totalSets} sets
          </span>
        </div>
        {hasMachines && (
          <LocationSwitch
            value={workout.machine_location}
            disabled={pending}
            onChange={(loc) => run(() => setMachineLocation(workout.id, loc))}
          />
        )}
      </header>

      <div className="flex flex-col gap-2.5 px-4">
        {workout.exercises.map((we, i) => (
          <ExerciseCard
            key={we.id}
            index={i}
            we={we}
            done={isDone(we)}
            unit={settings.weight_unit}
            lastTime={workout.lastTime[we.exercises.id] ?? null}
            expanded={expanded === we.id}
            onToggle={() => setExpanded((cur) => (cur === we.id ? null : we.id))}
            onLogged={(isWarmUp) => {
              if (!isWarmUp) timer.start(we.prescribed_rest_seconds ?? settings.default_rest_seconds);
            }}
          />
        ))}
      </div>

      <div
        data-glass-unit="dock"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[640px] flex-col gap-2.5 px-[21px]"
        // 21pt up from the screen edge (--dock-bottom); where iOS ends the page short of the screen (--screen-gap)
        // nothing draws below the page, so the bar sits as near the edge as the page allows
        style={{ paddingBottom: "max(0px, calc(var(--dock-bottom) - var(--screen-gap, 0px)))" }}
      >
        <RestTimer timer={timer} />
        <GlassButton tone="green" className="pointer-events-auto w-full" onClick={() => setFinishing(true)}>
          <CheckIcon size={20} />
          Finish Workout
        </GlassButton>
      </div>

      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        pending={pending}
        unlogged={workout.exercises.length - doneCount}
        onFinish={(effort, notes) => run(() => completeWorkout(workout.id, { perceivedEffort: effort, notes }))}
      />

      <Sheet open={confirmDiscard} onClose={() => setConfirmDiscard(false)} title="Discard Workout?">
        <p className="px-4 pb-4 text-[15px] text-ink-2">
          Every set logged in this workout is deleted. This cannot be undone.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button variant="filled" tone="red" disabled={pending} onClick={() => run(() => discardWorkout(workout.id))}>
            Discard Workout
          </Button>
          <Button variant="gray" onClick={() => setConfirmDiscard(false)}>
            Keep Going
          </Button>
        </div>
      </Sheet>
    </main>
  );
}

/** The kit's segmented control (content layer, not glass). */
function LocationSwitch({
  value,
  disabled,
  onChange,
}: {
  value: MachineLocation | null;
  disabled: boolean;
  onChange: (v: MachineLocation | null) => void;
}) {
  const options = [
    ["upstairs", "Upstairs"],
    ["downstairs", "Downstairs"],
  ] as const;
  return (
    <div role="group" aria-label="Machine location" className="mt-3 flex gap-1 rounded-full bg-fill p-0.5">
      {options.map(([v, label]) => {
        const on = value === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(on ? null : v)}
            className={cn(
              "h-8 flex-1 rounded-full text-[13px] font-medium transition",
              on && "bg-[var(--seg-on)] font-semibold shadow-[var(--seg-shadow)]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function FinishSheet({
  open,
  onClose,
  pending,
  unlogged,
  onFinish,
}: {
  open: boolean;
  onClose: () => void;
  pending: boolean;
  unlogged: number;
  onFinish: (effort: number | null, notes: string | null) => void;
}) {
  const [effort, setEffort] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Finish Workout"
      leading={
        <button type="button" className="text-[17px] text-blue" onClick={onClose}>
          Cancel
        </button>
      }
      trailing={
        <button
          type="button"
          disabled={pending}
          className="text-[17px] font-semibold text-blue disabled:opacity-40"
          onClick={() => onFinish(effort, notes)}
        >
          Done
        </button>
      }
    >
      {unlogged > 0 && (
        <p className="px-4 pb-3 text-[15px] text-ink-2">
          {unlogged} {unlogged === 1 ? "exercise is" : "exercises are"} short of the prescribed sets.
        </p>
      )}
      <h3 className="px-4 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">Perceived effort</h3>
      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={effort === n}
            onClick={() => setEffort(effort === n ? null : n)}
            className={cn(
              "tabular h-11 rounded-xl bg-card text-[17px] font-semibold",
              effort === n && "bg-blue text-white",
            )}
          >
            {n}
          </button>
        ))}
      </div>
      <h3 className="px-4 pb-1.5 pt-5 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">Notes</h3>
      <textarea
        data-live
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={3}
        placeholder="How did it go?"
        className="w-full resize-none rounded-[20px] bg-card px-4 py-3 text-[17px] outline-none placeholder:text-ink-3"
      />
    </Sheet>
  );
}
