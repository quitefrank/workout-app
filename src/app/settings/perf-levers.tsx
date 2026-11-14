"use client";

import { useMemo, useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { Group } from "@/components/segmented";
import { ToggleRow } from "@/components/settings-rows";
import { describe, onPerfChange, parseStored, PERF_LEVERS, perfSnapshot, resetPerf, resolve, setPerf } from "@/lib/perf-flags";

/**
 * The performance levers (2026-11-14, from the three-agent performance review), one switch each, saved on this device.
 * A lever marked "reload" is read when the glass starts, so it applies on the next page load. The readout (Developer,
 * below) shows renders, paints and rebuilds per second, to see what each lever does.
 */
export function PerfLevers() {
  const raw = useSyncExternalStore(onPerfChange, perfSnapshot, () => "{}");
  const overrides = useMemo(() => parseStored(raw), [raw]);
  const flags = resolve(overrides);
  const changed = describe(overrides);
  return (
    <Group
      title="Performance"
      footer={`Levers for testing what each cost does on this phone. Those marked (reload) apply on the next page load. ${changed ? `Changed: ${changed}.` : "All at their defaults."} A link can set them too: ?perf=-idle,msaa. Saved on this device only.`}
    >
      {PERF_LEVERS.map((d) => (
        <ToggleRow
          key={d.key}
          label={d.restart ? `${d.label} (reload)` : d.label}
          checked={flags[d.key]}
          onChange={(on) => setPerf(d.key, on)}
        />
      ))}
      <div className="flex gap-2 p-3">
        <Button small className="flex-1 pr-4" onClick={() => window.location.reload()}>
          Reload
        </Button>
        <Button small className="flex-1 pr-4" disabled={!changed} onClick={() => resetPerf()}>
          Reset
        </Button>
      </div>
    </Group>
  );
}
