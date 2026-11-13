"use client";

import { useSyncExternalStore } from "react";
import { Group, Segmented } from "@/components/segmented";
import { HERO_MODE_DEFAULT, parseHeroMode, readHeroModeRaw, subscribeHeroMode, writeHeroMode, type HeroMode } from "@/lib/sheet-hero";

const OPTIONS: ReadonlyArray<readonly [HeroMode, string]> = [
  ["fade", "Fade"],
  ["push", "Push"],
  ["center", "Center"],
];

/**
 * Which motion the exercise sheet's header uses as the image shrinks (a test setting, Frank's call, 2026-11-13, while
 * he compares them), saved on this device. The motions are in src/lib/sheet-hero.ts.
 */
export function SheetHeroMode() {
  const mode = parseHeroMode(useSyncExternalStore(subscribeHeroMode, readHeroModeRaw, () => HERO_MODE_DEFAULT));
  return (
    <Group
      title="Exercise sheet"
      footer="How the title moves as the image shrinks. Fade: the large title under the image fades out and the small one fades in. Push: the title starts in the header on the left and slides right. Center: it starts centred and slides left. Saved on this device only."
    >
      <div className="px-4 py-1">
        <Segmented label="Exercise sheet title motion" value={mode} options={OPTIONS} onChange={writeHeroMode} />
      </div>
    </Group>
  );
}
