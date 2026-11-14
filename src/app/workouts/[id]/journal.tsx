"use client";

import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { setExerciseFloor } from "@/app/actions";
import { Button } from "@/components/button";
import { ExerciseArt } from "@/components/exercise-art";
import { CheckIcon, ChevronUpDown, ListIcon, SfFlameFillIcon, SwapIcon } from "@/components/icons";
import { SfSymbol } from "@/components/sf-symbol";
import { Sheet } from "@/components/sheet";
import { SwipeRow } from "@/components/swipe-row";
import { cn } from "@/lib/cn";
import type { SetRow, WorkoutExerciseRow } from "@/lib/data/queries";
import { valuesOf, type Best, type SetRowView } from "@/lib/workout/active";
import { formatNumber } from "@/lib/workout/format";
import { FIELDS, fieldLabel, formatField, measureOf, parseField, summarizeShort, type Field, type SetValues } from "@/lib/workout/measure";
import { FLOORS, floorKey, floorLabel, type MachineLocation } from "@/lib/workout/machine-location";
import { exerciseTitle } from "@/lib/workout/movements";
import type { Entry } from "./active-workout";

type Draft = SetValues;

export type JournalProps = {
  entries: Entry[];
  current: string | null;
  currentRow: number;
  unit: "lbs" | "kg";
  bests: Record<string, Best>;
  pending: boolean;
  valueOf: (weId: string, i: number, row: SetRowView) => Draft;
  setDraft: (weId: string, i: number, d: Draft) => void;
  onLog: (entry: Entry, i: number) => void;
  onUnlog: (entry: Entry, set: SetRow) => void;
  onEditLogged: (set: SetRow, d: Draft) => void;
  onAddRow: (we: WorkoutExerciseRow) => void;
  /** Swipe to delete a set row (src/lib/workout/row-delete.ts) */
  onDeleteRow: (entry: Entry, i: number) => void;
  onPick: (we: WorkoutExerciseRow) => void;
  onSwap: (we: WorkoutExerciseRow) => void;
  /** History: the exercise's sheet on its History tab, without leaving the workout */
  onHistory: (we: WorkoutExerciseRow) => void;
  onFinish: () => void;
  /** the cards open when the Journal comes back after a sheet opened from it was cancelled */
  initialOpenIds?: ReadonlySet<string>;
  /** told which cards are open, so a reopened Journal can show the same */
  onOpenIdsChange?: (ids: ReadonlySet<string>) => void;
};

/**
 * The Journal (Ladder's), pulled up from the focus screen: every exercise in the workout as a card (`ExerciseCard`). The
 * current one starts open with its best weight and estimated 1RM, Swap, History and Edit Sets, and a Log It grid of every
 * set (the floor, on a two-floor exercise, in the Last column's heading); the others start closed, their sets as circles. Tapping a card's header opens or
 * closes it; opening one also moves the focus screen there.
 * Version 1 shows it in the card that grows from the pill (journal-card.tsx); Version 2, with no pill, in a sheet.
 */
export function Journal({ open, onClose, title, ...props }: JournalProps & { open: boolean; onClose: () => void; title: string }) {
  return (
    <Sheet open={open} onClose={onClose} title={title}>
      <JournalBody {...props} />
    </Sheet>
  );
}

export function JournalBody({
  entries,
  current,
  currentRow,
  unit,
  bests,
  pending,
  valueOf,
  setDraft,
  onLog,
  onUnlog,
  onEditLogged,
  onAddRow,
  onDeleteRow,
  onPick,
  onSwap,
  onHistory,
  onFinish,
  initialOpenIds,
  onOpenIdsChange,
}: JournalProps) {
  // Which card is open: the current exercise to start with (the parent keys the Journal per opening), or the card that
  // was open when a sheet opened from it was cancelled. One at a time (Frank's call, 2026-11-13, replacing any number
  // open from 2026-11-10): opening a card closes the other, and a tap on the open one closes it.
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(() => initialOpenIds ?? new Set(current ? [current] : []));
  useEffect(() => {
    onOpenIdsChange?.(openIds);
  }, [openIds, onOpenIdsChange]);
  const toggle = (we: WorkoutExerciseRow) => {
    if (openIds.has(we.id)) {
      setOpenIds(new Set());
      return;
    }
    setOpenIds(new Set([we.id]));
    // outside the state update, so the workout screen is not told while the Journal renders
    onPick(we);
  };

  return (
    <>
      {/* Ladder's stack: a card per exercise, 4pt apart (measured off Ladder, Figma ZD41TUAEBtLJI7t0qChNup 11:706) */}
      <div className="flex flex-col gap-1">
        {entries.map((entry) => (
          <ExerciseCard
            key={entry.we.id}
            id={entry.we.id}
            entry={entry}
            open={openIds.has(entry.we.id)}
            onToggle={() => toggle(entry.we)}
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
            onDeleteRow={onDeleteRow}
            onSwap={onSwap}
            onHistory={onHistory}
          />
        ))}
      </div>
      {/* the app's filled button, 20pt from the screen's sides as Start Workout is (8pt of the Journal's padding and 12pt) */}
      <Button variant="filled" onClick={onFinish} className="mx-3 mt-4 w-[calc(100%-24px)]">
        Complete Workout
      </Button>
    </>
  );
}

function Thumb({ we }: { we: WorkoutExerciseRow }) {
  return (
    <span className="block size-[58px] overflow-hidden rounded-[10px] bg-fill">
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

/**
 * One exercise as Ladder's card (measured off Ladder at 375pt: 20pt corners, 14pt top, a 58pt thumbnail with
 * the title 20pt from it, 36pt chips 8pt apart and 26pt under the thumbnail, a 56pt band on the current set; 16pt sides,
 * Frank's call, 2026-11-12, from the Journal Pill Lab). The card is
 * the elevated step above the Journal (`bg-card`: #2c2c2e on the dark Journal, #f2f2f7 on the light), its chips and cells
 * a step above that (`bg-fill`). The header (thumbnail and title) opens and closes it; closed, the title has the sets as
 * circles under it, open, the best weight and estimated 1RM, then the chips and the Log It grid, whose height animates.
 * The chips are Swap, History and Edit Sets (Frank's row from the Journal Card Lab, 2026-11-13,
 * https://claude.ai/artifact/Fm4BQbQ1kkuxkffbexcpxT). Edit Sets is Ladder's edit mode: the chip becomes a filled Done
 * Editing, each set's Log It circle a red minus that deletes it, and an Add Set row closes the grid. There is no More:
 * Swap stands in for removing an exercise, and Do After is in the workout's More menu.
 */
function ExerciseCard({
  id,
  entry,
  open,
  onToggle,
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
  onDeleteRow,
  onSwap,
  onHistory,
}: {
  id: string;
  entry: Entry;
  open: boolean;
  onToggle: () => void;
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
  onDeleteRow: (entry: Entry, i: number) => void;
  onSwap: (we: WorkoutExerciseRow) => void;
  onHistory: (we: WorkoutExerciseRow) => void;
}) {
  const { we, rows } = entry;
  const ex = we.exercises;
  const measure = measureOf(ex);
  const fields = FIELDS[measure];
  // circle, one cell per field (narrower for a treadmill's three), then last time
  const cellWidth = fields.length > 2 ? 58 : 66;
  // Edit Sets: on until Done Editing, and off whenever the card closes
  const [editingOn, setEditing] = useState(false);
  const editing = editingOn && open;
  const [floorPending, startFloor] = useTransition();
  const columns = `38px ${fields.map(() => `${cellWidth}px`).join(" ")} 1fr`;
  // bumped on every delete so the rows remount: the collapsed row never comes back as the row after it
  const [deletes, setDeletes] = useState(0);

  return (
    <div data-we={id} className="overflow-hidden rounded-[20px] bg-card">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="grid w-full grid-cols-[58px_1fr] items-center gap-x-5 px-4 pb-[14px] pt-[14px] text-left"
      >
        <Thumb we={we} />
        <span className="min-w-0">
          <span className="block truncate text-[17px] font-semibold leading-[22px] tracking-[-0.43px]">{exerciseTitle(ex)}</span>
          {open ? (
            <span className="mt-0.5 block text-[15px] leading-[1.35] text-ink-2">
              Max Weight: <span className="text-ink">{best ? `${formatNumber(best.weight)} ${unit}` : "--"}</span>
              <br />
              Est. 1 Rep Max: <span className="text-ink">{best ? `${Math.round(best.e1rm)} ${unit}` : "--"}</span>
            </span>
          ) : (
            <Circles rows={rows} />
          )}
        </span>
      </button>

      {/* the body's height animates open and closed (grid rows from 0fr to 1fr); closed, it is inert */}
      <div className={cn("grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
      <div className="min-h-0 overflow-hidden" inert={!open}>
      <div className="grid grid-cols-[58px_1fr] gap-x-5 px-4 pb-[14px]">
      {/* one line that scrolls sideways when it outgrows the card */}
      <div className="col-span-2 -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none]">
        <Chip onClick={() => onSwap(we)}>
          <SwapIcon size={15} /> Swap
        </Chip>
        <Chip onClick={() => onHistory(we)}>
          <SfSymbol name="clock.arrow.circlepath" scale={CHIP_SYMBOL} /> History
        </Chip>
        {editing ? (
          <Chip onClick={() => setEditing(false)} className="bg-blue text-white">
            <SfSymbol name="checkmark.circle.fill" scale={CHIP_SYMBOL} /> Done Editing
          </Chip>
        ) : (
          <Chip onClick={() => setEditing(true)}>
            <SfSymbol name="pencil" scale={CHIP_SYMBOL} /> Edit Sets
          </Chip>
        )}
      </div>

      {/* The Log It grid: the header, then each set as its own row with swipe to delete, full width so the row and its
          Delete run edge to edge of the card. Each row is 56pt (the 41pt cells and half the old 15pt gap each side), so the
          spacing is unchanged. */}
      <div className="col-span-2 mt-6">
        <div className="grid items-center gap-x-[13px]" style={{ gridTemplateColumns: columns }}>
          <span role="columnheader" aria-label="Log it" className="flex justify-center text-ink-2">
            <CheckIcon size={15} strokeWidth={2.4} />
          </span>
          {fields.map((f) => (
            <span key={f} className="text-center text-[15px] text-ink-2">
              {fieldLabel(f, measure, unit)}
            </span>
          ))}
          {/* On a two-floor exercise the Last heading is the floor's pop-up button: the floor decides which last time the
              column shows and which weights fill in (Frank's pick from the Journal Card Lab, 2026-11-13). The value and
              chevrons are painted, a transparent select over them takes the tap. */}
          {ex.has_floors ? (
            <label className={cn("relative inline-flex items-center justify-center gap-0.5 justify-self-center whitespace-nowrap text-[13px] font-semibold text-blue", floorPending && "opacity-50")}>
              {floorLabel(we.machine_location) ?? "Floor"}
              <ChevronUpDown size={12} strokeWidth={2.2} />
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
          ) : (
            <span className="text-center text-[15px] text-ink-2">Last</span>
          )}
        </div>
        <div className="-mx-4 mt-[7.5px]">
          {rows.map((row, i) => {
            const deletable = !pending && rows.length > 1 && !row.set?.id.startsWith("pending-");
            const del = () => {
              onDeleteRow(entry, i);
              setDeletes((n) => n + 1);
            };
            return (
              <SwipeRow
                key={`${row.set?.id ?? "new"}-${i}-${deletes}`}
                disabled={editing || !deletable}
                label="Delete"
                contentClassName="bg-card"
                onDelete={del}
              >
                <SetLine
                  row={row}
                  fields={fields}
                  columns={columns}
                  width={cellWidth}
                  last={row.last ? summarizeShort(measure, row.last) : "--"}
                  value={row.set ? valuesOf(row.set) : valueOf(we.id, i, row)}
                  current={!editing && i === currentRow}
                  disabled={pending}
                  onToggle={() => (row.set ? onUnlog(entry, row.set) : onLog(entry, i))}
                  onChange={(d) => (row.set ? onEditLogged(row.set, d) : setDraft(we.id, i, d))}
                  onDelete={editing ? (deletable ? del : null) : undefined}
                />
              </SwipeRow>
            );
          })}
          {editing && (
            <button
              type="button"
              onClick={() => onAddRow(we)}
              className="grid h-[56px] w-full items-center gap-x-[13px] px-4 text-left text-[17px]"
              style={{ gridTemplateColumns: "38px 1fr" }}
            >
              <span className="grid size-[29px] place-items-center justify-self-center rounded-full border-[1.5px] border-ink">
                <SfSymbol name="plus" scale={CHIP_SYMBOL} />
              </span>
              Add Set
            </button>
          )}
        </div>
      </div>
      </div>
      </div>
      </div>

    </div>
  );
}

/** Symbols are rendered at 19pt (scripts/sf-symbols.js); a chip draws them at its 15pt label size */
const CHIP_SYMBOL = 15 / 19;

function Chip({ onClick, className, children }: { onClick: () => void; className?: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={cn("inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-fill px-4 text-[15px] font-medium", className)}>
      {children}
    </button>
  );
}

/**
 * One set in the grid: the Log It circle (tap to log, tap again to undo), a cell per field and last time. In Edit Sets
 * (`onDelete` given) the circle is a red minus that deletes the set, or empty when the set cannot go (the last one left).
 */
function SetLine({
  row,
  fields,
  columns,
  width,
  last,
  value,
  current,
  disabled,
  onToggle,
  onChange,
  onDelete,
}: {
  row: SetRowView;
  fields: readonly Field[];
  columns: string;
  width: number;
  last: string;
  value: Draft;
  current: boolean;
  disabled: boolean;
  onToggle: () => void;
  onChange: (d: Draft) => void;
  /** Edit Sets: null when this set cannot be deleted; undefined when not editing */
  onDelete?: (() => void) | null;
}) {
  const cell = cn(
    "tabular h-[41px] rounded-[10px] border-[1.5px] border-sep bg-transparent p-0 text-center text-[17px] font-semibold outline-none focus:border-blue placeholder:text-ink-3",
    row.set && "text-blue",
  );
  return (
    <div className="relative grid h-[56px] items-center gap-x-[13px] px-4" style={{ gridTemplateColumns: columns }}>
      {/* The current set's row is tinted blue across the card, as Ladder highlights it in its accent (Frank's call,
          2026-11-09): 15% blue over the row's own card colour, 56pt tall as Ladder's, sliding with the row. */}
      {current && <span aria-hidden className="pointer-events-none absolute inset-0 bg-blue/15" />}
      {onDelete !== undefined ? (
        onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Delete set ${row.label}`}
            className="relative grid size-[29px] place-items-center justify-self-center rounded-full bg-red text-white"
          >
            <SfSymbol name="minus" scale={CHIP_SYMBOL} />
          </button>
        ) : (
          <span />
        )
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={onToggle}
          aria-label={row.set ? `Undo set ${row.label}` : `Log set ${row.label}`}
          className={cn(
            "tabular relative grid size-[29px] place-items-center justify-self-center rounded-full border-[1.5px] text-[14px] font-semibold",
            "border-ink",
            row.set && "border-blue bg-blue text-white",
          )}
        >
          {row.set ? "✓" : row.kind === "warm" ? <SfFlameFillIcon size={15} /> : row.label}
        </button>
      )}
      {fields.map((f) => (
        <FieldCell key={f} field={f} value={value[f]} width={width} className={cn(cell, "relative")} onCommit={(v) => onChange({ ...value, [f]: v })} />
      ))}
      <span className="tabular relative truncate whitespace-nowrap text-center text-[14px] text-ink-2">{last}</span>
    </div>
  );
}

function FieldCell({
  field,
  value,
  width,
  className,
  onCommit,
}: {
  field: Field;
  value: number | null;
  width: number;
  className: string;
  onCommit: (v: number | null) => void;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <input
      data-live
      inputMode={field === "seconds" ? "text" : field === "reps" ? "numeric" : "decimal"}
      aria-label={field === "seconds" ? "Time" : field[0].toUpperCase() + field.slice(1)}
      value={text ?? formatField(field, value)}
      placeholder="--"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text != null) {
          const v = parseField(field, text);
          if (v !== undefined && v !== value) onCommit(v);
        }
        setText(null);
      }}
      className={className}
      style={{ width }}
    />
  );
}
