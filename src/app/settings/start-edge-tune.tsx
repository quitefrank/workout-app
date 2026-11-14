"use client";

import { useMemo, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button } from "@/components/button";
import { Group } from "@/components/segmented";
import { SelectRow, ToggleRow } from "@/components/settings-rows";
import { EDGE_STYLES, edgeStyleSnapshot, onEdgeStyleChange, setEdgeStyle } from "@/lib/soft-edge-style";
import { TuneSlider } from "@/components/tune-slider";
import {
  parseSwitch,
  parseTune,
  readTuneRaw,
  subscribeTune,
  TUNE_DEFAULTS,
  TUNE_DIALS,
  tuneSource,
  writeSwitch,
  writeTune,
  type EdgeSwitch,
  type Tune,
} from "@/lib/soft-edge-tune";

const SWITCHES: ReadonlyArray<{ key: EdgeSwitch; label: string }> = [
  { key: "pages", label: "Under the tab bar" },
  { key: "workout", label: "On workout pages" },
];

/**
 * Sliders for Start Workout's soft edge (a test setting, Frank's call, 2026-11-12), saved on this device, and whether the
 * same edge sits under the tab bar on every other page (Frank's call, 2026-11-13; off by default since 2026-11-14). Settings has the tab
 * bar, so its edge changes here as a slider moves; Copy prints the values to paste into the code.
 */
export function StartEdgeTune() {
  const raw = useSyncExternalStore(subscribeTune, readTuneRaw, () => null);
  const t = useMemo(() => parseTune(raw), [raw]);
  const set = (next: Tune) => writeTune(next);
  const style = useSyncExternalStore(onEdgeStyleChange, edgeStyleSnapshot, () => "gradient" as const);
  const changed = TUNE_DIALS.some((d) => t[d.key] !== TUNE_DEFAULTS[d.key]);
  return (
    <Group
      title="Bottom edge"
      footer="The fade under the tab bar, and behind the Start Workout button on a workout's page, each while its switch is on (the active workout keeps its own). It runs from the screen's bottom up to the reach above the button or bar, strongest at the bottom. Style applies to every soft edge, the active workout's too: Fast blur blurs at quarter resolution, Gradient only drops the blur. Saved on this device only."
    >
      <SelectRow label="Style" value={style} options={EDGE_STYLES} onChange={setEdgeStyle} />
      {SWITCHES.map((s) => (
        <ToggleRow key={s.key} label={s.label} checked={parseSwitch(raw, s.key)} onChange={(on) => writeSwitch(s.key, on)} />
      ))}
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
