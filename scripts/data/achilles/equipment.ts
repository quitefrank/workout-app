/**
 * Display names for every equipment_item value. The union in
 * src/lib/recovery/types.ts is the source of truth; the Record type
 * fails to compile if a value is added there and not here.
 */

import type { EquipmentItem } from "../../../src/lib/recovery/types";

export const EQUIPMENT_LABELS: Record<EquipmentItem, string> = {
  cable_tower: "Cable tower",
  dumbbells: "Dumbbells",
  adjustable_bench: "Adjustable bench",
  half_rack: "Half rack",
  pull_up_bar: "Pull-up bar",
  plate_tree: "Plate tree",
  mat: "Mat",
  medicine_ball: "Medicine ball",
  stability_ball: "Stability ball",
  treadmill: "Treadmill",
  elliptical: "Elliptical",
  stepper: "Stepper",
  spin_bike: "Spin bike",
  upright_bike: "Upright bike",
  resistance_band: "Resistance band",
  hanging_ab_straps: "Hanging ab straps",
  barbell: "Barbell",
  rower: "Rowing machine",
  leg_press: "Leg press",
  calf_machine: "Calf machine",
  assisted_pull_up: "Assisted pull-up machine",
  captains_chair: "Captain's chair",
  chest_press_machine: "Chest press machine",
  shoulder_press_machine: "Shoulder press machine",
  step_platform: "Step platform",
  bathroom_scale: "Bathroom scale",
};
