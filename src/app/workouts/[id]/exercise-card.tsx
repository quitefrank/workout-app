"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteSet, logSet, quickLog, updateSet } from "@/app/actions";
import { CheckIcon, ChevronDown, PencilIcon, PlusIcon, TrashIcon, XIcon } from "@/components/icons";
import { Sheet } from "@/components/sheet";
import { cn } from "@/lib/cn";
import type { LastTime, SetRow, WorkoutExerciseRow } from "@/lib/data/queries";
import { dayLabel, localDate } from "@/lib/workout/dates";
import {
  displayWeight,
  formatNumber,
  isRawReading,
  prescriptionParts,
  range,
  setsToCsv,
  type WeightUnit,
} from "@/lib/workout/format";

/** Working sets the prescription asks for (the upper bound), 0 when it does not say. */
export function workingTarget(we: Pick<WorkoutExerciseRow, "prescribed_sets_min" | "prescribed_sets_max">): number {
  return we.prescribed_sets_max ?? we.prescribed_sets_min ?? 0;
}

type Pending = SetRow & { pending?: boolean };

export function ExerciseCard({
  index,
  we,
  done,
  unit,
  lastTime,
  expanded,
  onToggle,
  onLogged,
}: {
  index: number;
  we: WorkoutExerciseRow;
  done: boolean;
  unit: WeightUnit;
  lastTime: LastTime | null;
  expanded: boolean;
  onToggle: () => void;
  onLogged: (isWarmUp: boolean) => void;
}) {
  const ex = we.exercises;
  const [sets, addOptimistic] = useOptimistic<Pending[], Pending>(we.sets, (cur, s) => [...cur, s]);
  const [pending, start] = useTransition();
  const [quick, setQuick] = useState(false);

  const warmUps = sets.filter((s) => s.is_warm_up);
  const working = sets.filter((s) => !s.is_warm_up);
  const target = workingTarget(we);
  const warmTarget = we.warm_up_sets_max ?? 0;
  const raw = isRawReading(ex.equipment_type);

  const lastSet = sets[sets.length - 1];
  const nextFromLastTime = lastTime?.sets[sets.length];
  const defaultWarm = warmUps.length < warmTarget && working.length === 0;

  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [warm, setWarm] = useState<boolean | null>(null);
  const isWarm = warm ?? defaultWarm;

  const submit = () => {
    const w = weight.trim() === "" ? (lastSet?.weight ?? null) : Number(weight);
    const r = reps.trim() === "" ? null : Number(reps);
    if (w == null && r == null) {
      toast.error("Enter a weight or reps.");
      return;
    }
    if ((w != null && !Number.isFinite(w)) || (r != null && !Number.isInteger(r))) {
      toast.error("Weight is a number, reps a whole number.");
      return;
    }
    start(async () => {
      addOptimistic({
        id: `pending-${Date.now()}`,
        set_number: (lastSet?.set_number ?? 0) + 1,
        is_warm_up: isWarm,
        weight: w,
        reps: r,
        seconds: null,
        rpe: null,
        notes: null,
        completed_at: new Date().toISOString(),
        pending: true,
      });
      try {
        await logSet(we.id, { weight: w, reps: r, isWarmUp: isWarm });
        setReps("");
        setWarm(null);
        onLogged(isWarm);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not log the set");
      }
    });
  };

  const prescription = prescriptionParts(we);

  return (
    <section className={cn("overflow-hidden rounded-[26px] bg-card transition-colors", done && !expanded && "opacity-80")}>
      <button type="button" onClick={onToggle} aria-expanded={expanded} className="flex w-full items-center gap-3 px-4 py-3 text-left">
        <span
          className={cn(
            "tabular grid size-8 shrink-0 place-items-center rounded-full text-[15px] font-semibold",
            done ? "bg-green text-white" : "bg-fill text-ink-2",
          )}
        >
          {done ? <CheckIcon size={16} strokeWidth={2.6} /> : index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[17px] font-semibold leading-[22px]">
            {ex.name}
            {ex.machine_location && (
              <span className="ml-1.5 align-middle text-[13px] font-medium text-ink-2">
                {ex.machine_location === "upstairs" ? "↑ Up" : "↓ Down"}
              </span>
            )}
          </span>
          <span className="block truncate text-[15px] leading-5 text-ink-2">{prescription.join(" · ") || "No prescription"}</span>
        </span>
        <span className="tabular shrink-0 text-[15px] text-ink-2">
          {working.length}
          {target ? `/${target}` : ""}
        </span>
        <ChevronDown size={18} className={cn("shrink-0 text-ink-3 transition-transform", expanded && "rotate-180")} />
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {lastTime && lastTime.sets.length > 0 && (
            <p className="mb-2 text-[13px] text-ink-2">
              <span className="font-semibold">Last time</span> · {dayLabel(localDate(lastTime.completedAt))}:{" "}
              <span className="tabular">{setsToCsv(lastTime.sets)}</span>
            </p>
          )}
          {we.notes && <p className="mb-2 text-[13px] text-ink-2">{we.notes}</p>}

          {sets.length > 0 && (
            <div className="mb-3 overflow-hidden rounded-[18px] bg-bg/60">
              {warmUps.length > 0 && <SetGroup label="Warm-up" sets={warmUps} unit={unit} raw={raw} equipment={ex.equipment_type} />}
              {working.length > 0 && <SetGroup label="Working" sets={working} unit={unit} raw={raw} equipment={ex.equipment_type} />}
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            className="flex items-stretch gap-2"
          >
            <NumberField
              label={raw ? "Weight" : unit}
              value={weight}
              onChange={setWeight}
              placeholder={formatNumber(lastSet?.weight ?? nextFromLastTime?.weight) || "0"}
              decimal
            />
            <NumberField
              label="Reps"
              value={reps}
              onChange={setReps}
              placeholder={
                nextFromLastTime?.reps != null
                  ? String(nextFromLastTime.reps)
                  : (range(we.prescribed_reps_min, we.prescribed_reps_max) ?? "")
              }
            />
            <button
              type="button"
              aria-pressed={isWarm}
              onClick={() => setWarm(!isWarm)}
              className={cn(
                "flex w-[60px] shrink-0 flex-col items-center justify-center rounded-2xl text-[11px] font-semibold uppercase tracking-[0.04em]",
                isWarm ? "bg-orange/20 text-orange" : "bg-fill text-ink-3",
              )}
            >
              Warm
              <span className="text-[13px] normal-case tracking-normal">{isWarm ? "On" : "Off"}</span>
            </button>
            <button
              type="submit"
              disabled={pending}
              aria-label="Log set"
              className="grid w-14 shrink-0 place-items-center rounded-2xl bg-blue text-white disabled:opacity-50"
            >
              <PlusIcon size={24} strokeWidth={2.4} />
            </button>
          </form>

          <div className="mt-2.5 flex items-center justify-between text-[15px]">
            <button type="button" className="text-blue" onClick={() => setQuick(true)}>
              Quick log
            </button>
            <Link href={`/exercises/${ex.id}`} className="text-blue">
              History
            </Link>
          </div>

          <QuickLogSheet
            open={quick}
            onClose={() => setQuick(false)}
            workoutExerciseId={we.id}
            initial={setsToCsv(we.sets)}
            warmUps={we.warm_up_sets_max}
            name={ex.name}
          />
        </div>
      )}
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  placeholder,
  decimal,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  decimal?: boolean;
}) {
  return (
    <label className="flex min-w-0 flex-1 flex-col rounded-2xl bg-fill px-3 py-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-ink-2">{label}</span>
      <input
        type="number"
        inputMode={decimal ? "decimal" : "numeric"}
        step={decimal ? "any" : "1"}
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="tabular w-full bg-transparent text-[22px] font-semibold outline-none placeholder:text-ink-3"
      />
    </label>
  );
}

function SetGroup({
  label,
  sets,
  unit,
  raw,
  equipment,
}: {
  label: string;
  sets: Pending[];
  unit: WeightUnit;
  raw: boolean;
  equipment: WorkoutExerciseRow["exercises"]["equipment_type"];
}) {
  return (
    <div>
      <div className="px-3.5 pb-0.5 pt-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-2">{label}</div>
      {sets.map((s, i) => (
        <SetLine key={s.id} set={s} n={i + 1} warm={s.is_warm_up} unit={unit} raw={raw} equipment={equipment} />
      ))}
    </div>
  );
}

function SetLine({
  set,
  n,
  warm,
  unit,
  raw,
  equipment,
}: {
  set: Pending;
  n: number;
  warm: boolean;
  unit: WeightUnit;
  raw: boolean;
  equipment: WorkoutExerciseRow["exercises"]["equipment_type"];
}) {
  const [editing, setEditing] = useState(false);
  const [weight, setWeight] = useState(formatNumber(set.weight));
  const [reps, setReps] = useState(set.reps != null ? String(set.reps) : "");
  const [pending, start] = useTransition();

  const save = () =>
    start(async () => {
      try {
        await updateSet(set.id, {
          weight: weight.trim() === "" ? null : Number(weight),
          reps: reps.trim() === "" ? null : Number(reps),
          isWarmUp: warm,
        });
        setEditing(false);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not save the set");
      }
    });

  const remove = () =>
    start(async () => {
      try {
        await deleteSet(set.id);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not delete the set");
      }
    });

  if (editing) {
    return (
      <div className="flex items-center gap-2 px-3.5 py-1.5">
        <span className="tabular w-7 text-[15px] text-ink-3">{warm ? `W${n}` : n}</span>
        <input
          aria-label="Weight"
          type="number"
          inputMode="decimal"
          step="any"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          className="tabular w-20 rounded-lg bg-fill px-2 py-1 text-[17px] outline-none"
        />
        <span className="text-ink-3">×</span>
        <input
          aria-label="Reps"
          type="number"
          inputMode="numeric"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          className="tabular w-16 rounded-lg bg-fill px-2 py-1 text-[17px] outline-none"
        />
        <span className="flex-1" />
        <IconButton label="Delete set" onClick={remove} disabled={pending} className="text-red">
          <TrashIcon size={18} />
        </IconButton>
        <IconButton label="Cancel" onClick={() => setEditing(false)} disabled={pending}>
          <XIcon size={18} />
        </IconButton>
        <IconButton label="Save set" onClick={save} disabled={pending} className="text-blue">
          <CheckIcon size={18} />
        </IconButton>
      </div>
    );
  }

  const w = displayWeight(set.weight, equipment, unit);
  return (
    <div className={cn("flex h-10 items-center gap-2 px-3.5", set.pending && "opacity-50")}>
      <span className="tabular w-7 text-[15px] text-ink-3">{warm ? `W${n}` : n}</span>
      <span className="tabular flex-1 text-[17px]">
        {w || (raw ? "" : "Bodyweight")}
        {set.reps != null && (
          <>
            <span className="text-ink-3"> × </span>
            {set.reps}
          </>
        )}
      </span>
      {!set.pending && (
        <IconButton label={`Edit set ${n}`} onClick={() => setEditing(true)} className="text-ink-3">
          <PencilIcon size={16} />
        </IconButton>
      )}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={cn("grid size-8 place-items-center rounded-full active:bg-fill disabled:opacity-40", className)}
    >
      {children}
    </button>
  );
}

function QuickLogSheet({
  open,
  onClose,
  workoutExerciseId,
  initial,
  warmUps,
  name,
}: {
  open: boolean;
  onClose: () => void;
  workoutExerciseId: string;
  initial: string;
  warmUps: number | null;
  name: string;
}) {
  const [csv, setCsv] = useState(initial);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, start] = useTransition();

  // Each opening starts from what is logged now
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCsv(initial);
      setErrors([]);
    }
  }

  const save = () =>
    start(async () => {
      try {
        const res = await quickLog(workoutExerciseId, csv);
        if (res.ok) {
          setErrors([]);
          onClose();
        } else setErrors(res.errors);
      } catch (e) {
        setErrors([e instanceof Error ? e.message : "Could not save"]);
      }
    });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={name}
      leading={
        <button type="button" className="text-[17px] text-blue" onClick={onClose}>
          Cancel
        </button>
      }
      trailing={
        <button type="button" disabled={pending} onClick={save} className="text-[17px] font-semibold text-blue disabled:opacity-40">
          Save
        </button>
      }
    >
      <p className="px-4 pb-3 text-[15px] text-ink-2">
        The Notion Weight column: weights separated by commas, reps in brackets. The first{" "}
        {warmUps ? `${warmUps} ${warmUps === 1 ? "value is a warm-up" : "values are warm-ups"}` : "values are working sets (no warm-ups prescribed)"}.
        Saving replaces every set on this exercise.
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={3}
        autoFocus
        inputMode="text"
        placeholder="50, 70, 90, 100(5), 100(4)"
        className="tabular w-full resize-none rounded-[20px] bg-card px-4 py-3 text-[20px] outline-none placeholder:text-ink-3"
      />
      {errors.length > 0 && (
        <ul className="mt-3 px-4 text-[15px] text-red">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
