import type { ReactNode } from "react";
import { EXERCISE_IMAGE_SLUGS } from "@/lib/exercise-image-slugs";
import { EXERCISE_IMAGE_STANDINS } from "@/lib/exercise-image-standins";
import { cn } from "@/lib/cn";

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
 * inset by `pad`, on the themed tile. The image stays square, since the glass painter draws an image into its box and
 * ignores object-fit.
 */
export function ExerciseArt({ slug, art, pad = "p-1.5" }: { slug: string | null | undefined; art: ReactNode; pad?: string }) {
  if (!hasExerciseImage(slug)) return <div className={cn("size-full", pad)}>{art}</div>;
  return (
    <div className="flex size-full justify-center bg-[var(--exercise-tile)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- served as sized WebP, and the glass painter reads the element */}
      <img src={exerciseImageSrc(slug)} alt="" className="aspect-square h-full" />
    </div>
  );
}
