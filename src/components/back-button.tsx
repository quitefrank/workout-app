"use client";

import { useRouter } from "next/navigation";
import { beginPush } from "@/glass/nav-state";
import { backAction, readIdx } from "@/lib/nav-index";
import { GlassCircleButton } from "./glass";
import { ChevronLeft } from "./icons";

/**
 * The toolbar's back arrow, the only back control (never a link to a fixed page, which adds a history entry and loops
 * with a Back that goes through history; 2026-11-13). Back through history when a page of ours is behind this one, else
 * replace this page with `fallback`, its parent (src/lib/nav-index.ts). Either pushes back.
 */
export function BackButton({ label = "Back", fallback = "/" }: { label?: string; fallback?: string }) {
  const router = useRouter();
  return (
    <GlassCircleButton
      label={label}
      onClick={() => {
        beginPush("back");
        const a = backAction(readIdx(window.history.state), fallback);
        if (a.type === "back") router.back();
        else router.replace(a.href);
      }}
    >
      <ChevronLeft size={20} />
    </GlassCircleButton>
  );
}
