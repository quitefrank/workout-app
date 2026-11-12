import { heatPercent } from "@/lib/workout/heat";

/** A group's fill: the body colour with the heat's share of red mixed in. Apart from the paths, so client code can use it. */
export function heatFill(sets: number): string {
  const p = heatPercent(sets);
  return p ? `color-mix(in srgb, var(--red) ${p.toFixed(0)}%, var(--heat-body))` : "var(--heat-body)";
}
