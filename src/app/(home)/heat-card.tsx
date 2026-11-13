"use client";

import { type CSSProperties, type MouseEvent, type ReactNode, useState } from "react";
import { SectionHeader } from "@/components/page";
import { heatFill } from "@/components/body-map/heat-fill";
import { cn } from "@/lib/cn";
import { formatSets, HEAT_GROUPS, HEAT_HIGH, HEAT_LOW, stateLine, type Heat, type HeatGroup } from "@/lib/workout/heat";

/** The bars' scale: a little past HIGH, so the range band and anything past it both show. */
const BAR_MAX = HEAT_HIGH + 6;
const LEGEND: [number, string][] = [
  [0, "None"],
  [HEAT_LOW / 2, `1 to ${HEAT_LOW - 1}`],
  [(HEAT_LOW + HEAT_HIGH) / 2, `${HEAT_LOW} to ${HEAT_HIGH}`],
  [HEAT_HIGH + 1, `${HEAT_HIGH}+`],
];

/**
 * Home's Last 7 Days (Frank's calls, 2026-11-11, from the Tab Bar and Home Lab): the body front and back coloured by
 * working sets, a legend, the workouts and working sets in the window, then a bar per muscle group against the 10 to 20
 * band. Tapping a muscle or its bar shows its count and where the sets came from. `body` is the server-rendered
 * BodyMap; selecting outlines a group through `--sel-<Group>`, so the paths never re-render.
 */
export function HeatCard({ title, range, heat, body }: { title: string; range: string; heat: Heat; body: ReactNode }) {
  const [sel, setSel] = useState<HeatGroup | null>(null);
  const toggle = (g: HeatGroup) => setSel((s) => (s === g ? null : g));
  const onBody = (e: MouseEvent) => {
    const g = (e.target as Element).closest("[data-g]")?.getAttribute("data-g") as HeatGroup | null;
    if (g) toggle(g);
    else setSel(null);
  };
  const s = sel ? (heat.sets[sel] ?? 0) : 0;

  return (
    <>
      <SectionHeader title={title} trailing={<span className="text-ink-2">{range}</span>} />
      <div className="mx-4 rounded-[26px] bg-card px-4 pb-4 pt-3">
        <div
          onClick={onBody}
          style={sel ? ({ [`--sel-${sel}`]: "var(--ink)" } as CSSProperties) : undefined}
          className="-mx-1 cursor-pointer [&_svg]:block [&_svg]:h-auto [&_svg]:w-full"
        >
          {body}
        </div>

        <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 text-[12px] leading-4 text-ink-2">
          {LEGEND.map(([n, label]) => (
            <span key={label} className="flex items-center gap-1">
              <i className="inline-block size-2.5 rounded-[3px]" style={{ background: heatFill(n) }} />
              {label}
            </span>
          ))}
        </div>

        {sel && (
          <div className="mt-3 rounded-2xl bg-[var(--bg)] px-3.5 py-3 text-[15px] leading-5">
            <div>
              <b className="font-semibold">
                {sel} · {formatSets(s)} {s === 1 ? "set" : "sets"}
              </b>
              <span className="text-ink-2"> · {stateLine(s)}</span>
            </div>
            <ul className="mt-1.5 flex flex-col gap-0.5 text-[13px] leading-[18px] text-ink-2">
              {(heat.sources[sel] ?? []).map((src) => (
                <li key={`${src.exerciseId}-${src.share}`}>
                  {src.share === 0
                    ? `${src.title}: ${Math.round((src.seconds ?? 0) / 60)} min, not counted`
                    : `${src.title}: ${src.sets} ${src.share === 1 ? (src.sets === 1 ? "set" : "sets") : "× ½, secondary"}`}
                </li>
              ))}
              {!heat.sources[sel]?.length && <li>No working sets in this window.</li>}
            </ul>
          </div>
        )}

        {/* the window's totals sit above the bars (Frank's call, 2026-11-11); time was left out */}
        <div className="mt-3.5 grid grid-cols-2 border-y border-[var(--sep)] py-2.5 text-center">
          <Total value={heat.workouts} label={heat.workouts === 1 ? "workout" : "workouts"} />
          <Total value={heat.workingSets} label={heat.workingSets === 1 ? "working set" : "working sets"} />
        </div>

        <div className="mt-3 flex flex-col">
          {HEAT_GROUPS.map((g) => {
            const n = heat.sets[g] ?? 0;
            return (
              <button
                key={g}
                type="button"
                aria-pressed={sel === g}
                onClick={() => toggle(g)}
                className={cn("grid grid-cols-[92px_1fr_36px] items-center gap-2.5 py-[5px] text-left text-[15px]", sel === g && "font-semibold")}
              >
                <span>{g}</span>
                <span className="relative h-2 overflow-hidden rounded-full bg-fill">
                  <span
                    className="absolute inset-y-0"
                    style={{
                      left: `${(HEAT_LOW / BAR_MAX) * 100}%`,
                      width: `${((HEAT_HIGH - HEAT_LOW) / BAR_MAX) * 100}%`,
                      background: "color-mix(in srgb, var(--red) 16%, transparent)",
                    }}
                  />
                  <span
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${(Math.min(n, BAR_MAX) / BAR_MAX) * 100}%`, background: heatFill(n) }}
                  />
                </span>
                <span className="tabular text-right font-semibold">{formatSets(n)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

function Total({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="tabular text-[22px] font-bold leading-[26px]">{value}</div>
      <div className="text-[13px] text-ink-2">{label}</div>
    </div>
  );
}
