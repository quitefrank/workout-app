import { describe, expect, it } from "vitest";
import { SOFT_EDGE, SOFT_EDGE_STRONG } from "@/components/soft-edge";
import { parseTune, TUNE_DEFAULTS, tuneSource, tuneVars } from "../soft-edge-tune";

describe("Start Workout edge tuning", () => {
  it("defaults to the strong preset, so nothing changes until a slider moves", () => {
    const d = SOFT_EDGE_STRONG.darken;
    expect(TUNE_DEFAULTS.blur).toBe(SOFT_EDGE_STRONG.blur);
    expect(TUNE_DEFAULTS.tint / 100).toBe(SOFT_EDGE.tint);
    expect([TUNE_DEFAULTS.d1, TUNE_DEFAULTS.d2, TUNE_DEFAULTS.d3].map((v) => v / 100)).toEqual([d[1][1], d[2][1], d[3][1]]);
    expect([d[1][0], d[2][0], d[3][0]]).toEqual([0.25, 0.6, 1]);
  });

  it("reads back stored values, clamped, with junk falling back to the defaults", () => {
    expect(parseTune(null)).toEqual(TUNE_DEFAULTS);
    expect(parseTune("not json")).toEqual(TUNE_DEFAULTS);
    expect(parseTune(JSON.stringify({ d3: 40, blur: 99, tint: "x" }))).toEqual({ ...TUNE_DEFAULTS, d3: 40, blur: 40 });
  });

  it("turns values into the edge's custom properties and the source's shape", () => {
    const t = { ...TUNE_DEFAULTS, height: 120, d3: 55 };
    expect(tuneVars(t)).toMatchObject({ "--se-height": "120px", "--se-blur": "20px", "--se-tint": 0.81, "--se-d3": 0.55 });
    expect(tuneSource(t)).toContain("darken: [[0, 0], [0.25, 0.35], [0.6, 0.7], [1, 0.55]],");
    expect(tuneSource(t)).toContain("height: 120,");
  });
});
