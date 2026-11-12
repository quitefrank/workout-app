import type { CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { GROUP_BODY_SLUGS, HEAT_GROUPS, type HeatGroup } from "@/lib/workout/heat";
import { heatFill } from "./heat-fill";
import { BODY_BACK, BODY_BORDER, BODY_FRONT, type BodyPart } from "./paths";

const GROUP_OF = new Map<string, HeatGroup>(HEAT_GROUPS.flatMap((g) => GROUP_BODY_SLUGS[g].map((s) => [s, g] as const)));

/**
 * Front and back, side by side, each drawn muscle filled by its group's working sets. Renders on the server so the
 * 60 KB of paths never ship as JS. A muscle carries `data-g` for taps. The fills are custom properties on the <svg>
 * (`--heat-<Group>`) that `.body-map` rules in globals.css apply, never inline styles on the paths: the glass painter
 * draws a detached copy that keeps a path's style attribute but cannot resolve a var() in it. The selected group's
 * outline comes from `--sel-<Group>` on an ancestor, so selecting needs no re-render of the paths.
 */
export function BodyMap({ sets, className }: { sets: Partial<Record<HeatGroup, number>>; className?: string }) {
  const vars = Object.fromEntries(HEAT_GROUPS.map((g) => [`--heat-${g}`, heatFill(sets[g] ?? 0)])) as CSSProperties;
  const part = ([slug, d]: BodyPart) => <path key={slug} d={d} data-g={GROUP_OF.get(slug)} />;
  return (
    <svg viewBox="0 70 1448 1330" role="img" aria-label="Muscles trained, coloured by working sets" className={cn("body-map", className)} style={vars}>
      {BODY_FRONT.map(part)}
      <path d={BODY_BORDER.front} data-outline="" />
      {BODY_BACK.map(part)}
      <path d={BODY_BORDER.back} data-outline="" />
    </svg>
  );
}
