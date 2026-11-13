"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { Group, Segmented } from "@/components/segmented";
import { TuneSlider } from "@/components/tune-slider";
import {
  parsePages,
  parseTune,
  readTuneRaw,
  subscribeTune,
  TUNE_DEFAULTS,
  TUNE_DIALS,
  tuneSource,
  writePages,
  writeTune,
  type Tune,
} from "@/lib/soft-edge-tune";

/**
 * Sliders for Start Workout's soft edge (a test setting, Frank's call, 2026-11-12), saved on this device, and whether the
 * same edge sits under the tab bar on every other page (Frank's call, 2026-11-13, on by default). Settings has the tab
 * bar, so its edge changes here as a slider moves; Copy prints the values to paste into the code.
 */
export function StartEdgeTune() {
  const raw = useSyncExternalStore(subscribeTune, readTuneRaw, () => null);
  const t = useMemo(() => parseTune(raw), [raw]);
  const set = (next: Tune) => writeTune(next);
  const changed = TUNE_DIALS.some((d) => t[d.key] !== TUNE_DEFAULTS[d.key]);
  const pages = parsePages(raw);

  return (
    <Group
      title="Bottom edge"
      footer="The fade behind a workout's Start Workout button, and under the tab bar on the other pages while that is on (the active workout keeps its own). It runs from the screen's bottom up to the reach above the button or bar, strongest at the bottom. Saved on this device only."
    >
      <div className="flex items-center justify-between gap-3 pl-4 pr-1">
        <span className="text-[17px]">Under the tab bar</span>
        <div className="w-[150px]">
          <Segmented
            label="Edge under the tab bar"
            value={pages ? "on" : "off"}
            options={[
              ["off", "Off"],
              ["on", "On"],
            ]}
            onChange={(v) => writePages(v === "on")}
          />
        </div>
      </div>
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
