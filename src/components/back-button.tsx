"use client";

import { useRouter } from "next/navigation";
import { beginPush } from "@/glass/nav-state";
import { GlassCircleButton } from "./glass";
import { ChevronLeft } from "./icons";

/** The toolbar's back arrow: back through history, or Home when this page was opened directly. Either pushes back. */
export function BackButton({ label = "Back" }: { label?: string }) {
  const router = useRouter();
  return (
    <GlassCircleButton
      label={label}
      onClick={() => {
        beginPush("back");
        if (window.history.length > 1) router.back();
        else router.push("/");
      }}
    >
      <ChevronLeft size={20} />
    </GlassCircleButton>
  );
}
