"use client";

import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/button";
import { Alert } from "@/components/pop-up-menu";
import { Group } from "@/components/segmented";
import { SelectRow } from "@/components/settings-rows";
import {
  ALERT_OVERLAY_OPTIONS,
  parseAlertOverlay,
  readAlertOverlay,
  subscribeAlertOverlay,
  writeAlertOverlay,
} from "@/lib/alert-overlay";

/**
 * Alert dimming (a test setting, Frank's call, 2026-11-13): which overlay sits behind alerts and action sheets, with a
 * sample alert to compare them over this page. Saved on this device only.
 */
export function AlertOverlayTune() {
  const raw = useSyncExternalStore(subscribeAlertOverlay, readAlertOverlay, () => null);
  const choice = parseAlertOverlay(raw);
  const [preview, setPreview] = useState(false);
  return (
    <Group
      title="Alert dimming"
      footer="The overlay behind alerts and action sheets, such as Exit Workout Early. Default is the kit's blue-gray in light and 48% black in dark; Kit is the blue-gray in both, as it was before. Saved on this device only."
    >
      <SelectRow label="Dimming" value={choice} options={ALERT_OVERLAY_OPTIONS} onChange={writeAlertOverlay} />
      <div className="p-3">
        <Button small className="w-full pr-4" onClick={() => setPreview(true)}>
          Show Alert
        </Button>
      </div>
      {preview && (
        <Alert
          title="Exit Workout Early?"
          message="A sample alert. Nothing is deleted."
          action={{ label: "Delete", destructive: true, onPick: () => {} }}
          onClose={() => setPreview(false)}
        />
      )}
    </Group>
  );
}
