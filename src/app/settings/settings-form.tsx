"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions";
import { debugSetting, setDebugSetting } from "@/glass/debug";
import { ChevronUpDown } from "@/components/icons";
import { Group, Segmented } from "@/components/segmented";
import { WorkoutLayoutControls } from "@/components/workout-layout-controls";
import { setTheme, type Theme } from "@/lib/appearance";
import { setWorkoutLayout, type WorkoutLayout } from "@/lib/workout-layout";
import { cn } from "@/lib/cn";
import type { Settings } from "@/lib/data/queries";
import { formatRest } from "@/lib/workout/format";

const REST_STEPS = [60, 90, 120, 150, 180, 210, 240, 300];

/** Each control saves as soon as it changes, as iOS Settings does. */
export function SettingsForm({
  settings,
  theme: initialTheme,
  layout: initialLayout,
}: {
  settings: Settings;
  theme: Theme;
  layout: WorkoutLayout;
}) {
  const [s, setS] = useState(settings);
  const [theme, setThemeState] = useState(initialTheme);
  const [layout, setLayoutState] = useState(initialLayout);
  const router = useRouter();
  const [pending, start] = useTransition();
  // a device setting: the server renders it off, the device reads its own
  const stored = useSyncExternalStore(noop, debugSetting, () => false);
  const [debug, setDebug] = useState<boolean | null>(null);
  const debugOn = debug ?? stored;

  const update = (next: Settings) => {
    const prev = s;
    setS(next);
    start(async () => {
      try {
        await saveSettings({
          weightUnit: next.weight_unit,
          defaultRestSeconds: next.default_rest_seconds,
        });
      } catch (e) {
        setS(prev);
        toast.error(e instanceof Error ? e.message : "Could not save");
      }
    });
  };

  return (
    <div
      aria-busy={pending}
      // not dimmed under the WebGPU stage: the painted page is already what shows
      className={cn("mt-4 flex flex-col gap-6 px-4", pending && "[html:not(.gpu)_&]:opacity-90")}>
      <Group title="Appearance" footer="System follows this device's light or dark setting. Saved on this device only.">
        <Segmented
          value={theme}
          options={[
            ["system", "System"],
            ["light", "Light"],
            ["dark", "Dark"],
          ]}
          onChange={(v) => {
            setThemeState(v);
            setTheme(v);
            // the layout reads the choice too (status bar colour, toasts)
            router.refresh();
          }}
        />
      </Group>

      <WorkoutLayoutControls
        value={layout}
        onChange={(v) => {
          setLayoutState(v);
          setWorkoutLayout(v);
        }}
      />

      <Group title="Units" footer="Machine and cardio readings always show the raw number, with no unit.">
        <Segmented
          value={s.weight_unit}
          options={[
            ["lbs", "Pounds"],
            ["kg", "Kilograms"],
          ]}
          onChange={(v) => update({ ...s, weight_unit: v })}
        />
      </Group>

      <Group title="Rest timer" footer="Used when an exercise has no prescribed rest. The timer starts after each working set.">
        {/* The value and chevron are painted with the page; the real select lies over the row, invisible, so a tap opens
            the iOS picker. A live select in scrolling content drifts from its painted row (see the glass rules). */}
        <div className="relative flex items-center justify-between px-4 py-2.5">
          <span className="text-[17px]">Default rest</span>
          <span aria-hidden className="flex items-center gap-1 text-[17px] text-ink-2">
            {formatRest(s.default_rest_seconds)}
            <ChevronUpDown size={16} strokeWidth={2.2} />
          </span>
          <select
            aria-label="Default rest"
            value={s.default_rest_seconds}
            onChange={(e) => update({ ...s, default_rest_seconds: Number(e.target.value) })}
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0"
          >
            {[...new Set([...REST_STEPS, s.default_rest_seconds])]
              .sort((a, b) => a - b)
              .map((v) => (
                <option key={v} value={v}>
                  {formatRest(v)}
                </option>
              ))}
          </select>
        </div>
      </Group>

      <Group title="Developer" footer="Shows the glass renderer's readout at the bottom of the screen. Saved on this device only.">
        <Segmented
          value={debugOn ? "on" : "off"}
          options={[
            ["off", "Off"],
            ["on", "Glass readout"],
          ]}
          onChange={(v) => {
            setDebug(v === "on");
            setDebugSetting(v === "on");
          }}
        />
      </Group>
    </div>
  );
}

const noop = () => () => {};
