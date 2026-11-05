"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { TrendChart } from "@/components/charts";
import type { ExerciseView } from "@/lib/exercise-view";
import { cn } from "@/lib/cn";
import { dayLabel, localDate } from "@/lib/workout/dates";
import { metricBest, metricSeries, type ExerciseMetric, type ExerciseSession, type MetricPoint } from "@/lib/workout/exercise-metrics";
import { displayWeight, EQUIPMENT_LABELS, formatNumber } from "@/lib/workout/format";
import { ChevronRight, FigureIcon, TrophyIcon } from "./icons";
import { Row } from "./page";

const TABS = ["Summary", "History", "How to"] as const;
type Tab = (typeof TABS)[number];

const METRICS: { key: ExerciseMetric; label: string }[] = [
  { key: "heaviest", label: "Heaviest Weight" },
  { key: "e1rm", label: "One Rep Max" },
  { key: "volume", label: "Best Set Volume" },
];

/** An exercise's three tabs, in its sheet and on its own page. The tabs are the kit's segmented control. */
export function ExerciseDetailTabs({ view, art, onAlternate }: { view: ExerciseView; art: ReactNode; onAlternate?: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>("Summary");
  return (
    <>
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
      {tab === "Summary" && <Summary view={view} art={art} onAlternate={onAlternate} />}
      {tab === "History" && <History view={view} />}
      {tab === "How to" && <HowTo view={view} />}
    </>
  );
}

function Summary({ view, art, onAlternate }: { view: ExerciseView; art: ReactNode; onAlternate?: (id: string) => void }) {
  const { exercise, sessions, unit } = view;
  const [metric, setMetric] = useState<ExerciseMetric>("heaviest");
  const weight = (n: number) => displayWeight(n, exercise.equipment_type, unit) || "BW";
  const points = useMemo(
    () =>
      metricSeries(sessions, metric).map((p) => ({
        label: dayLabel(localDate(p.at)).replace(/^\w+, /, ""),
        value: Math.round(p.value * 10) / 10,
        detail: `${formatNumber(p.value)} (${formatNumber(p.weight)} × ${p.reps})`,
      })),
    [sessions, metric],
  );
  const facts = [
    EQUIPMENT_LABELS[exercise.equipment_type],
    exercise.machine_location && (exercise.machine_location === "upstairs" ? "Upstairs" : "Downstairs"),
  ].filter(Boolean);
  return (
    <>
      <div className="mt-3 h-[140px] overflow-hidden rounded-[20px] bg-[var(--muscle-tile)] p-2">{art}</div>
      <p className="mt-3 text-[15px] text-ink-2">
        {exercise.muscle_groups?.name && (
          <>
            <FigureIcon size={14} className="mr-1 inline align-[-2px] opacity-70" />
            Primary: {exercise.muscle_groups.name} ·{" "}
          </>
        )}
        {facts.join(" · ")}
      </p>

      {points.length > 0 ? (
        <>
          <div className="-mx-4 mt-4 flex gap-2 overflow-x-auto px-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                aria-pressed={metric === m.key}
                onClick={() => setMetric(m.key)}
                className={cn("h-[34px] shrink-0 rounded-full px-4 text-[15px] font-medium", metric === m.key ? "bg-blue text-white" : "bg-fill text-ink")}
              >
                {m.label}
              </button>
            ))}
          </div>
          {points.length > 1 && (
            <div className="mt-3 rounded-[20px] bg-card px-2 pb-2 pt-4">
              <TrendChart points={points} />
            </div>
          )}
          <h3 className="mb-2 mt-5 flex items-center gap-1.5 text-[17px] font-semibold">
            <TrophyIcon size={18} className="text-orange" /> Personal Records
          </h3>
          <div className="grouped">
            <Record label="Heaviest Weight" point={metricBest(sessions, "heaviest")} value={(p) => weight(p.weight)} />
            <Record label="One Rep Max" point={metricBest(sessions, "e1rm")} value={(p) => weight(Math.round(p.value))} />
            <Record label="Best Set Volume" point={metricBest(sessions, "volume")} value={(p) => formatNumber(Math.round(p.value))} />
          </div>
        </>
      ) : (
        <p className="mt-4 rounded-[20px] bg-card px-4 py-3 text-[15px] text-ink-2">Not logged yet.</p>
      )}

      {exercise.alternates.length > 0 && (
        <>
          <h3 className="mb-2 mt-5 text-[17px] font-semibold">Alternates</h3>
          <div className="grouped">
            {exercise.alternates.map((a) =>
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
        <Session key={s.workoutId} session={s} weight={(n) => displayWeight(n, exercise.equipment_type, unit) || "BW"} />
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
            <span className="w-5 text-center font-semibold">{set.warmUp ? "W" : s.sets.filter((o) => !o.warmUp && o.number <= set.number).length}</span>
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
