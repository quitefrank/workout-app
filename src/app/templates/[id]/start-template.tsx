"use client";

import { useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { startWorkout } from "@/app/actions";
import { Button } from "@/components/button";
import { SoftEdge } from "@/components/soft-edge";
import { navState } from "@/glass/nav-state";
import { cn } from "@/lib/cn";
import { parseTune, readTuneRaw, subscribeTune, tuneVars } from "@/lib/soft-edge-tune";

/**
 * Start a workout from this template: the app's filled blue button, pinned at the bottom 20pt from each side (Frank's
 * call, 2026-11-10), over Apple's soft scroll edge (Frank's call, 2026-11-12). A two-floor exercise's floor is set on
 * the exercise, in the workout.
 */
export function StartTemplate({ templateId }: { templateId: string }) {
  const [pending, start] = useTransition();
  // it is not in the painted page, so on a push it slides in itself, with the page (it mounts as the push runs)
  const [pushIn] = useState(() =>
    navState.phase === "idle" ? null : navState.direction === "back" ? "push-in-back" : "push-in",
  );
  // the edge's values as tuned on this device in Settings (the defaults until a slider moves)
  const raw = useSyncExternalStore(subscribeTune, readTuneRaw, () => null);
  const tune = useMemo(() => tuneVars(parseTune(raw)), [raw]);

  const go = () =>
    start(async () => {
      try {
        await startWorkout(templateId);
      } catch (e) {
        // redirect() throws to navigate; only real failures land here
        if (e instanceof Error && !e.message.includes("NEXT_REDIRECT")) toast.error(e.message);
        else throw e;
      }
    });

  return (
    <div
      // Kept out of the painted page, as glass is: the painter offsets a fixed element inside the scroller by the
      // scroll, so its painted copy slid up the list under the real button
      data-unpainted
      // pinned as the docks are: a home screen app's window can be 50pt short, so there this column is placed from the
      // top at the screen's height and bottom-aligns its child (data-screen-bottom, html.standalone in globals.css)
      data-screen-bottom
      className={cn("pointer-events-none fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[640px] flex-col", pushIn)}
      style={{ paddingBottom: "var(--dock-bottom)" }}
    >
      {/* the button's own box, so the edge measures from it and not from the column, which is the screen's height in a
          home screen app */}
      <div className="relative flex flex-col">
        {/* Apple's soft scroll edge behind the button, the screen's width, from the screen's bottom to a reach above
            the button (40pt). Live over the canvas with the button, so it keeps its CSS blur on both paths; first, so the button
            stacks over it. */}
        <SoftEdge
          edge="bottom"
          live
          strong
          // from the screen's bottom to 40pt above the button: a 10pt blur and a gradient from 25% to 0% (Frank's spec,
          // 2026-11-13); the reach and both strengths are tunable from Settings' Start Workout edge sliders
          tuned
          className="bottom-[calc(-1*var(--dock-bottom))] left-[calc(50%-50vw)] w-screen"
          style={{ ...tune, top: "calc(-1 * var(--se-reach, 40px))" }}
        />
        <Button variant="filled" disabled={pending} onClick={go} className="pointer-events-auto relative mx-5">
          {pending ? "Starting…" : "Start Workout"}
        </Button>
      </div>
    </div>
  );
}
