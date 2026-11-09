"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setExerciseFloor } from "@/app/actions";
import { ExerciseArt } from "@/components/exercise-art";
import { ChevronUpDown, EllipsisIcon, ListIcon, SfFlameFillIcon, SwapIcon } from "@/components/icons";
import { ActionMenu } from "@/components/pop-up-menu";
import { cn } from "@/lib/cn";
import type { SetRow, WorkoutExerciseRow } from "@/lib/data/queries";
import { totals, type Best, type SetRowView } from "@/lib/workout/active";
import { formatNumber } from "@/lib/workout/format";
import { FLOORS, floorKey, floorLabel, type MachineLocation } from "@/lib/workout/machine-location";
import { exerciseTitle } from "@/lib/workout/movements";
import type { Entry } from "./active-workout";

type Draft = { weight: number | null; reps: number | null };

export type JournalProps = {
  entries: Entry[];
  current: string | null;
  currentRow: number;
  unit: "lbs" | "kg";
  bests: Record<string, Best>;
  percent: number;
  pending: boolean;
  valueOf: (weId: string, i: number, row: SetRowView) => Draft;
  setDraft: (weId: string, i: number, d: Draft) => void;
  onLog: (entry: Entry, i: number) => void;
  onUnlog: (entry: Entry, set: SetRow) => void;
  onEditLogged: (set: SetRow, d: Draft) => void;
  onAddRow: (we: WorkoutExerciseRow) => void;
  onPick: (we: WorkoutExerciseRow) => void;
  onSwap: (we: WorkoutExerciseRow) => void;
  onMove: (we: WorkoutExerciseRow, to: "up" | "down" | "end") => void;
  onRemove: (we: WorkoutExerciseRow) => void;
  onFinish: () => void;
};

/**
 * The Journal (Ladder's), pulled up from the focus screen: every exercise in the workout under its name. The current
 * one is open with its best weight and estimated 1RM, the floor (on a two-floor exercise), Swap, History and More, and a
 * Log It grid of every set; the others show their sets as circles. Tapping one opens it and moves the focus screen there.
 * It shows in the card that grows from the pill (journal-card.tsx).
 */
export function JournalBody({
  entries,
  current,
  currentRow,
  unit,
  bests,
  percent,
  pending,
  valueOf,
  setDraft,
  onLog,
  onUnlog,
  onEditLogged,
  onAddRow,
  onPick,
  onSwap,
  onMove,
  onRemove,
  onFinish,
}: JournalProps) {
  // the open exercise: the one picked here, else the current one (the parent keys the Journal per opening)
  const [picked, setPicked] = useState<string | null>(null);
  const openId = picked ?? current;
  const t = totals(entries.flatMap((e) => e.we.sets));

  return (
    <>
      <p className="tabular px-1 pb-3 text-center text-[13px] text-ink-2">
        {percent}% done · {t.sets} {t.sets === 1 ? "set" : "sets"} · {formatNumber(t.volume)} {unit}
      </p>
      <div className="flex flex-col">
        {entries.map((entry, idx) =>
          entry.we.id === openId ? (
            <OpenExercise
              key={entry.we.id}
              id={entry.we.id}
              entry={entry}
              first={idx === 0}
              last={idx === entries.length - 1}
              currentRow={entry.we.id === current ? currentRow : -1}
              unit={unit}
              best={bests[floorKey(entry.we.exercises.id, entry.we.machine_location)] ?? null}
              pending={pending}
              valueOf={valueOf}
              setDraft={setDraft}
              onLog={onLog}
              onUnlog={onUnlog}
              onEditLogged={onEditLogged}
              onAddRow={onAddRow}
              onSwap={onSwap}
              onMove={onMove}
              onRemove={onRemove}
            />
          ) : (
            <button
              key={entry.we.id}
              data-we={entry.we.id}
              type="button"
              onClick={() => {
                setPicked(entry.we.id);
                onPick(entry.we);
              }}
              className="grid grid-cols-[62px_1fr] items-center gap-x-[23px] py-[17px] text-left"
            >
              <Thumb we={entry.we} />
              <span className="min-w-0">
                <span className="block truncate text-[16px] font-semibold">{exerciseTitle(entry.we.exercises)}</span>
                <Circles rows={entry.rows} />
              </span>
            </button>
          ),
        )}
      </div>
      <button type="button" onClick={onFinish} className="mt-4 h-[56px] w-full rounded-full bg-blue text-[17px] font-semibold text-white">
        Finish Workout
      </button>
    </>
  );
}

function Thumb({ we }: { we: WorkoutExerciseRow }) {
  return (
    <span className="block size-[62px] overflow-hidden rounded-[10px] bg-fill">
      <ExerciseArt slug={we.exercises.slug} art={<ListIcon size={20} className="m-auto mt-5 text-ink-3" />} pad="p-0" />
    </span>
  );
}

function Circles({ rows }: { rows: SetRowView[] }) {
  return (
    <span className="mt-2 flex flex-wrap gap-2" aria-label={`${rows.filter((r) => r.set).length} of ${rows.length} sets logged`}>
      {rows.map((r, i) => (
        <span
          key={i}
          className={cn(
            "tabular grid size-[25px] place-items-center rounded-full border-[1.5px] font-semibold",
            r.kind === "warm" ? "text-[10px]" : "text-[12px]",
            r.set ? "border-blue bg-blue text-white" : "border-ink-3 text-ink-2",
          )}
        >
          {r.kind === "warm" ? <SfFlameFillIcon size={13} /> : r.label}
        </span>
      ))}
    </span>
  );
}

function OpenExercise({
  id,
  entry,
  first,
  last,
  currentRow,
  unit,
  best,
  pending,
  valueOf,
  setDraft,
  onLog,
  onUnlog,
  onEditLogged,
  onAddRow,
  onSwap,
  onMove,
  onRemove,
}: {
  id: string;
  entry: Entry;
  first: boolean;
  last: boolean;
  currentRow: number;
  unit: "lbs" | "kg";
  best: Best | null;
  pending: boolean;
  valueOf: (weId: string, i: number, row: SetRowView) => Draft;
  setDraft: (weId: string, i: number, d: Draft) => void;
  onLog: (entry: Entry, i: number) => void;
  onUnlog: (entry: Entry, set: SetRow) => void;
  onEditLogged: (set: SetRow, d: Draft) => void;
  onAddRow: (we: WorkoutExerciseRow) => void;
  onSwap: (we: WorkoutExerciseRow) => void;
  onMove: (we: WorkoutExerciseRow, to: "up" | "down" | "end") => void;
  onRemove: (we: WorkoutExerciseRow) => void;
}) {
  const { we, rows } = entry;
  const ex = we.exercises;
  const [menu, setMenu] = useState<DOMRect | null>(null);
  const [floorPending, startFloor] = useTransition();

  return (
    <div data-we={id} className="grid grid-cols-[62px_1fr] items-center gap-x-[23px] py-[17px]">
      <Thumb we={we} />
      <span className="min-w-0">
        <span className="block truncate text-[16px] font-semibold">{exerciseTitle(ex)}</span>
        <span className="mt-0.5 block text-[15px] leading-[1.35] text-ink-2">
          Max Weight: <span className="text-ink">{best ? `${formatNumber(best.weight)} ${unit}` : "--"}</span>
          <br />
          Est. 1 Rep Max: <span className="text-ink">{best ? `${Math.round(best.e1rm)} ${unit}` : "--"}</span>
        </span>
      </span>

      <div className="col-span-2 mt-[22px] flex gap-[9px] overflow-x-auto [scrollbar-width:none]">
        {ex.has_floors && (
          <label className={cn("relative inline-flex h-[37px] shrink-0 items-center gap-1 rounded-full bg-fill px-4 text-[15px] font-medium", floorPending && "opacity-50")}>
            {floorLabel(we.machine_location) ?? "Floor"}
            <ChevronUpDown size={13} strokeWidth={2.2} />
            <select
              aria-label="Floor"
              value={we.machine_location ?? ""}
              onChange={(e) =>
                startFloor(async () => {
                  try {
                    await setExerciseFloor(we.id, e.target.value as MachineLocation);
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Could not change the floor");
                  }
                })
              }
              className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            >
              {FLOORS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
        )}
        <Chip onClick={() => onSwap(we)}>
          <SwapIcon size={15} /> Swap
        </Chip>
        <Link href={`/exercises/${ex.id}`} className="inline-flex h-[37px] shrink-0 items-center gap-1.5 rounded-full bg-fill px-4 text-[15px] font-medium">
          History
        </Link>
        <Chip label="More" onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}>
          <EllipsisIcon size={17} />
        </Chip>
      </div>

      <div className="col-span-2 mt-6 isolate grid grid-cols-[38px_66px_66px_1fr] items-center gap-x-[13px] gap-y-[17px]">
        <span className="whitespace-nowrap text-[15px] text-blue">Log It</span>
        <span className="text-center text-[15px] text-ink-2">{unit}</span>
        <span className="text-center text-[15px] text-ink-2">Reps</span>
        <span className="text-center text-[15px] text-ink-2">Last</span>
        {rows.map((row, i) => (
          <SetLine
            key={`${row.set?.id ?? "new"}-${i}`}
            row={row}
            value={row.set ? { weight: row.set.weight, reps: row.set.reps } : valueOf(we.id, i, row)}
            current={i === currentRow}
            disabled={pending}
            onToggle={() => (row.set ? onUnlog(entry, row.set) : onLog(entry, i))}
            onChange={(d) => (row.set ? onEditLogged(row.set, d) : setDraft(we.id, i, d))}
          />
        ))}
      </div>
      <button type="button" onClick={() => onAddRow(we)} className="col-span-2 mt-4 justify-self-start text-[15px] font-semibold text-blue">
        + Add Set
      </button>

      {menu && (
        <ActionMenu
          rect={menu}
          items={[
            { value: "Do Later" },
            { value: "Move Up", disabled: first },
            { value: "Move Down", disabled: last },
            { value: "Remove", destructive: true },
          ]}
          onClose={() => setMenu(null)}
          onPick={(v) => {
            if (v === "Do Later") onMove(we, "end");
            else if (v === "Move Up") onMove(we, "up");
            else if (v === "Move Down") onMove(we, "down");
            else if (v === "Remove") onRemove(we);
          }}
        />
      )}
    </div>
  );
}

function Chip({ label, onClick, children }: { label?: string; onClick: (e: React.MouseEvent<HTMLButtonElement>) => void; children: React.ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className="inline-flex h-[37px] shrink-0 items-center gap-1.5 rounded-full bg-fill px-4 text-[15px] font-medium">
      {children}
    </button>
  );
}

/** One set in the grid: the Log It circle (tap to log, tap again to undo), weight, reps and last time. */
function SetLine({
  row,
  value,
  current,
  disabled,
  onToggle,
  onChange,
}: {
  row: SetRowView;
  value: Draft;
  current: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChange: (d: Draft) => void;
}) {
  const [w, setW] = useState<string | null>(null);
  const [r, setR] = useState<string | null>(null);
  const num = (s: string) => (s.trim() === "" ? null : Number.isFinite(Number(s)) ? Number(s) : null);
  const cell = cn(
    "tabular h-[41px] w-[66px] rounded-[10px] border-[1.5px] border-sep bg-transparent p-0 text-center text-[17px] font-semibold outline-none focus:border-blue placeholder:text-ink-3",
    row.set && "text-blue",
  );
  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onToggle}
        aria-label={row.set ? `Undo set ${row.label}` : `Log set ${row.label}`}
        className={cn(
          "tabular relative grid size-[29px] place-items-center justify-self-center rounded-full border-[1.5px] text-[14px] font-semibold",
          current ? "border-blue" : "border-ink",
          row.set && "border-blue bg-blue text-white",
        )}
      >
        {/* The current set's row is tinted blue across the card, as Ladder highlights it in its accent (Frank's call,
            2026-11-09): 15% blue, from the card's left edge to its right, 58pt tall (the 41pt row and half the gap each side). Behind the
            cells (the grid isolates), clipped by the card body. */}
        {current && (
          <span aria-hidden className="pointer-events-none absolute -bottom-[15.5px] -left-[21.5px] -top-[15.5px] -z-10 w-screen bg-blue/15" />
        )}
        {row.set ? "✓" : row.kind === "warm" ? <SfFlameFillIcon size={15} /> : row.label}
      </button>
      <input
        data-live
        inputMode="decimal"
        aria-label="Weight"
        value={w ?? formatNumber(value.weight)}
        placeholder="--"
        onChange={(e) => setW(e.target.value)}
        onBlur={() => {
          if (w != null && num(w) !== value.weight) onChange({ ...value, weight: num(w) });
          setW(null);
        }}
        className={cell}
      />
      <input
        data-live
        inputMode="numeric"
        aria-label="Reps"
        value={r ?? (value.reps != null ? String(value.reps) : "")}
        placeholder="--"
        onChange={(e) => setR(e.target.value)}
        onBlur={() => {
          if (r != null && num(r) !== value.reps) onChange({ ...value, reps: num(r) == null ? null : Math.round(num(r)!) });
          setR(null);
        }}
        className={cell}
      />
      <span className="tabular whitespace-nowrap text-center text-[14px] text-ink-2">{row.last ? `${formatNumber(row.last.weight) || "–"} × ${row.last.reps ?? "–"}` : "--"}</span>
    </>
  );
}
