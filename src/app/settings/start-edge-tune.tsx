"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { Group } from "@/components/segmented";
import { TuneSlider } from "@/components/tune-slider";
import {
  parseTune,
  readTuneRaw,
  subscribeTune,
  TUNE_DEFAULTS,
  TUNE_DIALS,
  tuneSource,
  writeTune,
  type Tune,
} from "@/lib/soft-edge-tune";

/**
 * Sliders for Start Workout's soft edge (a test setting, Frank's call, 2026-11-12), saved on this device. The workout
 * page reads them as it renders, so go back to a workout to see the change; Copy prints the values to paste into the code.
 */
export function StartEdgeTune() {
  const raw = useSyncExternalStore(subscribeTune, readTuneRaw, () => null);
  const t = useMemo(() => parseTune(raw), [raw]);
  const set = (next: Tune) => writeTune(next);
  const changed = TUNE_DIALS.some((d) => t[d.key] !== TUNE_DEFAULTS[d.key]);

  return (
    <Group
      title="Start Workout edge"
      footer="The fade behind a workout's Start Workout button. Percentages run from 16pt above the button (0%) to the screen's bottom (the edge). Saved on this device only."
    >
      {TUNE_DIALS.map((d) => (
        <div key={d.key} className="pt-2.5">
          <div className="flex items-baseline justify-between px-4 text-[17px]">
            <span>{d.label}</span>
            <span className="tabular text-ink-2">
              {t[d.key]}
              {d.unit === "%" ? "%" : "pt"}
            </span>
          </div>
          <TuneSlider
            label={d.label}
            value={t[d.key]}
            min={d.min}
            max={d.max}
            step={d.step}
            onChange={(v) => set({ ...t, [d.key]: v })}
          />
        </div>
      ))}
      <div className="flex gap-2 p-3">
        <Button
          small
          className="flex-1 pr-4"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(tuneSource(t));
              toast.success("Copied the edge's values");
            } catch {
              toast.error("Could not copy");
            }
          }}
        >
          Copy values
        </Button>
        <Button small className="flex-1 pr-4" disabled={!changed} onClick={() => writeTune(null)}>
          Reset
        </Button>
      </div>
    </Group>
  );
}
