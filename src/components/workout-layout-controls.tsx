"use client";

import { Group, Segmented } from "@/components/segmented";
import { VIEWS, type WorkoutView } from "@/lib/workout-layout";

/** The active workout's five views, in Settings and in the workout's More menu */
export function WorkoutViewControls({
  value,
  onChange,
}: {
  value: WorkoutView;
  onChange: (next: WorkoutView) => void;
}) {
  return (
    <Group title="Workout view" footer={`${VIEWS[value].summary}. Saved on this device only.`}>
      <Segmented
        label="Workout view"
        value={String(value)}
        options={[
          ["1", "View 1"],
          ["2", "View 2"],
          ["3", "View 3"],
          ["4", "View 4"],
          ["5", "View 5"],
        ]}
        onChange={(v) => onChange(Number(v) as WorkoutView)}
      />
    </Group>
  );
}
