import type { ReactNode } from "react";
import { EXERCISE_IMAGE_SLUGS } from "@/lib/exercise-image-slugs";
import { EXERCISE_IMAGE_STANDINS } from "@/lib/exercise-image-standins";
import { cn } from "@/lib/cn";
import { thumbFocusStyle } from "@/lib/thumb-zoom";

const HAS_IMAGE = new Set(EXERCISE_IMAGE_SLUGS);

/** The slug whose image this exercise shows: its own, else its stand-in's, else null. */
export function exerciseImageSlug(slug: string | null | undefined): string | null {
  if (!slug) return null;
  if (HAS_IMAGE.has(slug)) return slug;
  const standIn = EXERCISE_IMAGE_STANDINS[slug];
  return standIn && HAS_IMAGE.has(standIn) ? standIn : null;
}

/** Whether this exercise shows an illustration, its own or a stand-in. */
export const hasExerciseImage = (slug: string | null | undefined): boolean => exerciseImageSlug(slug) !== null;

/** The illustration's URL. Call only when `hasExerciseImage(slug)`. */
export const exerciseImageSrc = (slug: string | null | undefined): string => `/exercises/${exerciseImageSlug(slug)}.webp`;

/**
 * What fills an exercise's tile: its illustration on the one gray both appearances share, else its muscle group's drawing
 * inset by `pad`, on the themed tile. The box stays square and the image is contained in it (object-contain, which the
 * glass painter follows), so an illustration that is not square is not stretched.
 */
/** `thumb`: a row thumbnail, zoomed by the per-device test setting (src/lib/thumb-zoom.ts); large art never is */
export function ExerciseArt({ slug, art, pad = "p-1.5", thumb = false }: { slug: string | null | undefined; art: ReactNode; pad?: string; thumb?: boolean }) {
  if (!hasExerciseImage(slug)) return <div className={cn("size-full", pad)}>{art}</div>;
  return (
    <div className="flex size-full justify-center bg-[var(--exercise-tile)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- served as sized WebP, and the glass painter reads the element */}
      <img
        src={exerciseImageSrc(slug)}
        alt=""
        className={cn("aspect-square h-full object-contain", thumb && "thumb-zoom")}
        style={thumb ? thumbFocusStyle(exerciseImageSlug(slug)) : undefined}
      />
    </div>
  );
}
