/** The icon a workout or template shows for its category, after Notion's workout page icons. */
export type WorkoutIconName = "hand" | "dumbbell" | "pants" | "figure" | "shoe" | "shirt";

const BY_CATEGORY: Record<string, WorkoutIconName> = {
  push: "hand",
  pull: "dumbbell",
  legs: "pants",
  full_body: "figure",
  cardio: "shoe",
  abs: "shirt",
  arms: "dumbbell",
  rehab: "figure",
};

export function workoutIcon(category: string | null | undefined): WorkoutIconName {
  return BY_CATEGORY[category ?? ""] ?? "dumbbell";
}
