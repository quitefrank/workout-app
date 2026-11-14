import { describe, expect, it } from "vitest";
import { parseEdgeStyle } from "../soft-edge-style";
import { parseThumbsOn, parseThumbZoom, thumbFocusStyle, thumbModeParts } from "../thumb-zoom";

describe("per-device test settings", () => {
  it("reads the soft edge style, gradient only unless set", () => {
    expect(parseEdgeStyle(null)).toBe("gradient");
    expect(parseEdgeStyle("blur")).toBe("blur");
    expect(parseEdgeStyle("fast")).toBe("fast");
    expect(parseEdgeStyle("gradient")).toBe("gradient");
    expect(parseEdgeStyle("nonsense")).toBe("gradient");
  });

  it("reads the thumbnail mode, only the offered ones, keeping the earlier centred levels", () => {
    expect(parseThumbZoom(null)).toBe("1");
    expect(parseThumbZoom("2")).toBe("2");
    expect(parseThumbZoom("1.5")).toBe("1.5");
    expect(parseThumbZoom("focus-2")).toBe("focus-2");
    expect(parseThumbZoom("smart")).toBe("smart");
    expect(parseThumbZoom("3")).toBe("1");
  });

  it("keeps thumbnails off unless switched on", () => {
    expect(parseThumbsOn(null)).toBe(false);
    expect(parseThumbsOn("0")).toBe(false);
    expect(parseThumbsOn("1")).toBe(true);
  });

  it("splits a mode into its scale and placement", () => {
    expect(thumbModeParts("1")).toEqual({ scale: 1, place: "centre" });
    expect(thumbModeParts("2")).toEqual({ scale: 2, place: "centre" });
    expect(thumbModeParts("focus-1.5")).toEqual({ scale: 1.5, place: "focus" });
    expect(thumbModeParts("smart")).toEqual({ scale: 1, place: "smart" });
  });

  it("gives a thumbnail its image's focus, nothing for an unknown image", () => {
    expect(thumbFocusStyle("ankle-stretch")).toMatchObject({ "--fz": expect.any(Number) });
    expect(thumbFocusStyle("no-such-image")).toBeUndefined();
    expect(thumbFocusStyle(null)).toBeUndefined();
  });
});
