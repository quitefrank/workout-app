import type { ReactNode } from "react";
import { EXERCISE_IMAGE_SLUGS } from "@/lib/exercise-image-slugs";
import { cn } from "@/lib/cn";

const HAS_IMAGE = new Set(EXERCISE_IMAGE_SLUGS);

/** Whether this exercise has its own illustration yet. */
export const hasExerciseImage = (slug: string | null | undefined): boolean => !!slug && HAS_IMAGE.has(slug);

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
      <img src={`/exercises/${slug}.webp`} alt="" className="aspect-square h-full" />
    </div>
  );
}
