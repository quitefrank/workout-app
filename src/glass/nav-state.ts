import { PUSH, type PushDirection } from "@/lib/page-push";

/**
 * The page push between the app and the glass stage (src/glass/engine/stage.ts), as lens-state.ts is for the tab bar.
 * `PageTransitions` calls `beginPush` when a link is tapped or history goes back, before the new page renders; the stage
 * copies the page it is showing then. `pushCommitted` follows once the new route has rendered. The stage holds the old
 * page until the new one is painted, then runs the push. Without the stage (the CSS path) nothing animates.
 */
export const navState = {
  phase: "idle" as "idle" | "hold" | "run",
  direction: "forward" as PushDirection,
  committed: false,
  since: 0,
  /** set by the stage while it is showing the page: copies what is on screen and says whether it could */
  snapshot: null as null | (() => boolean),
};

export function beginPush(direction: PushDirection): void {
  // a second tap while one is waiting keeps the first copy, which is still the page that was on screen
  if (navState.phase === "hold") return;
  if (!navState.snapshot?.()) return;
  navState.phase = "hold";
  navState.direction = direction;
  navState.committed = false;
  navState.since = performance.now();
}

export function pushCommitted(): void {
  if (navState.phase === "hold") navState.committed = true;
}

/** A hold that never saw its page (the link failed, or went nowhere new) gives up and shows the page as it is. */
export function holdExpired(now: number): boolean {
  return navState.phase === "hold" && now - navState.since > PUSH.holdMaxMs;
}
