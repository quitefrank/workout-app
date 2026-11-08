"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { completeWorkout } from "@/app/actions";
import { TrophyIcon } from "@/components/icons";
import { Sheet, SheetConfirm } from "@/components/sheet";
import { cn } from "@/lib/cn";
import type { WorkoutDetail, WorkoutExerciseRow } from "@/lib/data/queries";
import { newRecord, totals } from "@/lib/workout/active";
import { formatClock, formatNumber } from "@/lib/workout/format";
import { floorKey } from "@/lib/workout/machine-location";
import { exerciseTitle } from "@/lib/workout/movements";

/**
 * Finishing, Bevel's and Hevy's way rather than Ladder's (Frank's call, 2026-11-08): new records first, then time,
 * working sets and volume, then, when anything was swapped, whether the template keeps the swaps.
 */
export function FinishSheet({
  open,
  onClose,
  workout,
  exercises,
  elapsed,
  unit,
}: {
  open: boolean;
  onClose: () => void;
  workout: WorkoutDetail;
  exercises: WorkoutExerciseRow[];
  elapsed: number | null;
  unit: "lbs" | "kg";
}) {
  const [keep, setKeep] = useState(false);
  const [pending, start] = useTransition();

  const records = exercises
    .map((we) => ({ we, record: newRecord(we.sets, workout.bests[floorKey(we.exercises.id, we.machine_location)] ?? null) }))
    .filter((r) => r.record);
  const t = totals(exercises.flatMap((we) => we.sets));
  const swaps = exercises.filter((we) => we.swapped_from_exercise_id);
  const unlogged = exercises.filter((we) => we.sets.length === 0).length;

  const finish = () =>
    start(async () => {
      try {
        await completeWorkout(workout.id, { keepSwaps: keep && swaps.length > 0 });
      } catch (e) {
        if (e instanceof Error && e.message.includes("NEXT_REDIRECT")) throw e;
        toast.error(e instanceof Error ? e.message : "Could not finish");
      }
    });

  return (
    <Sheet open={open} onClose={onClose} title="Finish Workout" trailing={<SheetConfirm label="Finish" disabled={pending} onClick={finish} />}>
      <section className="mb-3 rounded-[16px] bg-card px-4 py-3">
        <h3 className="pb-2 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">{records.length ? "New records" : "Records"}</h3>
        {records.length === 0 ? (
          <p className="text-[15px] text-ink-2">No new records today.</p>
        ) : (
          <ul className="grid gap-2.5">
            {records.map(({ we, record }) => (
              <li key={we.id} className="flex items-center gap-3">
                <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-[rgb(255_204_0/0.22)] text-[#b38f00]">
                  <TrophyIcon size={17} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[15px] font-semibold">{exerciseTitle(we.exercises)}</span>
                  <span className="block text-[13px] text-ink-2">
                    {record!.kind === "weight" ? "Heaviest weight" : "One rep max"} · {formatNumber(record!.value)} {unit} (was {formatNumber(record!.previous)})
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mb-3 grid grid-cols-3 rounded-[16px] bg-card px-2 py-3 text-center">
        <Stat value={elapsed == null ? "–" : formatClock(elapsed)} label="time" />
        <Stat value={String(t.sets)} label="working sets" />
        <Stat value={formatNumber(t.volume)} label={unit} />
      </section>

      {swaps.length > 0 && (
        <section className="mb-3 flex items-center justify-between gap-3 rounded-[16px] bg-card px-4 py-3">
          <span className="min-w-0">
            <span className="block text-[15px] font-semibold">Keep swaps in template</span>
            <span className="block text-[13px] text-ink-2">{swaps.map((we) => exerciseTitle(we.exercises)).join(", ")} next time too</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={keep}
            aria-label="Keep swaps in template"
            onClick={() => setKeep(!keep)}
            className={cn("relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors", keep ? "bg-green" : "bg-fill-2")}
          >
            <span className={cn("absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow transition-transform", keep && "translate-x-5")} />
          </button>
        </section>
      )}

      {unlogged > 0 && (
        <p className="px-4 pb-2 text-[13px] text-ink-2">
          {unlogged} {unlogged === 1 ? "exercise has" : "exercises have"} nothing logged.
        </p>
      )}
    </Sheet>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <span className="grid">
      <span className="tabular text-[20px] font-bold">{value}</span>
      <span className="text-[11px] text-ink-2">{label}</span>
    </span>
  );
}
