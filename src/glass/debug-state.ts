/** What the glass renderer is doing, for the `?glassdebug=1` readout (src/glass/debug.tsx). */
export type GlassEntryState = { label: string; laidOut: boolean; compile: string };
export type GlassDebugState = {
  phase: string;
  error: string | null;
  adapter: string;
  frames: number;
  /** composites drawn, page paints (the 2D canvas and its upload) and display-list rebuilds, counted for the readout's
   *  per-second rates (the performance levers, 2026-11-14) */
  renders: number;
  paints: number;
  rebuilds: number;
  stage: string;
  entries: GlassEntryState[];
};

export const debugState: GlassDebugState = { phase: "idle", error: null, adapter: "", frames: 0, renders: 0, paints: 0, rebuilds: 0, stage: "", entries: [] };
