import type { ReactNode } from "react";
import { workoutIcon, type WorkoutIconName } from "@/lib/workout/icons";
import { DumbbellIcon, FigureIcon, HandIcon, PantsIcon, ShirtIcon, ShoeIcon, type IconProps } from "./icons";

const ICONS: Record<WorkoutIconName, (p: IconProps) => ReactNode> = {
  hand: HandIcon,
  dumbbell: DumbbellIcon,
  pants: PantsIcon,
  figure: FigureIcon,
  shoe: ShoeIcon,
  shirt: ShirtIcon,
};

/** A workout or template's category as Notion's workout page icon. */
export function WorkoutIcon({ category, ...p }: IconProps & { category: string | null | undefined }) {
  const Icon = ICONS[workoutIcon(category)];
  return <Icon {...p} />;
}
