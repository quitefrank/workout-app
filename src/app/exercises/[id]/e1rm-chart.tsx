"use client";

import { TrendChart } from "@/components/charts";
import { dayLabel } from "@/lib/workout/dates";
import { formatNumber } from "@/lib/workout/format";

export function E1rmChart({ points }: { points: { date: string; e1rm: number; top: number }[] }) {
  return (
    <TrendChart
      points={points.map((p) => ({
        label: dayLabel(p.date).replace(/^\w+, /, ""),
        value: Math.round(p.e1rm * 10) / 10,
        detail: `${formatNumber(p.e1rm)} (top set ${formatNumber(p.top)})`,
      }))}
    />
  );
}
