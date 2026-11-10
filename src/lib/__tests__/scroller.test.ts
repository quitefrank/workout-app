import { describe, expect, it } from "vitest";
import { focusLift, LIFT_CLEARANCE } from "../scroller";

describe("focusLift", () => {
  it("lifts the card's bottom to sit LIFT_CLEARANCE above the visible area", () => {
    // the stepper card ends at 731 on an 812pt screen; the number pad leaves 470pt visible
    expect(focusLift(731, 470)).toBe(731 + LIFT_CLEARANCE - 470);
  });

  it("never moves the screen down when the card is already clear", () => {
    expect(focusLift(400, 470)).toBe(0);
  });

  it("rounds up to whole points so the card is never a fraction under the bar", () => {
    expect(focusLift(500.2, 500)).toBe(LIFT_CLEARANCE + 1);
  });
});
