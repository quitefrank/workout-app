/** The tab bar's lens this frame, for the glass stage: written by the tab bar (src/components/tab-bar.tsx) every frame
 *  it moves, read by the stage's tabs layer (src/glass/engine/stage.ts). `x`, `w` and `h` are the bar's own px,
 *  unswelled, from its centre; `lift` 0 is the resting capsule and 1 the clear lens; `swell` is the bar's scale.
 *  `bar` is the tab bar's glass element, or null when there is none on screen. */
export type LensFrame = { bar: HTMLElement | null; x: number; w: number; h: number; lift: number; swell: number };

export const lensState: LensFrame = { bar: null, x: 0, w: 0, h: 0, lift: 0, swell: 1 };
