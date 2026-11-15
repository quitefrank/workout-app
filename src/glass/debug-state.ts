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
  /** bytes sent to the GPU from the 2D canvases (page, ring strips, over layer), for MB/s */
  uploaded: number;
  /** the last frames' page draw time (o.draw, ms) and the GPU queue's lag after a frame that uploaded (ms, sampled) */
  drawMs: Samples;
  gpuLagMs: Samples;
  /** how the last page frames were drawn: full repaints, ring strips, ring moves with nothing painted */
  plan: { full: number; strip: number; move: number };
  stage: string;
  entries: GlassEntryState[];
};

/** A ring buffer of the last 60 samples, for p50 and p95 in the readout */
export type Samples = { v: number[]; i: number };
export const samples = (): Samples => ({ v: [], i: 0 });
export function addSample(s: Samples, x: number, n = 60) {
  if (s.v.length < n) s.v.push(x);
  else { s.v[s.i] = x; s.i = (s.i + 1) % n; }
}
/** The p50 and p95 of the samples, rounded to a tenth; null with none */
export function p50p95(s: Samples): [number, number] | null {
  if (!s.v.length) return null;
  const v = [...s.v].sort((a, b) => a - b);
  const at = (q: number) => Math.round(v[Math.min(v.length - 1, Math.floor(q * v.length))] * 10) / 10;
  return [at(0.5), at(0.95)];
}

export const debugState: GlassDebugState = {
  phase: "idle", error: null, adapter: "", frames: 0, renders: 0, paints: 0, rebuilds: 0, uploaded: 0,
  drawMs: samples(), gpuLagMs: samples(), plan: { full: 0, strip: 0, move: 0 }, stage: "", entries: [],
};
