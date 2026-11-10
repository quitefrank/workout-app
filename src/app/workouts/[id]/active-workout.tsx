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
import { CheckIcon, EllipsisIcon, ListIcon, PlayIcon, SkipIcon, StopIcon, SwapIcon } from "@/components/icons";
import { Group, Segmented } from "@/components/segmented";
import { setGlassSteppers, setWorkoutVersion, VERSIONS, type WorkoutVersion } from "@/lib/workout-layout";
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
  repTarget,
  rowLabel,
  valuesOf,
  type SetRowView,
} from "@/lib/workout/active";
import {
  DEFAULT_HOLD_SECONDS,
  FIELDS,
  fieldLabel,
  hasValue,
  measureOf,
  restsByDefault,
  summarize,
  type SetValues,
} from "@/lib/workout/measure";
import { formatClock } from "@/lib/workout/format";
import { floorKey } from "@/lib/workout/machine-location";
import { opensOnRelease, progressFor, travel } from "@/lib/workout/journal-card";
import { exerciseTitle } from "@/lib/workout/movements";
import { FinishSheet } from "./finish-sheet";
import { Journal, JournalBody, type JournalProps } from "./journal";
import { JournalCard, PillCheck, type CardControl } from "./journal-card";
import { useRestTimer } from "./rest-timer";
import { useSetTimer } from "./set-timer";
import type { SetTimerMode, StoredSetTimer } from "@/lib/workout/set-timer";
import { stretchPairs } from "@/lib/workout/pairs";
import { GlassLayers, Stepper, stepperCard } from "./stepper";
import { SwapSheet } from "./swap-sheet";

/**
 * The active workout, aligned with Ladder (Frank's calls, 2026-11-08; the Workout App Teardown,
 * https://claude.ai/artifact/XKi4yGQMMGzJAbWqUQE37v, then the Fixed Stage prototype,
 * https://claude.ai/artifact/Pi7NdnzFdCp5EWNetaSSZg). One screen per set, in the app's colours in light and dark. On
 * the More button's row: the timer and the exercises as Apple's progress bar. Under it the set circles, the title and Up
 * next, then the illustration, then last time and weight and reps on the iOS 27 kit's stepper. Swipe sideways to look
 * through the exercises, swipe up for the Journal. Logging a working set starts rest, which takes the steppers' place as
 * an arc; the header stays as it is.
 *
 * The illustration never moves or resizes: it is the screen's width, centred between the header and the controls, and
 * both of those zones hold their tallest size (the header room for a two-line title, the controls the taller of the
 * steppers and the rest arc, stacked in one grid cell), so title length and rest change nothing around it.
 *
 * One layout, View 5 of the views Frank tried (his call, 2026-11-09; https://www.figma.com/design/ZD41TUAEBtLJI7t0qChNup?node-id=7-2):
 * the set as blue text and the rep target before the name in the header, Up next only on the exercise's last set, and
 * Ladder's pill with set dots above the name. Swap is in the More menu.
 */

export type Entry = { we: WorkoutExerciseRow; rows: SetRowView[] };
type Draft = SetValues;
type Optimistic = { weId: string; add?: SetRow; remove?: string };

export function ActiveWorkout({
  workout,
  settings,
  version: initialVersion,
  glassSteppers: initialGlass,
}: {
  workout: WorkoutDetail;
  settings: Settings;
  version: WorkoutVersion;
  glassSteppers: boolean;
}) {
  // Version 1 is the pill, Version 2 the toolbar under the steppers (src/lib/workout-layout.ts), switched in More
  const [version, setVersion] = useState(initialVersion);
  // Glass stepper cards, a Settings switch saved on this device (src/lib/workout-layout.ts)
  const [glassSteppers, setGlass] = useState(initialGlass);
  const toolbar = version === 2;
  const [journalSheet, setJournalSheet] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const unit = settings.weight_unit;
  const elapsed = useElapsed(workout.started_at);
  const timer = useRestTimer(workout.id);
  // a stretch's hold or an outdoor run's stopwatch, running during the set; a hold logs itself at zero
  const holdDoneRef = useRef<(t: StoredSetTimer) => void>(() => {});
  const setTimer = useSetTimer(workout.id, (t) => holdDoneRef.current(t));
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
            ...(lastWork ? valuesOf(lastWork) : valuesOf({ weight: null, reps: null })),
            kind: "work",
            label: String(++n),
            set: null,
            last: null,
          });
        return { we, rows };
      }),
    [exercises, workout.lastTime, extra],
  );

  // Each lift with a stretch between its sets, and back (Nippard's "Superset A" pairs)
  const pairs = useMemo(() => stretchPairs(entries.map((e) => e.we)), [entries]);

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
    drafts[`${weId}:${i}`] ?? valuesOf(row);
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

  const log = (entry: Entry, i: number, override?: Partial<SetValues>) => {
    const row = entry.rows[i];
    if (!row || row.set) return;
    const measure = measureOf(entry.we.exercises);
    // A timed set starts its timer on the first tap and logs on the second (or, for a hold, at zero)
    const mode = timedMode(measure);
    if (mode && !override) {
      const t = setTimer.state;
      if (t && t.weId === entry.we.id && t.row === i) {
        override = { seconds: setTimer.finish() };
      } else {
        timer.stop();
        setTimer.start(
          entry.we.id,
          i,
          mode,
          mode === "hold" ? (valueOf(entry.we.id, i, row).seconds ?? DEFAULT_HOLD_SECONDS) : 0,
        );
        if (viewing) {
          setPinned(entry.we.id);
          setViewId(null);
        }
        return;
      }
    }
    const v = { ...valueOf(entry.we.id, i, row), ...override };
    const prescribed =
      entry.we.prescribed_sets_max ??
      entry.we.prescribed_sets_min ??
      entry.we.prescribed_reps_max ??
      entry.we.warm_up_sets_max;
    // a stopped timer is a value in itself, so a run logs its time even before its distance is entered
    if (!hasValue(measure, v) && override?.seconds == null && prescribed != null) {
      toast.error(
        `Set ${FIELDS[measure].map((f) => fieldLabel(f, measure, unit).toLowerCase()).join(" or ")} first.`,
      );
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
          ...v,
          rpe: null,
          notes: null,
          completed_at: new Date().toISOString(),
        },
      });
      await logSet(entry.we.id, {
        ...v,
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
    // A lift paired with a stretch moves straight to the stretch and starts its hold, which stands in for rest; a
    // logged stretch comes back for the lift's next set (src/lib/workout/pairs.ts)
    const stretch = isWarmUp ? undefined : entries.find((e) => e.we.id === pairs.stretchOf.get(entry.we.id));
    const stretchRow = stretch ? nextRow(stretch.rows) : -1;
    const lift = entries.find((e) => e.we.id === pairs.liftOf.get(entry.we.id));
    if (stretch && stretchRow >= 0) {
      timer.stop();
      setTimer.start(
        stretch.we.id,
        stretchRow,
        "hold",
        valueOf(stretch.we.id, stretchRow, stretch.rows[stretchRow]).seconds ?? DEFAULT_HOLD_SECONDS,
      );
      setPinned(stretch.we.id);
      setViewId(null);
    } else {
      if (lift && nextRow(lift.rows) >= 0) {
        setPinned(lift.we.id);
        setViewId(null);
      }
      // Rest only after a working set; stretches and cardio rest only when the prescription says so
      if (!isWarmUp)
        timer.start(
          entry.we.prescribed_rest_seconds ??
            (restsByDefault(measure) ? settings.default_rest_seconds : 0),
        );
    }
    setFlash(true);
    window.setTimeout(() => setFlash(false), 420);
  };
  // the pill's circle fills for a moment when a set is logged
  const [flash, setFlash] = useState(false);

  const holdDone = (t: StoredSetTimer) => {
    setTimer.stop();
    const entry = entries.find((e) => e.we.id === t.weId);
    if (entry) log(entry, t.row, { seconds: t.total });
  };
  useLayoutEffect(() => {
    holdDoneRef.current = holdDone;
  });

  const unlog = (entry: Entry, set: SetRow) =>
    run(async () => {
      apply({ weId: entry.we.id, remove: set.id });
      await deleteSet(set.id);
    }, "Could not undo the set");

  const editLogged = (set: SetRow, d: Draft) =>
    run(
      () =>
        updateSet(set.id, {
          ...d,
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
  const [journalKey, setJournalKey] = useState(0);
  // the pill layout's card: mounted while open, grown by a tap or swipe or by the finger dragging the pill
  const card = useRef<CardControl | null>(null);
  const cardP = useRef(0);
  const [cardOpen, setCardOpen] = useState<null | "tap" | "drag">(null);
  const openJournal = () => {
    setJournalKey((k) => k + 1);
    if (toolbar) return setJournalSheet(true);
    cardP.current = 0;
    setCardOpen("tap");
  };
  const closeJournal = () => (toolbar ? setJournalSheet(false) : card.current?.settle(0));

  // Drag the pill up: the card follows the finger from the first move, then opens or sinks back on release
  const pillDrag = useRef<{ x: number; y: number; t: number; last: number; v: number; up: number; d: number; on: boolean } | null>(null);
  const pillSwallow = useRef(0);
  const onPillDown = (e: ReactPointerEvent) => {
    if (cardOpen || (e.target as HTMLElement).closest("[data-pill-check]")) return;
    const dockBottom = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--dock-bottom")) || 21;
    const height = document.querySelector<HTMLElement>("[data-focus-screen]")?.clientHeight ?? window.innerHeight;
    pillDrag.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, last: 0, v: 0, up: 0, d: travel(height, dockBottom), on: false };
    const move = (ev: PointerEvent) => {
      const g = pillDrag.current;
      if (!g) return;
      const up = g.y - ev.clientY;
      if (!g.on) {
        if (up < 6 || up < Math.abs(ev.clientX - g.x)) return;
        g.on = true;
        cardP.current = progressFor(up, g.d);
        setJournalKey((k) => k + 1);
        setCardOpen("drag");
      }
      g.v = (up - g.last) / Math.max(1, ev.timeStamp - g.t);
      g.last = up;
      g.t = ev.timeStamp;
      g.up = up;
      cardP.current = progressFor(up, g.d);
      card.current?.setP(cardP.current);
    };
    const end = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const g = pillDrag.current;
      pillDrag.current = null;
      if (!g?.on) return;
      pillSwallow.current = ev.timeStamp;
      card.current?.settle(ev.type !== "pointercancel" && opensOnRelease(g.up, g.v) ? 1 : 0);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
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
  const measure = measureOf(ex);
  const measureFields = FIELDS[measure];
  const timing =
    setTimer.state && shown && setTimer.state.weId === shown.we.id && setTimer.state.row === rowIndex
      ? setTimer.state
      : null;
  const holding = !!timing && timing.mode === "hold" && !resting;
  // an outdoor run shows its time beside the distance, kept by the app: live while running, else the row's
  const readout = measure === "outdoor";
  const zoneColumns = measureFields.length + (readout ? 1 : 0);

  const journalProps: JournalProps = {
    entries,
    current: shown?.we.id ?? null,
    currentRow: shown ? rowIndex : -1,
    unit,
    bests: workout.bests,
    percent: prog.percent,
    pending,
    valueOf,
    setDraft,
    onLog: log,
    onUnlog: unlog,
    onEditLogged: editLogged,
    onAddRow: (we) => setExtra((cur) => ({ ...cur, [we.id]: (cur[we.id] ?? 0) + 1 })),
    onPick: (we) => {
      setViewId(null);
      setPinned(we.id);
    },
    onSwap: (we) => setSwapFor(we),
    onMove: move,
    onRemove: remove,
    onFinish: () => {
      closeJournal();
      setFinishing(true);
    },
  };

  // What the log button does now, in either version: Skip while resting, Finish when done, Start and Stop for a timed
  // set, else log
  const logState: "skip" | "finish" | "stop" | "start" | "log" = resting
    ? "skip"
    : !shown
      ? "finish"
      : timing
        ? "stop"
        : rowIndex >= 0 && timedMode(measure)
          ? "start"
          : "log";
  const logDisabled = pending || (!resting && !!shown && rowIndex < 0);
  const onLogTap = () =>
    resting ? timer.stop() : !shown ? setFinishing(true) : log(shown, rowIndex);

  // The pill layout's circle, in the pill and in the card's header
  const logCheck = (
    <PillCheck
      state={logState}
      flash={flash}
      disabled={logDisabled}
      onClick={onLogTap}
    />
  );

  return (
    <>
      <TopBar
        spacer={false}
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
        data-focus-screen
        className="fixed inset-0 touch-none select-none overflow-hidden bg-bg text-ink"
      >
        <main
          className="relative flex h-full flex-col"
          style={{
            paddingTop: "var(--bar-top)",
            paddingBottom: toolbar ? "calc(var(--dock-bottom) + 72px + 20px)" : "calc(var(--dock-bottom) + 67px + 20px)",
          }}
        >
          {/* The More button's row: the timer on its own line, and under it the exercises as Apple's progress bar (blue for
              every logged set on the kit's Fills/Primary track, nothing else), stacked in the row's 44pt (Frank's call,
              2026-11-09, from his Figma frame). Tap a segment to look at that exercise. */}
          <div className="relative z-[1] flex h-11 flex-col justify-center pl-5 pr-[72px]">
            <span className="tabular self-start text-[17px] font-semibold leading-[22px]">
              {elapsed == null ? "0:00" : formatClock(elapsed)}
            </span>
            <div className="flex min-w-0 gap-1" role="tablist" aria-label="Exercises">
              {entries.map((e) => {
                const done = e.rows.filter((r) => r.set).length;
                return (
                  <button
                    key={e.we.id}
                    type="button"
                    role="tab"
                    aria-selected={shown?.we.id === e.we.id}
                    aria-label={exerciseTitle(e.we.exercises)}
                    onClick={() => {
                      setViewId(e.we.id === queue?.we.id ? null : e.we.id);
                      setAnim(entries.indexOf(e) > shownIndex ? "l" : "r");
                    }}
                    className="min-w-0 py-2"
                    style={{ flex: e.rows.length }}
                  >
                    <span className="relative block h-1 overflow-hidden rounded-full bg-fill-2">
                      <span
                        className="absolute inset-y-0 left-0 rounded-full bg-blue"
                        style={{ width: `${(100 * done) / e.rows.length}%` }}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {shown ? (
            <div
              key={shown.we.id}
              className={cn(
                // no z-index: it would make a stacking context and sink Glass Steppers under the WebGPU canvas
                "relative flex min-h-0 flex-1 flex-col",
                anim === "l" && "focus-slide-l",
                anim === "r" && "focus-slide-r",
              )}
              onAnimationEnd={() => setAnim(null)}
            >
              {/* First in the DOM so the header and "Last time" paint over it (the glass painter follows DOM order);
                  `order` puts it back between them. */}
              <Art slug={ex?.slug} />

              {/* The same in work and rest. Its minimum height is its height with a two-line title, so a shorter title
                  leaves room under Up next and the illustration stays put. */}
              <header
                className="relative order-first px-5"
                style={{ minHeight: HEADER_ROOM + 35 }}
                aria-label={row ? rowLabel(shown.rows, rowIndex) : undefined}
              >
                {/* The text's box, so the fade's bottom edge sits under Up next whatever the title's height */}
                <div className="relative">
                {/* One fade from the header's top that clears just under Up next, so it never ends in a band across the
                    figure and stays the same whether Up next shows. First in the DOM so the text paints over it; it
                    stops at the header because the timer row above is earlier in the DOM and would be dimmed. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute -inset-x-5 top-0 -bottom-6"
                  style={{
                    background:
                      "linear-gradient(rgb(var(--bg-rgb) / 0.65) 0%, rgb(var(--bg-rgb) / 0.65) calc(100% - 40px), rgb(var(--bg-rgb) / 0) 100%)",
                  }}
                />
                <SetText rows={shown.rows} current={rowIndex} className="relative mt-2.5" />
                <h1 className="relative mt-2.5 text-[28px] font-extrabold leading-[30px] tracking-[-0.02em]">
                  {repTarget(shown.we, row) && (
                    <span className="text-blue">{repTarget(shown.we, row)} </span>
                  )}
                  {exerciseTitle(shown.we.exercises)}
                </h1>
                {/* Up next shows only on the exercise's last set, sliding in 10pt from the left; hidden, not removed, so
                    nothing below it moves */}
                {(() => {
                  const show = rowIndex < 0 || rowIndex === shown.rows.length - 1;
                  return (
                    <div
                      key={show ? `up-${shown.we.id}` : "up"}
                      className={cn("relative mt-2.5", show ? "upnext-in" : "invisible")}
                      aria-hidden={!show}
                    >
                      <div className="truncate text-[15px] leading-[18px] text-ink-2">
                        {upNext ? `Up next · ${exerciseTitle(upNext.we.exercises)}` : "Last exercise"}
                      </div>
                    </div>
                  );
                })()}
                </div>
              </header>

              {/* The controls: last time and the steppers, or the rest arc, stacked in one cell so the zone is always the
                  taller of the two; the one not in use is hidden, not removed. */}
              <div className="relative grid items-end px-5">
                <div className={cn("[grid-area:1/1]", (resting || holding) && "invisible")}>
                  {row && value ? (
                    // One stepper per field the exercise measures: side by side, a lone one at the same half width
                    // and centred, three for a treadmill, or none for a held stretch, which hides the zone (Frank's
                    // calls, 2026-11-09)
                    measureFields.length > 0 && (
                      <>
                        <div className="relative mb-3">
                          <TextFade />
                          <p className="relative text-center text-[15px] leading-[18px] text-ink-2">
                            {row.last ? `Last time · ${summarize(measure, row.last, unit)}` : "No history yet"}
                          </p>
                        </div>
                        <div
                          className={cn("grid justify-center", zoneColumns > 2 ? "gap-2" : "gap-3")}
                          style={{
                            gridTemplateColumns:
                              zoneColumns > 2
                                ? `repeat(${zoneColumns}, minmax(0, 1fr))`
                                : `repeat(${zoneColumns}, calc((100% - 12px) / 2))`,
                          }}
                        >
                          {measureFields.map((f) => (
                            <Stepper
                              key={f}
                              label={fieldLabel(f, measure, unit)}
                              field={f}
                              unit={unit}
                              value={value[f]}
                              onChange={(x) => setDraft(shown.we.id, rowIndex, { ...value, [f]: x })}
                              glass={glassSteppers}
                            />
                          ))}
                          {readout && (
                            <Readout
                              glass={glassSteppers}
                              label="Time"
                              value={timing ? (setTimer.view?.elapsed ?? 0) : value.seconds}
                              live={!!timing}
                            />
                          )}
                        </div>
                      </>
                    )
                  ) : (
                    <p className="pb-4 text-center text-[15px] text-ink-2">
                      {shown.rows.length} of {shown.rows.length} logged. Swipe for the next exercise.
                    </p>
                  )}
                </div>
                <div className={cn("[grid-area:1/1]", !resting && "invisible")} aria-hidden={!resting}>
                  <RestArc remaining={timer.remaining} total={timer.total} onAdd={timer.add} />
                </div>
                {/* a running hold takes the controls' place as the same arc, labelled Hold */}
                <div className={cn("[grid-area:1/1]", !holding && "invisible")} aria-hidden={!holding}>
                  <RestArc
                    label="Hold"
                    remaining={holding ? (setTimer.view?.remaining ?? 0) : 0}
                    total={timing?.total ?? 0}
                    onAdd={setTimer.add}
                  />
                </div>
                {setTimer.state && shown && setTimer.state.weId !== shown.we.id && !resting && (
                  <button
                    type="button"
                    onClick={() => {
                      setPinned(setTimer.state!.weId);
                      setViewId(null);
                    }}
                    className="tabular absolute -top-10 right-5 h-[30px] rounded-full bg-blue px-3 text-[13px] font-semibold text-white"
                  >
                    {setTimer.state.mode === "hold"
                      ? `Hold ${formatClock(setTimer.view?.remaining ?? 0)}`
                      : `Run ${formatClock(setTimer.view?.elapsed ?? 0)}`}
                  </button>
                )}
                {timer.endsAt != null && viewing && (
                  <button
                    type="button"
                    onClick={() => setViewId(null)}
                    className="tabular absolute -top-10 right-5 h-[30px] rounded-full bg-blue px-3 text-[13px] font-semibold text-white"
                  >
                    Rest {formatClock(timer.remaining)}
                  </button>
                )}
              </div>
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

      {/* Version 1, the pill: the circle logs the set (Skip during rest), the middle opens the Journal. Version 2, the
          toolbar: the log button in the middle, Journal and Swap each centred under the stepper card above it (two
          columns with the steppers' 20pt sides and 12pt gap; Frank's Figma frame, node 28-1716) */}
      <div
        data-glass-unit="dock"
        // a column, like every dock: a home screen app stretches the dock to the screen's height and bottom-aligns its
        // children with justify-content (html.standalone in globals.css), which only works down a column
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[640px] flex-col"
        style={{ paddingBottom: "var(--dock-bottom)" }}
      >
        {toolbar ? (
          <div className="relative grid h-[72px] grid-cols-2 items-center gap-3 px-5">
            <button
              type="button"
              aria-label="Journal"
              onClick={openJournal}
              className="glass pointer-events-auto grid size-14 shrink-0 content-center justify-items-center gap-0.5 justify-self-center"
            >
              <ListIcon size={20} />
              <span className="tabular text-[10px] font-semibold opacity-75">
                {shown && rowIndex >= 0 ? `${rowIndex + 1} of ${shown.rows.length}` : "All"}
              </span>
            </button>
            <button
              type="button"
              aria-label="Swap exercise"
              disabled={!shown}
              onClick={() => shown && setSwapFor(shown.we)}
              className="glass pointer-events-auto grid size-14 shrink-0 content-center justify-items-center gap-0.5 justify-self-center disabled:opacity-40"
            >
              <SwapIcon size={20} />
              <span className="text-[10px] font-semibold opacity-75">Swap</span>
            </button>
            <button
              type="button"
              data-glass-skip
              aria-label={
                logState === "skip"
                  ? "Skip rest"
                  : logState === "finish"
                    ? "Finish workout"
                    : logState === "start"
                      ? "Start set"
                      : logState === "stop"
                        ? "Stop and log set"
                        : "Log set"
              }
              disabled={logDisabled}
              onClick={onLogTap}
              className="glass glass-prominent pointer-events-auto absolute left-1/2 top-0 grid size-[72px] -translate-x-1/2 place-items-center transition-transform active:scale-[1.06] disabled:opacity-50"
            >
              {logState === "skip" ? (
                <SkipIcon size={26} />
              ) : logState === "start" ? (
                <PlayIcon size={26} className="translate-x-[2px]" />
              ) : logState === "stop" ? (
                <StopIcon size={24} />
              ) : (
                <CheckIcon size={30} strokeWidth={2.6} />
              )}
            </button>
          </div>
        ) : (
          <div
            className="glass pointer-events-auto relative mx-5 flex h-[67px] touch-none select-none items-center px-[8px] [--r:26px]"
            style={cardOpen ? { visibility: "hidden" } : undefined}
            onPointerDown={onPillDown}
          >
            <span data-pill-check className="contents">
              {logCheck}
            </span>
            <button
              type="button"
              aria-label="Journal"
              onClick={(e) => {
                if (e.timeStamp - pillSwallow.current < 300) return;
                openJournal();
              }}
              className="flex h-full min-w-0 flex-1 flex-col justify-center gap-1 pl-[17px] text-left"
            >
              {shown && <PillDots rows={shown.rows} current={rowIndex} />}
              <span className="w-full truncate text-[17px] font-semibold leading-[22px] tracking-[-0.43px]">
                {shown ? exerciseTitle(shown.we.exercises) : "Every set logged"}
              </span>
            </button>
          </div>
        )}
      </div>

      {menu && (
        <ActionMenu
          rect={menu}
          items={[
            ...(shown ? [{ value: "Do Later" }] : []),
            ...(shown && !toolbar ? [{ value: "Swap Exercise" }] : []),
            { value: "Journal" },
            { value: "Settings" },
            { value: "Back to Home" },
            { value: "Finish Workout" },
            { value: "Discard Workout", destructive: true },
          ]}
          onClose={() => setMenu(null)}
          onPick={(v) => {
            if (v === "Do Later" && shown) move(shown.we, "end");
            else if (v === "Swap Exercise" && shown) setSwapFor(shown.we);
            else if (v === "Journal") openJournal();
            else if (v === "Settings") setSettingsOpen(true);
            else if (v === "Back to Home") router.push("/");
            else if (v === "Finish Workout") setFinishing(true);
            else if (v === "Discard Workout") setConfirmDiscard(true);
          }}
        />
      )}

      {toolbar && (
        <Journal
          key={`journal-${journalKey}`}
          open={journalSheet}
          onClose={() => setJournalSheet(false)}
          title={workout.templates?.name ?? "Workout"}
          {...journalProps}
        />
      )}

      {/* The two versions, switched here mid-workout and saved on this device */}
      <Sheet open={settingsOpen} onClose={() => setSettingsOpen(false)} title="Settings">
        <div className="flex flex-col gap-6 pb-4">
          <Group title="Workout view" footer={`${VERSIONS[version]}. Saved on this device only.`}>
            <Segmented
              label="Workout view"
              value={String(version)}
              options={[
                ["1", "Version 1"],
                ["2", "Version 2"],
              ]}
              onChange={(v) => {
                const next: WorkoutVersion = v === "2" ? 2 : 1;
                setCardOpen(null);
                setJournalSheet(false);
                setVersion(next);
                setWorkoutVersion(next);
              }}
            />
          </Group>
          <Group title="Steppers" footer="Liquid Glass behind the steppers. Saved on this device only.">
            <div className="flex min-h-[52px] items-center gap-3 px-4">
              <span className="flex-1 text-[17px] tracking-[-0.43px]">Glass Steppers</span>
              <button
                type="button"
                role="switch"
                aria-checked={glassSteppers}
                aria-label="Glass Steppers"
                onClick={() => {
                  setGlass(!glassSteppers);
                  setGlassSteppers(!glassSteppers);
                }}
                className={cn(
                  "relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors",
                  glassSteppers ? "bg-green" : "bg-fill-2",
                )}
              >
                <span
                  className={cn(
                    "absolute left-0.5 top-0.5 size-[27px] rounded-full bg-white shadow transition-transform",
                    glassSteppers && "translate-x-5",
                  )}
                />
              </button>
            </div>
          </Group>
        </div>
      </Sheet>

      {!toolbar && cardOpen && (
        <JournalCard
        key={`card-${journalKey}`}
        controlRef={card}
        startRef={cardP}
        openOnMount={cardOpen === "tap"}
        onClosed={() => setCardOpen(null)}
        check={logCheck}
        title={shown ? exerciseTitle(shown.we.exercises) : (workout.templates?.name ?? "Workout")}
        dots={shown ? <PillDots rows={shown.rows} current={rowIndex} /> : undefined}
        current={shown?.we.id ?? null}
      >
        <JournalBody {...journalProps} />
      </JournalCard>
      )}

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

/** Where you are in the exercise as blue text ("Set 2 of 3", "Warm-up 1 of 2", "All sets done"), 25pt tall. */
function SetText({ rows, current, className }: { rows: SetRowView[]; current: number; className?: string }) {
  return (
    <div className={cn("truncate text-[15px] font-semibold leading-[25px] text-blue", className)} aria-hidden>
      {current < 0 ? "All sets done" : rowLabel(rows, current)}
    </div>
  );
}

/**
 * The set dots in the pill (Frank's Figma frame, 2026-11-09): 8pt, 4pt apart; logged solid blue, the current set
 * ringed in blue, the rest in Fills/Primary. Logging fills the current dot to blue as a transition.
 */
function PillDots({ rows, current }: { rows: SetRowView[]; current: number }) {
  return (
    <div className="flex gap-1" aria-hidden>
      {rows.map((r, i) => (
        <span
          key={i}
          className={cn(
            "size-2 rounded-full border transition-[background-color,border-color] duration-300 ease-out",
            r.set ? "border-blue bg-blue" : i === current ? "border-blue bg-transparent" : "border-transparent bg-fill-2",
          )}
        />
      ))}
    </div>
  );
}

/** The header's room: its height with a two-line title and no set circles (title 10 + 60, Up next 10 + 18) */
const HEADER_ROOM = 98;

/**
 * The illustration: the screen's width, square, centred in the space between the header and the controls and never
 * resized (Frank's call, 2026-11-08, from the Fixed Stage prototype). Both zones hold their tallest size, so this space
 * is the same on every set; the image overlaps each zone by the same amount. Above it, one fade runs from the header's top to
 * just under Up next; below it, `TextFade` sits behind Last time and hides with it.
 */
function Art({ slug }: { slug: string | null | undefined }) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState(0);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setSize(el.clientWidth);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return (
    <div ref={box} className="relative min-h-0 flex-1">
      {hasExerciseImage(slug) && size > 0 && (
        // eslint-disable-next-line @next/next/no-img-element -- sized WebP, positioned by measurement
        <img
          src={`/exercises/${slug}.webp`}
          alt=""
          draggable={false}
          className="pointer-events-none absolute left-1/2 top-1/2 max-w-none -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_24px_30px_var(--art-shadow)]"
          style={{ width: size, height: size }}
        />
      )}
    </div>
  );
}

/**
 * A soft band in the screen's colour behind one line of text over the illustration: clear at both edges, so it never
 * ends in a hard line across the figure, and full width. It lives inside the text's own box, so it hides with it.
 */
function TextFade() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -inset-x-10 -inset-y-4"
      style={{
        background:
          "linear-gradient(rgb(var(--bg-rgb) / 0) 0%, rgb(var(--bg-rgb) / 0.65) 35%, rgb(var(--bg-rgb) / 0.65) 65%, rgb(var(--bg-rgb) / 0) 100%)",
      }}
    />
  );
}

/** Rest on the focus screen: an arc of ticks that drains, the time left, and 15 seconds less or more either side. */
function RestArc({
  remaining,
  total,
  onAdd,
  label = "Rest",
}: {
  remaining: number;
  total: number;
  onAdd: (s: number) => void;
  /** "Rest" after a set, "Hold" during a stretch */
  label?: "Rest" | "Hold";
}) {
  const N = 34;
  const on = total ? Math.round((remaining / total) * N) : 0;
  return (
    <div
      className="relative flex items-end justify-between pb-1"
      role="timer"
      aria-live="off"
      aria-label={remaining ? `${label}, ${remaining} seconds left` : `${label} over`}
    >
      <button
        type="button"
        onClick={() => onAdd(-15)}
        className="tabular mb-1.5 grid size-[49px] place-items-center rounded-full bg-fill-2 text-[15px] font-bold"
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
                stroke={i < on ? "var(--blue)" : "var(--fill-2)"}
              />
            );
          })}
        </svg>
        <span className="absolute inset-x-0 top-[46px] text-center text-[13px] font-extrabold uppercase tracking-[0.1em] text-ink-2">
          {remaining ? label : label === "Hold" ? "Done" : "Go"}
        </span>
        <span className="tabular absolute inset-x-0 bottom-3.5 text-center text-[56px] font-extrabold leading-none tracking-[-0.03em]">
          {formatClock(remaining)}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onAdd(15)}
        className="tabular mb-1.5 grid size-[49px] place-items-center rounded-full bg-fill-2 text-[15px] font-bold"
      >
        +15
      </button>
    </div>
  );
}

/** The timer a measure runs during its set: a held stretch counts down, an outdoor run counts up. */
function timedMode(measure: ReturnType<typeof measureOf>): SetTimerMode | null {
  return measure === "hold" ? "hold" : measure === "outdoor" ? "watch" : null;
}

/**
 * A stepper's card without the stepper, for a value the app keeps (an outdoor run's time): the same label, number and
 * height, so it sits beside a stepper as its pair.
 */
function Readout({ label, value, live, glass }: { label: string; value: number | null; live: boolean; glass: boolean }) {
  return (
    <div className={stepperCard(glass)} role="timer" aria-label={label}>
      <GlassLayers on={glass} />
      <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ink-2">{label}</span>
      <span
        className={cn(
          "tabular h-[41px] text-[34px] font-bold leading-[41px] tracking-[0.4px]",
          value == null ? "text-ink-3" : live ? "text-blue" : "text-ink",
        )}
      >
        {value == null ? "–" : formatClock(value)}
      </span>
      <span aria-hidden className="h-8" />
    </div>
  );
}
