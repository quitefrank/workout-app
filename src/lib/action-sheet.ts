/**
 * The iOS 27 kit's Action Sheet (Figma wH8YZbekJXNew109clIJz1, Action Sheets 5446:10266): a 300pt card on the medium
 * sheet's glass, 34pt corners, 14pt padding; the title and message 8pt in, 8pt from the top, 10pt apart and 24pt above
 * the actions; 48pt capsule actions on Fills/Secondary, 8pt apart, 17pt semibold labels, destructive in red and first.
 * The kit draws no Cancel: anchored to its button, iOS leaves the cancel action out and a tap outside cancels, as
 * UIAlertController does in a popover. It grows out of the button that asked, with the menu's measured morph.
 */
export const ACTION_SHEET = { width: 300, radius: 34, margin: 12 } as const;

export type Placement = { pin: "top" | "bottom"; right: number; top?: number; bottom?: number; width: number };

/**
 * Where the sheet sits: pinned at the trigger's top-right corner and growing down when it fits below, else at its
 * bottom-right corner growing up (a Start capsule low in a list), kept `margin` inside the screen either way.
 */
export function placeActionSheet(
  trigger: { top: number; bottom: number; right: number },
  height: number,
  screen: { width: number; height: number },
): Placement {
  const { margin } = ACTION_SHEET;
  const width = Math.min(ACTION_SHEET.width, screen.width - margin * 2);
  const right = Math.min(Math.max(margin, screen.width - trigger.right), screen.width - width - margin);
  if (trigger.top + height + margin <= screen.height) return { pin: "top", right, top: Math.max(margin, trigger.top), width };
  const bottom = Math.max(margin, Math.min(screen.height - trigger.bottom, screen.height - height - margin));
  return { pin: "bottom", right, bottom, width };
}
