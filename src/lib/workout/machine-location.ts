/**
 * Floors. An exercise is one library row whatever floor it is done on. `exercises.has_floors` says it can be done on
 * either, and the floor is a value on each logged row (`workout_exercises.machine_location`), so PRs, charts and "last
 * time" are worked out per floor and never mix.
 */

export type MachineLocation = "upstairs" | "downstairs";

export const FLOORS: readonly { value: MachineLocation; label: string }[] = [
  { value: "upstairs", label: "Upstairs" },
  { value: "downstairs", label: "Downstairs" },
];

/** Where a two-floor exercise starts when it has never been logged. */
export const FIRST_FLOOR: MachineLocation = "upstairs";

export const floorLabel = (floor: MachineLocation | null | undefined): string | null =>
  FLOORS.find((f) => f.value === floor)?.label ?? null;

/** One exercise on one floor: what history is kept and compared by. An exercise without floors has one bucket. */
export const floorKey = (exerciseId: string, floor: MachineLocation | null | undefined): string => `${exerciseId}|${floor ?? ""}`;
