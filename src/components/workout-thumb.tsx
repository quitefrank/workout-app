import { hasExerciseImage } from "@/components/exercise-art";
import { Thumb } from "@/components/page";
import { mainLift } from "@/lib/workout/workout-art";

/**
 * A workout's, template's or program's 48pt row thumbnail: its main lift's illustration on the illustrations' gray
 * (Frank's call, 2026-11-08). With nothing drawn it falls back to the lettered colour tile.
 */
export function WorkoutThumb({
  category,
  label,
  slugs,
}: {
  category: string | null | undefined;
  label: string;
  slugs: readonly (string | null | undefined)[] | undefined;
}) {
  const lift = mainLift(slugs ?? [], hasExerciseImage);
  if (!lift) return <Thumb category={category} label={label} />;
  return (
    <div className="size-12 shrink-0 overflow-hidden rounded-[10px] bg-[var(--exercise-tile)]">
      {/* eslint-disable-next-line @next/next/no-img-element -- served as sized WebP, and the glass painter reads the element */}
      <img src={`/exercises/${lift}.webp`} alt="" className="size-12" />
    </div>
  );
}
