"use client";

import { useRouter } from "next/navigation";
import { GlassCircleButton } from "./glass";
import { ChevronLeft } from "./icons";

/** The toolbar's back arrow: back through history, or Home when this page was opened directly. */
export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <GlassCircleButton label={label} onClick={() => (window.history.length > 1 ? router.back() : router.push("/"))}>
      <ChevronLeft size={20} />
    </GlassCircleButton>
  );
}
