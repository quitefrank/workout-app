/**
 * The pill layout's Journal card: one surface from the pill to the open sheet, its shape driven by a progress from 0 (the
 * pill) to 1 (open, under the 62pt status bar). The content is inside it the whole way, as in Ladder (Supercut recording
 * hW8oIanK6sdvLXdtmNSqaH). Pure, so the gesture's decisions are tested without a browser.
 */
import { SHEET_STATUS_BAR } from "@/lib/sheet-detent";

/**
 * The pill, after the iOS 27 kit's collapsed notification (Figma wH8YZbekJXNew109clIJz1 754:64315), tuned in the Journal
 * Pill Lab (Frank's call, 2026-11-12, https://claude.ai/artifact/LoiDBexQCNYGfaauP8uTQ2): a 38pt circle 16pt from every
 * edge, so 70pt tall, 16pt from each side of the screen, 24pt corners, 27pt off the bottom (tried against the kit's
 * tab bar at 21 and its bottom toolbar at 32 on the phone).
 */
export const PILL = { height: 70, inset: 16, padding: 16, radius: 24, circle: 38, bottom: 27 } as const;

/**
 * The open card's header, the kit's large sheet toolbar (10525:1638): a 16pt grabber band, 44pt buttons 16pt in from each
 * edge, 10pt under them, so 70pt as the pill is. The check grows from the pill's 38pt to 44pt in place.
 */
export const OPEN_HEADER = { height: 70, button: 44, inset: 16 } as const;

/** A drag past this many px up opens the card on release */
export const OPEN_DISTANCE = 90;
/** A release this fast, in px per ms up, opens it whatever the distance; this fast down closes it */
export const FLICK = 0.5;

/** How far the card's top travels from the pill to open, for a screen of `height` with the dock `dockBottom` up */
export function travel(height: number, dockBottom: number): number {
  return Math.max(1, height - dockBottom - PILL.height - SHEET_STATUS_BAR);
}

/** The progress for a drag of `up` px over `distance` (never below the pill or past open) */
export function progressFor(up: number, distance: number): number {
  return Math.min(1, Math.max(0, up / distance));
}

/** Whether a drag up from the pill, released `up` px up at `velocityUp` px per ms, opens the card */
export function opensOnRelease(up: number, velocityUp: number): boolean {
  if (velocityUp > FLICK) return true;
  return up > OPEN_DISTANCE && velocityUp > -0.3;
}

/** Whether a drag down from the open card's header, released at progress `p` moving `velocityDown` px per ms, closes it */
export function closesOnRelease(p: number, velocityDown: number): boolean {
  if (velocityDown > FLICK) return true;
  return p < 0.75 && velocityDown > -0.3;
}
