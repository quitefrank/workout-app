"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { TrendChart } from "@/components/charts";
import type { ExerciseView } from "@/lib/exercise-view";
import { cn } from "@/lib/cn";
import { dayLabel, localDate } from "@/lib/workout/dates";
import { latestFloor, metricBest, metricSeries, sessionsOnFloor, type ExerciseSession, type MetricPoint } from "@/lib/workout/exercise-metrics";
import { displayWeight, EQUIPMENT_LABELS, formatNumber } from "@/lib/workout/format";
import { FIRST_FLOOR, type MachineLocation } from "@/lib/workout/machine-location";
import { FloorPicker } from "./floor-picker";
import { MovementPicker } from "./movement-picker";
import { ChevronRight, TrophyIcon } from "./icons";
import { Row } from "./page";

const TABS = ["Summary", "History", "How to"] as const;
export type ExerciseTab = (typeof TABS)[number];
type Tab = ExerciseTab;

/** The exercise's muscle group and equipment, for a subtitle. */
export function exerciseFacts(exercise: ExerciseView["exercise"]): string {
  return [exercise.muscle_groups?.name, exercise.option_equipment ?? EQUIPMENT_LABELS[exercise.equipment_type]].filter(Boolean).join(" · ");
}

/**
 * An exercise's three tabs, in its sheet and on its own page. The tabs are the kit's segmented control. The sheet shows
 * the image and facts in its header, so only the page passes `art`, which puts them at the top of Summary. An exercise
 * with floors has a floor pop-up under the tabs: the chart, PRs and history show one floor, opening on the last one used.
 *
 * In the sheet a version (equipment, position, variation) replaces the exercise in place (`onVersion`) and an alternate is
 * a step inside the sheet with Back (`onAlternate`), by Frank's call, 2026-11-13. On the page a version replaces the URL
 * and an alternate is a link.
 */
export function ExerciseDetailTabs({
  view: all,
  art,
  onVersion,
  onAlternate,
  initialTab = "Summary",
  onTabChange,
  stickyTop,
}: {
  view: ExerciseView;
  art?: ReactNode;
  onVersion?: (id: string) => void;
  onAlternate?: (id: string) => void;
  /** the tab it opens on (the Journal's History opens the sheet on History) */
  initialTab?: ExerciseTab;
  onTabChange?: (tab: ExerciseTab) => void;
  /** In a sheet: the tabs stick this far below the sheet's top (its collapsed header) as the content scrolls */
  stickyTop?: number;
}) {
  const router = useRouter();
  const [tab, setTabState] = useState<Tab>(initialTab);
  const setTab = (t: Tab) => {
    setTabState(t);
    onTabChange?.(t);
  };
  const hasFloors = all.exercise.has_floors;
  const [floor, setFloor] = useState<MachineLocation>(() => latestFloor(all.sessions) ?? FIRST_FLOOR);
  const view = hasFloors ? { ...all, sessions: sessionsOnFloor(all.sessions, floor) } : all;
  // Stuck once the spot just above the tabs has scrolled past `stickyTop` in the scroller; only the fade under the band
  // waits on it, since a late fade leaves the content unfaded rather than showing through the tabs
  const sentinel = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  // sticky `top` counts from inside the scroller's padding, and the sheet's hero header is that padding
  const [padTop, setPadTop] = useState(0);
  useEffect(() => {
    const el = sentinel.current;
    const root = el?.closest<HTMLElement>(".sheet-body");
    if (!el || !root || stickyTop === undefined) return;
    setPadTop(parseFloat(getComputedStyle(root).paddingTop) || 0);
    const io = new IntersectionObserver(
      ([e]) => setStuck(!e.isIntersecting && !!e.rootBounds && e.boundingClientRect.top < e.rootBounds.top + 1),
      { root, rootMargin: `-${stickyTop + 8}px 0px 0px 0px`, threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [stickyTop]);
  return (
    <>
      <MovementPicker options={all.options} currentId={all.exercise.id} onSelect={onVersion ?? ((id) => router.replace(`/exercises/${id}`))} />
      {stickyTop !== undefined && <div ref={sentinel} aria-hidden />}
      <div
        className={cn(stickyTop !== undefined && "sticky z-10 -mx-4 -my-2 px-4 py-2")}
        // Always solid, never switched by `stuck`: the scroller sticks the band on the same frame, while the observer
        // reports a frame or more later (many on iOS's momentum scroll), which left the band see-through meanwhile. The
        // sheet's own --sheet-full keeps it clear on a fitted sheet, whose material is translucent and never scrolls.
        style={stickyTop !== undefined ? { top: stickyTop - padTop, background: "color-mix(in srgb, var(--sheet-solid) calc(var(--sheet-full) * 100%), transparent)" } : undefined}
      >
        <div role="tablist" aria-label="Exercise" className="flex gap-1 rounded-full bg-fill p-0.5">
          {TABS.map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={cn("h-8 flex-1 rounded-full text-[13px] font-medium transition", tab === t && "bg-[var(--seg-on)] font-semibold shadow-[var(--seg-shadow)]")}
            >
              {t}
            </button>
          ))}
        </div>
        {/* stuck, the band sits over the header's own edge, so it carries that 22pt fade itself */}
        {stuck && <div aria-hidden className="pointer-events-none absolute inset-x-0 top-full h-[22px] bg-gradient-to-b from-[var(--sheet-solid)] to-transparent" />}
      </div>
      {/* The floor sets what Summary and History show. How to is the same on either, so it has no picker. */}
      {hasFloors && tab !== "How to" && <FloorPicker value={floor} onChange={setFloor} className="mt-1" />}
      {tab === "Summary" && <Summary view={view} art={art} onAlternate={onAlternate} />}
      {tab === "History" && <History view={view} />}
      {tab === "How to" && <HowTo view={view} />}
    </>
  );
}

function Summary({ view, art, onAlternate }: { view: ExerciseView; art?: ReactNode; onAlternate?: (id: string) => void }) {
  const { exercise, sessions, unit } = view;
  // the same movement on other equipment is a choice above, so only other movements are alternates
  const others = exercise.alternates.filter((a) => !view.options.some((o) => o.id === a.exercise.id));
  const weight = (n: number) => displayWeight(n, exercise.equipment_type, unit) || "BW";
  // one chart, Heaviest Weight (Frank's call, 2026-11-13: he never tests a one rep max)
  const points = useMemo(
    () =>
      metricSeries(sessions, "heaviest").map((p) => ({
        label: dayLabel(localDate(p.at)).replace(/^\w+, /, ""),
        value: Math.round(p.value * 10) / 10,
        detail: `${formatNumber(p.value)} (${formatNumber(p.weight)} × ${p.reps})`,
      })),
    [sessions],
  );
  return (
    <>
      {art && (
        <>
          <div className="mt-3 h-[140px] overflow-hidden rounded-[20px] bg-[var(--muscle-tile)]">{art}</div>
          <p className="mt-3 text-[15px] text-ink-2">{exerciseFacts(exercise)}</p>
        </>
      )}

      {points.length > 0 ? (
        <>
          {points.length > 1 && (
            <>
              <h3 className="mb-2 mt-5 text-[17px] font-semibold">Heaviest Weight</h3>
              <div className="rounded-[20px] bg-card px-2 pb-2 pt-4">
                <TrendChart points={points} />
              </div>
            </>
          )}
          <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[17px] font-semibold">
            <TrophyIcon size={18} className="text-orange" /> Personal Records
          </h3>
          <div className="grouped">
            <Record label="Heaviest Weight" point={metricBest(sessions, "heaviest")} value={(p) => weight(p.weight)} />
            <Record label="One Rep Max" point={metricBest(sessions, "e1rm")} value={(p) => weight(Math.round(p.value))} />
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-[20px] bg-card px-4 py-3 text-[15px] text-ink-2">Not logged yet.</p>
      )}

      {others.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[17px] font-semibold">Alternates</h3>
          <div className="grouped">
            {others.map((a) =>
              onAlternate ? (
                <button key={a.position} type="button" onClick={() => onAlternate(a.exercise.id)} className="block w-full text-left active:bg-fill">
                  <Row title={a.exercise.name} subtitle={`Option ${a.position}`} chevron />
                </button>
              ) : (
                <Link key={a.position} href={`/exercises/${a.exercise.id}`} className="block active:bg-fill">
                  <Row title={a.exercise.name} subtitle={`Option ${a.position}`} chevron />
                </Link>
              ),
            )}
          </div>
        </>
      )}
    </>
  );
}

function Record({ label, point, value }: { label: string; point: MetricPoint | null; value: (p: MetricPoint) => string }) {
  return <Row title={label} subtitle={point ? `${formatNumber(point.weight)} × ${point.reps} · ${dayLabel(localDate(point.at), { year: true })}` : undefined} value={point ? value(point) : "None"} />;
}

function History({ view }: { view: ExerciseView }) {
  const { exercise, sessions, unit } = view;
  if (sessions.length === 0) return <p className="mt-4 rounded-[20px] bg-card px-4 py-3 text-[15px] text-ink-2">Not logged yet.</p>;
  return (
    <div className="mt-2">
      {[...sessions].reverse().map((s) => (
        <Session key={`${s.workoutId}-${s.floor}`} session={s} weight={(n) => displayWeight(n, exercise.equipment_type, unit) || "BW"} />
      ))}
    </div>
  );
}

function Session({ session: s, weight }: { session: ExerciseSession; weight: (n: number) => string }) {
  return (
    <section className="mt-3">
      <Link href={`/workouts/${s.workoutId}/summary`} className="flex items-center gap-2 py-1 active:opacity-60">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[17px] font-semibold">{s.name}</div>
          <div className="text-[13px] text-ink-2">{dayLabel(localDate(s.completedAt), { year: true })}</div>
        </div>
        <ChevronRight size={18} className="shrink-0 text-ink-3" />
      </Link>
      <div className="grouped mt-1.5">
        {s.sets.map((set) => (
          <div key={set.number} className="tabular flex min-h-11 items-center gap-4 px-4 text-[15px]">
            {/* stored numbers count warm-ups; the rows count working sets, so the first one is 1 */}
            <span className="w-5 text-center font-semibold">{set.warmUp ? "W" : set.dropSet ? "D" : s.sets.filter((o) => !o.warmUp && !o.dropSet && o.number <= set.number).length}</span>
            <span>{setText(set, weight)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

function setText(set: ExerciseSession["sets"][number], weight: (n: number) => string): string {
  const parts = [set.weight != null && weight(set.weight), set.reps != null && `${set.reps} reps`, set.seconds != null && `${set.seconds} sec`].filter(Boolean);
  return parts.join(" × ") || "Not logged";
}

function HowTo({ view }: { view: ExerciseView }) {
  const { exercise } = view;
  const embed = youtubeEmbed(exercise.video_url);
  return (
    <div className="mt-3">
      {embed ? (
        <div className="aspect-video overflow-hidden rounded-[20px] bg-card">
          <iframe src={embed} title={`${exercise.name} demonstration`} className="size-full" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowFullScreen loading="lazy" />
        </div>
      ) : (
        exercise.video_url && (
          <a href={exercise.video_url} target="_blank" rel="noreferrer" className="block rounded-[20px] bg-card px-4 py-3 text-[17px] text-blue">
            Watch the demonstration
          </a>
        )
      )}
      {exercise.notes && <p className="mt-3 whitespace-pre-line text-[15px] text-ink-2">{exercise.notes}</p>}
      {!exercise.video_url && !exercise.notes && <p className="rounded-[20px] bg-card px-4 py-3 text-[15px] text-ink-2">No demonstration or notes yet.</p>}
    </div>
  );
}

/** A YouTube watch, short or youtu.be link as its embed URL; anything else stays a link. */
function youtubeEmbed(url: string | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    let id: string | null = null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    else if (u.hostname.endsWith("youtube.com")) {
      id = u.searchParams.get("v") ?? (u.pathname.match(/^\/(?:shorts|embed)\/([^/]+)/)?.[1] ?? null);
    }
    if (!id || !/^[\w-]{6,}$/.test(id)) return null;
    const start = u.searchParams.get("t")?.replace(/s$/, "");
    return `https://www.youtube-nocookie.com/embed/${id}${start && /^\d+$/.test(start) ? `?start=${start}` : ""}`;
  } catch {
    return null;
  }
}
