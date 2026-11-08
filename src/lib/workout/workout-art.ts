/** Muscle groups whose exercises are a workout's warm-up, never its main lift. */
export const WARM_UP_GROUPS: readonly string[] = ["Cardio", "Stretches"];

/** Activation drills the Notion templates open with after the warm-up walk, before the first working lift. */
export const ACTIVATION_SLUGS: readonly string[] = ["cable-external-rotations", "clamshell-hip-rotation"];

/**
 * A workout's exercises in order without its warm-up (the walk, stretches and activation drills), so the first is its
 * main lift. A workout that is nothing but warm-up and cardio, such as a run, keeps them all.
 */
export function workingSlugs(entries: readonly { slug: string | null | undefined; group: string | null | undefined }[]): string[] {
  const all = entries.map((e) => e.slug).filter((s): s is string => Boolean(s));
  const working = entries
    .filter((e) => e.slug && !WARM_UP_GROUPS.includes(e.group ?? "") && !ACTIVATION_SLUGS.includes(e.slug))
    .map((e) => e.slug as string);
  return working.length > 0 ? working : all;
}

/**
 * A workout's main lift for its thumbnail: the first of its lifts that has an illustration, so a workout whose first
 * lift is not drawn yet shows the next one that is. Null when none is drawn.
 */
export function mainLift(slugs: readonly (string | null | undefined)[], hasImage: (slug: string) => boolean): string | null {
  return slugs.find((s): s is string => Boolean(s) && hasImage(s as string)) ?? null;
}
