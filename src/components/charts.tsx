"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipProps,
} from "recharts";

/**
 * Single-series charts in the system blue (validated on both card
 * surfaces). One series, so no legend box: the section title names it.
 * Thin marks, recessive grid, a crosshair or per-bar tooltip on hover.
 */

const axisTick = { fontSize: 11, fill: "var(--ink-2)" };

/** `t` (ms) places the point on a time axis when the chart has one */
export type Point = { label: string; value: number; detail?: string; t?: number };

/** A time axis: the domain, its ticks and their labels (`chartAxis` in src/lib/workout/chart-range.ts) */
export type TimeAxis = { domain: [number, number]; ticks: number[]; format: (t: number) => string };

function Tip({ active, payload }: TooltipProps<number, string>) {
  const p = payload?.[0]?.payload as Point | undefined;
  if (!active || !p) return null;
  return (
    <div className="glass-sheet px-3 py-2 text-[13px] [--r:14px]">
      <div className="text-ink-2">{p.label}</div>
      <div className="tabular text-[15px] font-semibold text-ink">{p.detail ?? p.value}</div>
    </div>
  );
}

/**
 * Without `axis` the points sit evenly, one slot each, by label. With it they sit at their time `t`, so a long gap
 * between sessions reads as one; a lone point shows as a dot.
 */
export function TrendChart({ points, height = 180, unit, axis }: { points: Point[]; height?: number; unit?: string; axis?: TimeAxis }) {
  const last = points[points.length - 1];
  const lone = points.length === 1;
  return (
    <figure>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--blue)" stopOpacity={0.22} />
                <stop offset="100%" stopColor="var(--blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--sep)" strokeOpacity={0.5} />
            {axis ? (
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={axis.domain}
                ticks={axis.ticks}
                tickFormatter={axis.format}
                interval={0}
                tick={axisTick}
                tickLine={false}
                axisLine={false}
                allowDataOverflow
              />
            ) : (
              <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={24} />
            )}
            <YAxis tick={axisTick} tickLine={false} axisLine={false} width={40} domain={["auto", "auto"]} />
            <Tooltip wrapperStyle={{ zIndex: 6 }} content={<Tip />} cursor={{ stroke: "var(--ink-3)", strokeWidth: 1 }} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--blue)"
              strokeWidth={2}
              fill="url(#trend-fill)"
              dot={lone ? { r: 4, stroke: "none", fill: "var(--blue)" } : false}
              activeDot={{ r: 5, stroke: "var(--card)", strokeWidth: 2, fill: "var(--blue)" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      {last && (
        <figcaption className="px-2 pt-1 text-[13px] text-ink-2">
          Latest <span className="tabular font-semibold text-ink">{last.detail ?? `${last.value}${unit ? ` ${unit}` : ""}`}</span> on {last.label}
        </figcaption>
      )}
    </figure>
  );
}

export function WeeklyBars({ points, height = 160 }: { points: Point[]; height?: number }) {
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }} barCategoryGap={2}>
          <CartesianGrid vertical={false} stroke="var(--sep)" strokeOpacity={0.5} />
          <XAxis dataKey="label" tick={axisTick} tickLine={false} axisLine={false} minTickGap={16} />
          <YAxis tick={axisTick} tickLine={false} axisLine={false} width={28} allowDecimals={false} />
          <Tooltip wrapperStyle={{ zIndex: 6 }} content={<Tip />} cursor={{ fill: "var(--fill)" }} />
          <Bar dataKey="value" fill="var(--blue)" radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
