/**
 * The iOS 27 toggle, read from the kit (Figma `wH8YZbekJXNew109clIJz1`, page Toggles 507:24690, component set
 * `Toggle - Switch` 29:56814; Frank's call, 2026-11-13, replacing the older 51 x 31 switch).
 *
 * Track 64 x 28, a capsule: Accents/Green on, Labels/Tertiary off. Knob 38 x 24, white, 2pt in. While pressed the knob
 * becomes a 58 x 38 glass capsule centred on where the knob sits (it overhangs the track by 5pt top and bottom and 8pt
 * at the outer end), showing the track through it. Disabled is the same at 50% opacity.
 */
export const TOGGLE = {
  width: 64,
  height: 28,
  inset: 2,
  knob: { width: 38, height: 24 },
  pressed: { width: 58, height: 38 },
  disabledOpacity: 0.5,
} as const;

export type KnobBox = { left: number; top: number; width: number; height: number };

/** The knob's box inside the track, in points, for each state. */
export function knobBox(on: boolean, pressed: boolean): KnobBox {
  const { width, height, inset, knob } = TOGGLE;
  const restLeft = on ? width - inset - knob.width : inset;
  if (!pressed) return { left: restLeft, top: inset, width: knob.width, height: knob.height };
  // the pressed glass grows round the knob's centre
  const cx = restLeft + knob.width / 2;
  const cy = height / 2;
  const p = TOGGLE.pressed;
  return { left: cx - p.width / 2, top: cy - p.height / 2, width: p.width, height: p.height };
}
