import Link from "next/link";
import { exerciseImageSrc, hasExerciseImage } from "@/components/exercise-art";
import { hueStyle, tileGradient } from "@/components/page";
import { WorkoutIcon } from "@/components/workout-icon";
import { cn } from "@/lib/cn";
import type { ProgramTemplateTile, TemplateSummary } from "@/lib/data/queries";
import { weeksLabel } from "@/lib/programs/label";
import { mainLift } from "@/lib/workout/workout-art";

/**
 * The tall workout cards (2:3, 132pt wide) in a sideways carousel, or wrapped into a grid with `wrap`. The main lift
 * fills the card in place of the colour gradient (Frank's call, 2026-11-08); an empty workout keeps the gradient.
 */
export function WorkoutTiles({ items, weeks, wrap }: { items: (TemplateSummary & Partial<ProgramTemplateTile>)[]; weeks?: boolean; wrap?: boolean }) {
  return (
    <div className={wrap ? "grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-2.5 px-4" : "no-scrollbar flex snap-x gap-2.5 overflow-x-auto px-4 pb-1.5"}>
      {items.map((t) => {
        // The main lift fills the card in place of the colour gradient (Frank's call, 2026-11-08); empty templates keep it
        const lift = mainLift(t.slugs ?? [], hasExerciseImage);
        return (
          <Link
            key={t.id}
            href={`/templates/${t.id}`}
            style={hueStyle(t.category)}
            className={cn(
              "relative aspect-[2/3] shrink-0 snap-start overflow-hidden rounded-xl text-white",
              wrap ? "w-full" : "w-[132px]",
              lift ? "bg-[var(--exercise-tile)]" : tileGradient,
            )}
          >
            {lift && (
              <>
                {/* square, as tall as the card and centred, since the glass painter ignores object-fit */}
                {/* eslint-disable-next-line @next/next/no-img-element -- served as sized WebP, and the glass painter reads the element */}
                <img src={exerciseImageSrc(lift)} alt="" className="absolute left-[-33px] top-0 h-[198px] w-[198px] max-w-none" />
                <span className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(0,0,0,0.5),transparent_34%)]" />
              </>
            )}
            <span
              className={cn(
                "absolute inset-0",
                lift
                  ? "bg-[linear-gradient(to_top,rgba(0,0,0,0.72),transparent_52%)]"
                  : "bg-[linear-gradient(to_top,rgba(0,0,0,0.55),transparent_60%)]",
              )}
            />
            <span className="absolute left-2.5 top-2.5 right-9 text-[15px] font-semibold leading-tight">{t.name}</span>
            <WorkoutIcon category={t.category} size={18} className="absolute right-2.5 top-2.5 text-white/90" />
            <span className="absolute bottom-1 left-2.5 text-[56px] font-extrabold leading-none tracking-[-0.04em] [text-shadow:0_2px_12px_rgba(0,0,0,0.4)]">
              {tileLabel(t.variant ?? t.name.slice(0, 1))}
            </span>
            <span className="absolute bottom-3 right-2.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-white/85">
              {weeks && t.weekFrom !== undefined && !/^\d+-\d+$/.test(t.variant ?? "")
                ? weeksLabel(t.weekFrom, t.weekTo ?? null).replace(/^Weeks? /, "Wk ")
                : `${t.exerciseCount} ex`}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

/** The big tile label shrinks for the longer phase labels ("2-6", "8-12", "Test"). */
function tileLabel(v: string) {
  if (v.length > 3) return <span className="text-[30px]">{v}</span>;
  return v.length > 2 ? <span className="text-[40px]">{v}</span> : v;
}
