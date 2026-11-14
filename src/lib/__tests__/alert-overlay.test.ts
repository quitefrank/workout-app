import { describe, expect, it } from "vitest";
import { alertOverlayFill, parseAlertOverlay } from "../alert-overlay";

describe("alert overlay setting", () => {
  it("reads a stored choice, anything else is Default", () => {
    expect(parseAlertOverlay("kit")).toBe("kit");
    expect(parseAlertOverlay("none")).toBe("none");
    expect(parseAlertOverlay(null)).toBe("default");
    expect(parseAlertOverlay("purple")).toBe("default");
  });

  it("maps each choice to a fill, Default to the stylesheet", () => {
    expect(alertOverlayFill("default")).toBeNull();
    expect(alertOverlayFill("kit")).toBe("rgba(41, 41, 58, 0.23)");
    expect(alertOverlayFill("black")).toBe("rgba(0, 0, 0, 0.48)");
    expect(alertOverlayFill("none")).toBe("transparent");
  });
});
