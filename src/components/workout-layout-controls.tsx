"use client";

import { Group, Segmented } from "@/components/segmented";
import type { WorkoutLayout } from "@/lib/workout-layout";

/** The two layout choices for the active workout, in Settings and in the workout's More menu */
export function WorkoutLayoutControls({
  value,
  onChange,
}: {
  value: WorkoutLayout;
  onChange: (next: WorkoutLayout) => void;
}) {
  return (
    <>
      <Group
        title="Log button"
        footer="Centred: the ✓ between Journal and Swap. Pill: the circle in the pill logs, and the pill pulls up the Journal."
      >
        <Segmented
          label="Log button"
          value={value.log}
          options={[
            ["centred", "Centred"],
            ["pill", "Pill"],
          ]}
          onChange={(log) => onChange({ ...value, log })}
        />
      </Group>
      <Group title="Weight and reps" footer="Saved on this device only.">
        <Segmented
          label="Weight and reps"
          value={value.steppers}
          options={[
            ["cards", "Cards"],
            ["list", "Inset list"],
          ]}
          onChange={(steppers) => onChange({ ...value, steppers })}
        />
      </Group>
    </>
  );
}
