"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { saveSettings } from "@/app/actions";
import { debugSetting, setDebugSetting } from "@/glass/debug";
import { setTheme, type Theme } from "@/lib/appearance";
import { cn } from "@/lib/cn";
import type { Settings } from "@/lib/data/queries";
import { formatRest } from "@/lib/workout/format";

const REST_STEPS = [60, 90, 120, 150, 180, 210, 240, 300];

/** Each control saves as soon as it changes, as iOS Settings does. */
export function SettingsForm({ settings, theme: initialTheme }: { settings: Settings; theme: Theme }) {
  const [s, setS] = useState(settings);
  const [theme, setThemeState] = useState(initialTheme);
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
          defaultMachineLocation: next.default_machine_location,
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
      // not dimmed under the WebGPU stage: opacity would make a stacking context and sink the live select under the canvas
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
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[17px]">Default rest</span>
          <select
            data-live
            value={s.default_rest_seconds}
            onChange={(e) => update({ ...s, default_rest_seconds: Number(e.target.value) })}
            className="rounded-lg bg-transparent text-right text-[17px] text-ink-2 outline-none"
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

      <Group title="Machine location" footer="Pre-selected when a template with upstairs and downstairs machines starts.">
        <Segmented
          value={s.default_machine_location ?? "none"}
          options={[
            ["upstairs", "Upstairs"],
            ["downstairs", "Downstairs"],
            ["none", "Ask"],
          ]}
          onChange={(v) => update({ ...s, default_machine_location: v === "none" ? null : v })}
        />
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

function Group({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="px-4 pb-1.5 text-[13px] font-semibold uppercase tracking-[0.06em] text-ink-2">{title}</h2>
      <div className="grouped">{children}</div>
      {footer && <p className="px-4 pt-1.5 text-[13px] text-ink-2">{footer}</p>}
    </section>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly (readonly [T, string])[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="p-2">
      <div role="radiogroup" className="flex gap-1 rounded-full bg-fill p-0.5">
        {options.map(([v, label]) => (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => value !== v && onChange(v)}
            className={cn(
              "h-8 flex-1 rounded-full text-[13px] font-medium",
              value === v && "bg-[var(--seg-on)] font-semibold shadow-[var(--seg-shadow)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
