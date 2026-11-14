"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions";
import { debugSetting, setDebugSetting } from "@/glass/debug";
import { Group } from "@/components/segmented";
import { SelectRow, ToggleRow } from "@/components/settings-rows";
import { setTheme, type Theme } from "@/lib/appearance";
import { cn } from "@/lib/cn";
import type { Settings } from "@/lib/data/queries";
import { type LibraryLayout, setLibraryLayout } from "@/lib/library-layout";
import { formatRest } from "@/lib/workout/format";
import { StartEdgeTune } from "./start-edge-tune";

const REST_STEPS = [60, 90, 120, 150, 180, 210, 240, 300];

/** Each control saves as soon as it changes, as iOS Settings does. */
export function SettingsForm({
  settings,
  theme: initialTheme,
  libraryLayout: initialLibraryLayout,
}: {
  settings: Settings;
  theme: Theme;
  libraryLayout: LibraryLayout;
}) {
  const [s, setS] = useState(settings);
  const [theme, setThemeState] = useState(initialTheme);
  const [libraryLayout, setLibraryLayoutState] = useState(initialLibraryLayout);
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
          heatWindow: next.heat_window,
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
      className={cn("flex flex-col gap-6 px-4", pending && "[html:not(.gpu)_&]:opacity-90")}>
      <Group title="Appearance" footer="System follows this device's light or dark setting. Saved on this device only.">
        <SelectRow
          label="Appearance"
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

      <Group title="Library" footer="Pills switch the Library between Exercises, Workouts and Programs under the search field. Saved on this device only.">
        <SelectRow
          label="Layout"
          value={libraryLayout}
          options={[
            ["scroll", "One Scroll"],
            ["pills", "Pills"],
            ["pills-all", "Pills with All"],
          ]}
          onChange={(v) => {
            setLibraryLayoutState(v);
            setLibraryLayout(v);
            router.refresh();
          }}
        />
      </Group>

      <Group title="Units" footer="Machine and cardio readings always show the raw number, with no unit.">
        <SelectRow
          label="Weight"
          value={s.weight_unit}
          options={[
            ["lbs", "Pounds"],
            ["kg", "Kilograms"],
          ]}
          onChange={(v) => update({ ...s, weight_unit: v })}
        />
      </Group>

      <Group
        title="Last 7 days"
        footer="Home's body map counts working sets from today and the six days before, or from Monday. A set drops out when its day leaves the window."
      >
        <SelectRow
          label="Window"
          value={s.heat_window}
          options={[
            ["rolling", "Rolling 7 Days"],
            ["week", "Monday to Sunday"],
          ]}
          onChange={(v) => update({ ...s, heat_window: v })}
        />
      </Group>

      <Group title="Rest timer" footer="Used when an exercise has no prescribed rest. The timer starts after each working set.">
        <SelectRow
          label="Default rest"
          value={s.default_rest_seconds}
          options={[...new Set([...REST_STEPS, s.default_rest_seconds])]
            .sort((a, b) => a - b)
            .map((v) => [v, formatRest(v) ?? `${v}s`] as const)}
          onChange={(v) => update({ ...s, default_rest_seconds: v })}
        />
      </Group>

      <StartEdgeTune />

      <Group title="Developer" footer="Shows the glass renderer's readout at the bottom of the screen. Saved on this device only.">
        <ToggleRow
          label="Glass readout"
          checked={debugOn}
          onChange={(on) => {
            setDebug(on);
            setDebugSetting(on);
          }}
        />
      </Group>
    </div>
  );
}

const noop = () => () => {};
