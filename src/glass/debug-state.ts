/** What the glass renderer is doing, for the `?glassdebug=1` readout (src/glass/debug.tsx). */
export type GlassEntryState = { label: string; family: string; laidOut: boolean; compile: string };
export type GlassDebugState = {
  phase: string;
  error: string | null;
  adapter: string;
  frames: number;
  stage: string;
  entries: GlassEntryState[];
};

export const debugState: GlassDebugState = { phase: "idle", error: null, adapter: "", frames: 0, stage: "", entries: [] };
