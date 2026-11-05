"use client";

import { useRouter } from "next/navigation";
import { FloorPicker } from "@/components/floor-picker";
import type { MachineLocation } from "@/lib/workout/machine-location";

/** The floor Progress charts, kept in the URL with the exercise. */
export function AnalyticsFloorPicker({ exerciseId, value }: { exerciseId: string; value: MachineLocation | null }) {
  const router = useRouter();
  return <FloorPicker value={value} className="mx-4 mb-2" onChange={(floor) => router.push(`/analytics?exercise=${exerciseId}&floor=${floor}`, { scroll: false })} />;
}
