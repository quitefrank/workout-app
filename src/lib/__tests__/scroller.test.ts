import { describe, expect, it } from "vitest";
import { focusLift, LIFT_CLEARANCE } from "../scroller";

describe("focusLift", () => {
  it("lifts the card's bottom to sit LIFT_CLEARANCE above the visible area", () => {
    // the stepper card rests with its bottom at 704 on the 812pt screen; the number pad leaves 433pt visible
    expect(focusLift(704, 433)).toBe(704 + LIFT_CLEARANCE - 433);
  });

  it("never moves the screen down when the card is already clear", () => {
    expect(focusLift(300, 433)).toBe(0);
  });

  it("rounds up to whole points so the card is never a fraction under the bar", () => {
    expect(focusLift(500.2, 500)).toBe(LIFT_CLEARANCE + 1);
  });
});
