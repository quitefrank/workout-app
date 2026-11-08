"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { toast } from "sonner";
import {
  deleteSet,
  discardWorkout,
  logSet,
  moveWorkoutExercise,
  removeWorkoutExercise,
  updateSet,
} from "@/app/actions";
import { Button } from "@/components/button";
import { hasExerciseImage } from "@/components/exercise-art";
import { GlassCircleButton } from "@/components/glass";
import {
  CheckIcon,
  EllipsisIcon,
  ListIcon,
  SkipIcon,
  SwapIcon,
} from "@/components/icons";
import { ActionMenu } from "@/components/pop-up-menu";
import { Sheet } from "@/components/sheet";
import { TopBar } from "@/components/top-bar";
import { useElapsed } from "@/components/tab-bar";
import { cn } from "@/lib/cn";
import type {
  Settings,
  SetRow,
  WorkoutDetail,
  WorkoutExerciseRow,
} from "@/lib/data/queries";
import {
  buildRows,
  isDone,
  nextRow,
  progress,
  rowLabel,
  type SetRowView,
} from "@/lib/workout/active";
import { formatClock, formatNumber } from "@/lib/workout/format";
import { floorKey } from "@/lib/workout/machine-location";
import { exerciseTitle } from "@/lib/workout/movements";
import { FinishSheet } from "./finish-sheet";
import { Journal } from "./journal";
import { useRestTimer } from "./rest-timer";
import { Stepper } from "./stepper";
import { SwapSheet } from "./swap-sheet";

/**
 * The active workout, aligned with Ladder (Frank's call, 2026-11-08; prototype in the Workout App Teardown,
 * https://claude.ai/artifact/XKi4yGQMMGzJAbWqUQE37v). One screen per set on a dark stage: the exercise, its set circles
 * and what is up next, the illustration, last time, and weight and reps on iOS steppers. A toolbar holds the Journal,
 * the Glass Prominent log button in the middle, and Swap. Swipe sideways to look through the exercises, swipe up for the
 * Journal. Logging a working set starts rest, which takes over the steppers as an arc, and the log button becomes Skip.
 */

export type Entry = { we: WorkoutExerciseRow; rows: SetRowView[] };
type Draft = { weight: number | null; reps: number | null };
type Optimistic = { weId: string; add?: SetRow; remove?: string };

export function ActiveWorkout({
  workout,
  settings,
}: {
  workout: WorkoutDetail;
  settings: Settings;
}) {
  const router = useRouter();
  const unit = settings.weight_unit;
  const elapsed = useElapsed(workout.started_at);
  const timer = useRestTimer(workout.id);
  const [pending, start] = useTransition();

  const [exercises, apply] = useOptimistic(
    workout.exercises,
    (cur, o: Optimistic) =>
      cur.map((we) =>
        we.id !== o.weId
          ? we
          : {
              ...we,
              sets: o.add
                ? [...we.sets, o.add]
                : we.sets.filter((s) => s.id !== o.remove),
            },
      ),
  );
  // rows added with + Add Set in the Journal, until they are logged
  const [extra, setExtra] = useState<Record<string, number>>({});
  const entries: Entry[] = useMemo(
    () =>
      exercises.map((we) => {
        const rows = buildRows(
          we,
          workout.lastTime[floorKey(we.exercises.id, we.machine_location)] ??
            null,
        );
        const more = extra[we.id] ?? 0;
        const lastWork = [...rows].reverse().find((r) => r.kind !== "warm");
        let n = rows.filter((r) => r.kind === "work").length;
        for (let i = 0; i < more; i++)
          rows.push({
            kind: "work",
            label: String(++n),
            set: null,
            last: null,
            weight: lastWork?.weight ?? null,
            reps: lastWork?.reps ?? null,
          });
        return { we, rows };
      }),
    [exercises, workout.lastTime, extra],
  );

  // What the focus screen shows: an exercise swiped to, else the one picked in the Journal, else the first not done
  const [pinned, setPinned] = useState<string | null>(null);
  const [viewId, setViewId] = useState<string | null>(null);
  const [anim, setAnim] = useState<"l" | "r" | null>(null);
  const pinnedEntry = pinned
    ? entries.find((e) => e.we.id === pinned && !isDone(e.rows))
    : undefined;
  const queue = pinnedEntry ?? entries.find((e) => !isDone(e.rows)) ?? null;
  const viewed = viewId
    ? (entries.find((e) => e.we.id === viewId) ?? null)
    : null;
  const viewing = !!viewed && viewed.we.id !== queue?.we.id;
  const shown = viewing ? viewed : queue;
  const shownIndex = shown ? entries.indexOf(shown) : -1;
  const rowIndex = shown ? nextRow(shown.rows) : -1;
  const resting = timer.endsAt != null && !viewing;
  const prog = progress(entries.map((e) => e.rows));

  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const valueOf = (weId: string, i: number, row: SetRowView): Draft =>
    drafts[`${weId}:${i}`] ?? { weight: row.weight, reps: row.reps };
  const setDraft = (weId: string, i: number, d: Draft) =>
    setDrafts((cur) => ({ ...cur, [`${weId}:${i}`]: d }));

  const run = useCallback(
    (fn: () => Promise<void>, failMessage: string) =>
      start(async () => {
        try {
          await fn();
        } catch (e) {
          if (e instanceof Error && e.message.includes("NEXT_REDIRECT"))
            throw e;
          toast.error(e instanceof Error ? e.message : failMessage);
        }
      }),
    [],
  );

  const log = (entry: Entry, i: number) => {
    const row = entry.rows[i];
    if (!row || row.set) return;
    const v = valueOf(entry.we.id, i, row);
    const prescribed =
      entry.we.prescribed_sets_max ??
      entry.we.prescribed_sets_min ??
      entry.we.prescribed_reps_max ??
      entry.we.warm_up_sets_max;
    if (v.weight == null && v.reps == null && prescribed != null) {
      toast.error("Set a weight or reps first.");
      return;
    }
    const isWarmUp = row.kind === "warm";
    const setNumber =
      Math.max(0, ...entry.we.sets.map((s) => s.set_number)) + 1;
    run(async () => {
      apply({
        weId: entry.we.id,
        add: {
          id: `pending-${Date.now()}`,
          set_number: setNumber,
          is_warm_up: isWarmUp,
          is_drop_set: false,
          weight: v.weight,
          reps: v.reps,
          seconds: null,
          rpe: null,
          notes: null,
          completed_at: new Date().toISOString(),
        },
      });
      await logSet(entry.we.id, {
        weight: v.weight,
        reps: v.reps,
        isWarmUp,
        isDropSet: false,
        allowEmpty: true,
      });
      if (i >= entry.rows.length - (extra[entry.we.id] ?? 0))
        setExtra((cur) => ({
          ...cur,
          [entry.we.id]: Math.max(0, (cur[entry.we.id] ?? 0) - 1),
        }));
    }, "Could not log the set");
    if (viewing) {
      setPinned(entry.we.id);
      setViewId(null);
    }
    if (!isWarmUp)
      timer.start(
        entry.we.prescribed_rest_seconds ?? settings.default_rest_seconds,
      );
  };

  const unlog = (entry: Entry, set: SetRow) =>
    run(async () => {
      apply({ weId: entry.we.id, remove: set.id });
      await deleteSet(set.id);
    }, "Could not undo the set");

  const editLogged = (set: SetRow, d: Draft) =>
    run(
      () =>
        updateSet(set.id, {
          weight: d.weight,
          reps: d.reps,
          isWarmUp: set.is_warm_up,
          isDropSet: set.is_drop_set,
          allowEmpty: true,
        }),
      "Could not save the set",
    );

  // Swiping between exercises, and up for the Journal
  const swipe = (dir: 1 | -1) => {
    if (shownIndex < 0 && entries.length === 0) return;
    const from = shownIndex < 0 ? entries.length - 1 : shownIndex;
    const to = Math.max(0, Math.min(entries.length - 1, from + dir));
    if (to === from) return;
    setViewId(entries[to].we.id === queue?.we.id ? null : entries[to].we.id);
    setAnim(dir > 0 ? "l" : "r");
  };
  const gesture = useRef<{ x: number; y: number } | null>(null);
  const swallow = useRef(0);
  const onPointerDown = (e: ReactPointerEvent) => {
    if ((e.target as HTMLElement).closest("input")) return;
    gesture.current = { x: e.clientX, y: e.clientY };
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    const g = gesture.current;
    gesture.current = null;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipe(dx < 0 ? 1 : -1);
      swallow.current = e.timeStamp;
    } else if (dy < -55 && Math.abs(dy) > Math.abs(dx) * 1.2) {
      openJournal();
      swallow.current = e.timeStamp;
    }
  };

  // each opening gets a fresh Journal and swap sheet (their own state resets with the key)
  const [journal, setJournal] = useState(false);
  const [journalKey, setJournalKey] = useState(0);
  const openJournal = () => {
    setJournalKey((k) => k + 1);
    setJournal(true);
  };
  const [swapFor, setSwapForState] = useState<WorkoutExerciseRow | null>(null);
  const [swapKey, setSwapKey] = useState(0);
  const setSwapFor = (we: WorkoutExerciseRow | null) => {
    if (we) setSwapKey((k) => k + 1);
    setSwapForState(we);
  };
  const [finishing, setFinishing] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [menu, setMenu] = useState<DOMRect | null>(null);

  const move = (we: WorkoutExerciseRow, to: "up" | "down" | "end") => {
    if (pinned === we.id) setPinned(null);
    if (viewId === we.id) setViewId(null);
    run(() => moveWorkoutExercise(we.id, to), "Could not move the exercise");
    if (to === "end") toast(`${exerciseTitle(we.exercises)} moved to the end`);
  };
  const remove = (we: WorkoutExerciseRow) => {
    if (pinned === we.id) setPinned(null);
    if (viewId === we.id) setViewId(null);
    run(() => removeWorkoutExercise(we.id), "Could not remove the exercise");
  };

  const upNext = shownIndex >= 0 ? entries[shownIndex + 1] : undefined;
  const ex = shown?.we.exercises;
  const row = shown && rowIndex >= 0 ? shown.rows[rowIndex] : null;
  const value = shown && row ? valueOf(shown.we.id, rowIndex, row) : null;

  return (
    <>
      <TopBar
        edge="dim"
        spacer={false}
        leading={
          <span className="tabular whitespace-nowrap text-[28px] font-extrabold tracking-[-0.03em] text-white">
            {elapsed == null ? "0:00" : formatClock(elapsed)} · {prog.percent}%
          </span>
        }
        trailing={
          <GlassCircleButton
            label="Workout options"
            onClick={(e) => setMenu(e.currentTarget.getBoundingClientRect())}
          >
            <EllipsisIcon size={20} />
          </GlassCircleButton>
        }
      />

      {/* Full screen and never scrolling, painted with the page; only the number fields are live, while in use */}
      <div
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (gesture.current = null)}
        onClickCapture={(e) => {
          if (e.timeStamp - swallow.current < 250) {
            e.preventDefault();
            e.stopPropagation();
          }
        }}
        className="fixed inset-0 touch-none select-none overflow-hidden bg-[#0b0b0d] text-white"
      >
        <main
          className="relative flex h-full flex-col"
          style={{
            paddingTop: "calc(var(--bar-top) + 44px)",
            paddingBottom: "calc(var(--dock-bottom) + 72px + 20px)",
          }}
        >
          <Stage slug={ex?.slug} />

          {/* Exercises as segments: the current one taller and blue; tap one to look at it */}
          <div
            className="relative z-[1] flex gap-1 px-5 pt-1"
            role="tablist"
            aria-label="Exercises"
          >
            {entries.map((e) => {
              const done = e.rows.filter((r) => r.set).length;
              const on = shown?.we.id === e.we.id;
              return (
                <button
                  key={e.we.id}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  aria-label={exerciseTitle(e.we.exercises)}
                  onClick={() => {
                    setViewId(e.we.id === queue?.we.id ? null : e.we.id);
                    setAnim(entries.indexOf(e) > shownIndex ? "l" : "r");
                  }}
                  className="min-w-0 py-2"
                  style={{ flex: e.rows.length }}
                >
                  <span
                    className={cn(
                      "relative block overflow-hidden rounded-full",
                      on ? "h-1.5 bg-blue/35" : "h-1 bg-white/25",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full",
                        on ? "bg-blue" : "bg-white",
                      )}
                      style={{ width: `${(100 * done) / e.rows.length}%` }}
                    />
                  </span>
                </button>
              );
            })}
          </div>

          {shown ? (
            <div
              key={shown.we.id}
              className={cn(
                "relative z-[1] flex min-h-0 flex-1 flex-col",
                anim === "l" && "focus-slide-l",
                anim === "r" && "focus-slide-r",
              )}
              onAnimationEnd={() => setAnim(null)}
            >
              <header
                className="px-5 pt-3 [text-shadow:0_1px_12px_rgb(0_0_0/0.5)]"
                aria-label={row ? rowLabel(shown.rows, rowIndex) : undefined}
              >
                {resting && row ? (
                  <>
                    <div className="text-[15px] font-bold text-blue">
                      Next · {rowLabel(shown.rows, rowIndex)}
                    </div>
                    <h1 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em]">
                      {exerciseTitle(shown.we.exercises)}
                    </h1>
                    {value && (value.weight != null || value.reps != null) && (
                      <div className="tabular mt-1 text-[14px] text-white/65">
                        {formatNumber(value.weight) || "–"} {unit} ×{" "}
                        {value.reps ?? "–"}
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <h1 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em]">
                      {exerciseTitle(shown.we.exercises)}
                    </h1>
                    <SetDots
                      rows={shown.rows}
                      current={rowIndex}
                      className="mt-2"
                    />
                    <div className="mt-1 text-[14px] text-white/65">
                      {upNext
                        ? `Up next · ${exerciseTitle(upNext.we.exercises)}`
                        : "Last exercise"}
                    </div>
                  </>
                )}
              </header>
              {timer.endsAt != null && viewing && (
                <button
                  type="button"
                  onClick={() => setViewId(null)}
                  className="tabular absolute right-4 top-3 z-[2] h-[30px] rounded-full bg-blue px-3 text-[13px] font-semibold text-white"
                >
                  Rest {formatClock(timer.remaining)}
                </button>
              )}

              <Art slug={ex?.slug} large />

              {resting ? (
                <RestArc
                  remaining={timer.remaining}
                  total={timer.total}
                  onAdd={timer.add}
                />
              ) : row && value ? (
                <div className="px-5">
                  <p className="pb-3 text-center text-[15px] text-white/65 [text-shadow:0_1px_8px_rgb(0_0_0/0.8)]">
                    {row.last
                      ? `Last time · ${formatNumber(row.last.weight) || "–"} ${unit} × ${row.last.reps ?? "–"}`
                      : "No history yet"}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <Stepper
                      label={unit}
                      field="weight"
                      unit={unit}
                      value={value.weight}
                      onChange={(w) =>
                        setDraft(shown.we.id, rowIndex, { ...value, weight: w })
                      }
                    />
                    <Stepper
                      label="Reps"
                      field="reps"
                      unit={unit}
                      value={value.reps}
                      onChange={(r) =>
                        setDraft(shown.we.id, rowIndex, { ...value, reps: r })
                      }
                    />
                  </div>
                </div>
              ) : (
                <p className="px-5 pb-4 text-center text-[15px] text-white/65">
                  {shown.rows.length} of {shown.rows.length} logged. Swipe for
                  the next exercise.
                </p>
              )}
            </div>
          ) : (
            <div className="relative z-[1] flex flex-1 flex-col justify-end gap-4 px-5 pb-2">
              <div>
                <div className="text-[15px] font-bold text-blue">
                  Every set logged
                </div>
                <h1 className="text-[28px] font-extrabold leading-[1.08] tracking-[-0.02em]">
                  {workout.templates?.name ?? "Workout"}
                </h1>
              </div>
              <Button variant="filled" onClick={() => setFinishing(true)}>
                Finish Workout
              </Button>
            </div>
          )}
        </main>
      </div>

      {/* The toolbar: Journal, the log button in the middle (Skip during rest), Swap */}
      <div
        data-glass-unit="dock"
        data-edge="dim"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[640px] items-center justify-between px-[38px]"
        style={{ paddingBottom: "var(--dock-bottom)" }}
      >
        <button
          type="button"
          aria-label="Journal"
          onClick={openJournal}
          className="glass pointer-events-auto grid size-14 shrink-0 content-center justify-items-center gap-0.5"
        >
          <ListIcon size={20} />
          <span className="tabular text-[10px] font-semibold opacity-75">
            {shown && rowIndex >= 0
              ? `${rowIndex + 1} of ${shown.rows.length}`
              : "All"}
          </span>
        </button>
        <button
          type="button"
          data-glass-skip
          aria-label={
            resting ? "Skip rest" : !shown ? "Finish workout" : "Log set"
          }
          disabled={pending || (!resting && !!shown && rowIndex < 0)}
          onClick={() =>
            resting
              ? timer.stop()
              : !shown
                ? setFinishing(true)
                : log(shown, rowIndex)
          }
          className="glass glass-prominent pointer-events-auto relative grid size-[72px] shrink-0 place-items-center transition-transform active:scale-[1.06] disabled:opacity-50"
        >
          {resting ? (
            <SkipIcon size={26} />
          ) : (
            <CheckIcon size={30} strokeWidth={2.6} />
          )}
        </button>
        <button
          type="button"
          aria-label="Swap exercise"
          disabled={!shown}
          onClick={() => shown && setSwapFor(shown.we)}
          className="glass pointer-events-auto grid size-14 shrink-0 content-center justify-items-center gap-0.5 disabled:opacity-40"
        >
          <SwapIcon size={20} />
          <span className="text-[10px] font-semibold opacity-75">Swap</span>
        </button>
      </div>

      {menu && (
        <ActionMenu
          rect={menu}
          items={[
            ...(shown
              ? [{ value: "Swap Exercise" }, { value: "Do Later" }]
              : []),
            { value: "Journal" },
            { value: "Back to Home" },
            { value: "Finish Workout" },
            { value: "Discard Workout", destructive: true },
          ]}
          onClose={() => setMenu(null)}
          onPick={(v) => {
            if (v === "Swap Exercise" && shown) setSwapFor(shown.we);
            else if (v === "Do Later" && shown) move(shown.we, "end");
            else if (v === "Journal") openJournal();
            else if (v === "Back to Home") router.push("/");
            else if (v === "Finish Workout") setFinishing(true);
            else if (v === "Discard Workout") setConfirmDiscard(true);
          }}
        />
      )}

      <Journal
        key={`journal-${journalKey}`}
        open={journal}
        onClose={() => setJournal(false)}
        title={workout.templates?.name ?? "Workout"}
        entries={entries}
        current={shown?.we.id ?? null}
        currentRow={shown ? rowIndex : -1}
        unit={unit}
        bests={workout.bests}
        percent={prog.percent}
        pending={pending}
        valueOf={valueOf}
        setDraft={setDraft}
        onLog={log}
        onUnlog={unlog}
        onEditLogged={editLogged}
        onAddRow={(we) =>
          setExtra((cur) => ({ ...cur, [we.id]: (cur[we.id] ?? 0) + 1 }))
        }
        onPick={(we) => {
          setViewId(null);
          setPinned(we.id);
        }}
        onSwap={(we) => setSwapFor(we)}
        onMove={move}
        onRemove={remove}
        onFinish={() => {
          setJournal(false);
          setFinishing(true);
        }}
      />

      <SwapSheet
        key={`swap-${swapKey}`}
        we={swapFor}
        onClose={() => setSwapFor(null)}
      />

      <FinishSheet
        open={finishing}
        onClose={() => setFinishing(false)}
        workout={workout}
        exercises={exercises}
        elapsed={elapsed}
        unit={unit}
      />

      <Sheet
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        title="Discard Workout?"
      >
        <p className="px-4 pb-4 text-[15px] text-ink-2">
          Every set logged in this workout is deleted. This cannot be undone.
        </p>
        <div className="flex flex-col gap-2.5">
          <Button
            variant="filled"
            tone="red"
            disabled={pending}
            onClick={() =>
              run(() => discardWorkout(workout.id), "Could not discard")
            }
          >
            Discard Workout
          </Button>
          <Button variant="gray" onClick={() => setConfirmDiscard(false)}>
            Keep Going
          </Button>
        </div>
      </Sheet>
    </>
  );
}

/** The set circles: W for a warm-up, the set's number, D for a drop set; filled when logged, ringed when next. */
export function SetDots({
  rows,
  current,
  className,
}: {
  rows: SetRowView[];
  current: number;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)} aria-hidden>
      {rows.map((r, i) => (
        <span
          key={i}
          className={cn(
            "tabular grid size-[25px] place-items-center rounded-full border-[1.5px] font-semibold",
            r.kind === "warm" ? "text-[10px]" : "text-[12px]",
            r.set
              ? "border-blue bg-blue text-white"
              : "border-current opacity-80",
            i === current &&
              "shadow-[0_0_0_2px_var(--ring-gap,#0b0b0d),0_0_0_4px_var(--blue)]",
          )}
        >
          {r.label}
        </span>
      ))}
    </div>
  );
}

/** The dark stage behind everything, lit a little in the middle */
function Stage({ slug }: { slug: string | null | undefined }) {
  return (
    <div
      aria-hidden
      data-slug={slug ?? ""}
      className="pointer-events-none absolute inset-x-0 top-0 h-[72%] bg-[radial-gradient(110%_70%_at_50%_48%,#3b3b40_0%,#1a1a1d_62%,#0b0b0d_100%)]"
    />
  );
}

/**
 * The illustration, as large as the space between the header and "Last time" allows plus 35pt into each (Frank's
 * "Larger", 2026-11-08), centred in that space and never cropped. The header and the steppers draw over it.
 */
function Art({
  slug,
  large,
}: {
  slug: string | null | undefined;
  large?: boolean;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () =>
      setSize(
        Math.max(
          0,
          Math.min(el.clientWidth + 40, el.clientHeight + (large ? 70 : -28)),
        ),
      );
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [large]);
  return (
    <div ref={box} className="relative min-h-0 flex-1">
      {hasExerciseImage(slug) && size > 0 && (
        // eslint-disable-next-line @next/next/no-img-element -- sized WebP, positioned by measurement
        <img
          src={`/exercises/${slug}.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_24px_30px_rgb(0_0_0/0.45)]"
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
}

/** Rest on the focus screen: an arc of ticks that drains, the time left, and 15 seconds less or more either side. */
function RestArc({
  remaining,
  total,
  onAdd,
}: {
  remaining: number;
  total: number;
  onAdd: (s: number) => void;
}) {
  const N = 34;
  const on = total ? Math.round((remaining / total) * N) : 0;
  return (
    <div
      className="flex items-end justify-between px-5 pb-1"
      role="timer"
      aria-live="off"
      aria-label={remaining ? `Rest, ${remaining} seconds left` : "Rest over"}
    >
      <button
        type="button"
        onClick={() => onAdd(-15)}
        className="tabular mb-1.5 grid size-[49px] place-items-center rounded-full bg-white/15 text-[15px] font-bold"
      >
        −15
      </button>
      <div className="relative h-[140px] w-[220px]">
        <svg
          viewBox="0 0 220 140"
          className="absolute inset-0 size-full"
          aria-hidden
        >
          {Array.from({ length: N }, (_, i) => {
            const a = ((200 - i * (220 / (N - 1))) * Math.PI) / 180;
            const c = Math.cos(a);
            const s = Math.sin(a);
            return (
              <line
                key={i}
                x1={110 + 80 * c}
                y1={104 - 80 * s}
                x2={110 + 94 * c}
                y2={104 - 94 * s}
                strokeWidth={5}
                strokeLinecap="round"
                stroke={i < on ? "var(--blue)" : "rgb(255 255 255 / 0.22)"}
              />
            );
          })}
        </svg>
        <span className="absolute inset-x-0 top-[46px] text-center text-[13px] font-extrabold uppercase tracking-[0.1em] text-white/70">
          {remaining ? "Rest" : "Go"}
        </span>
        <span className="tabular absolute inset-x-0 bottom-3.5 text-center text-[56px] font-extrabold leading-none tracking-[-0.03em]">
          {formatClock(remaining)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onAdd(15)}
        className="tabular mb-1.5 grid size-[49px] place-items-center rounded-full bg-white/15 text-[15px] font-bold"
      >
        +15
      </button>
    </div>
  );
}
