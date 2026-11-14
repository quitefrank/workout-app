import { describe, expect, it } from "vitest";
import { parseEdgeStyle } from "../soft-edge-style";
import { parseThumbZoom } from "../thumb-zoom";

describe("per-device test settings", () => {
  it("reads the soft edge style, blur unless set", () => {
    expect(parseEdgeStyle(null)).toBe("blur");
    expect(parseEdgeStyle("fast")).toBe("fast");
    expect(parseEdgeStyle("gradient")).toBe("gradient");
    expect(parseEdgeStyle("nonsense")).toBe("blur");
  });

  it("reads the thumbnail zoom, only the offered levels", () => {
    expect(parseThumbZoom(null)).toBe(1);
    expect(parseThumbZoom("2")).toBe(2);
    expect(parseThumbZoom("1.5")).toBe(1.5);
    expect(parseThumbZoom("3")).toBe(1);
  });
});
