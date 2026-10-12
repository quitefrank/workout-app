/**
 * Upstairs and downstairs machines are separate library rows sharing a
 * name (the Notion ↑ and ↓ arrows, stripped by the seed). Switching a
 * workout's location swaps each machine row for its sibling on the
 * other floor, when one exists.
 */

export type MachineLocation = "upstairs" | "downstairs";

export type LocatedExercise = {
  id: string;
  name: string;
  machine_location: MachineLocation | null;
};

const key = (name: string) => name.trim().toLowerCase();

/**
 * The exercise to use at `location`: the sibling with the same name on
 * that floor, else the exercise itself. Rows without a location never
 * move, and a null location keeps whatever was prescribed.
 */
export function siblingFor<T extends LocatedExercise>(
  exercise: T,
  location: MachineLocation | null,
  library: readonly T[],
): T {
  if (!location || !exercise.machine_location || exercise.machine_location === location) {
    return exercise;
  }
  const match = library.find(
    (e) => e.id !== exercise.id && e.machine_location === location && key(e.name) === key(exercise.name),
  );
  return match ?? exercise;
}
