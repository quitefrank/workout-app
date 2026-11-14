/**
 * Alert dimming, a test setting (Frank's call, 2026-11-13, to compare the overlay behind alerts and action sheets on the
 * phone): Default is `--alert-overlay` in globals.css (the kit's Overlay - Alerts in light, 48% black in dark); Kit is
 * the kit's fill in both appearances, as it shipped before the dark fix; Black is Overlays/Default dark in both; None
 * shows no dimming. Saved on this device in localStorage. Pure apart from the storage.
 */

export type AlertOverlay = "default" | "kit" | "black" | "none";

export const ALERT_OVERLAY_KEY = "alert_overlay";
const EVENT = "alert-overlay-change";

export const ALERT_OVERLAY_OPTIONS: ReadonlyArray<readonly [AlertOverlay, string]> = [
  ["default", "Default"],
  ["kit", "Kit, 23% Blue-Gray"],
  ["black", "Black, 48%"],
  ["none", "None"],
];

/** The stored choice, Default for anything else */
export function parseAlertOverlay(raw: string | null): AlertOverlay {
  return ALERT_OVERLAY_OPTIONS.some(([v]) => v === raw) ? (raw as AlertOverlay) : "default";
}

/** The overlay's background for a choice; null leaves the stylesheet's `--alert-overlay` */
export function alertOverlayFill(choice: AlertOverlay): string | null {
  switch (choice) {
    case "kit":
      return "rgba(41, 41, 58, 0.23)";
    case "black":
      return "rgba(0, 0, 0, 0.48)";
    case "none":
      return "transparent";
    default:
      return null;
  }
}

export function readAlertOverlay(): string | null {
  try {
    return localStorage.getItem(ALERT_OVERLAY_KEY);
  } catch {
    return null;
  }
}

export function writeAlertOverlay(choice: AlertOverlay) {
  try {
    if (choice === "default") localStorage.removeItem(ALERT_OVERLAY_KEY);
    else localStorage.setItem(ALERT_OVERLAY_KEY, choice);
  } catch {
    // private mode or blocked storage: the choice lasts until the page reloads
  }
  window.dispatchEvent(new Event(EVENT));
}

export function subscribeAlertOverlay(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
