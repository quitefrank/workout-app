import { describe, expect, it } from "vitest";
import { fieldReach, focusLift, LIFT_CLEARANCE } from "../scroller";

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

describe("fieldReach", () => {
  it("reaches the field's box up until its centre is the visible centre (phone numbers)", () => {
    // lifted 287pt, the field's text box is at 328 to 369; the number pad leaves 433pt; iOS centres at 216.5
    const reach = fieldReach(328, 41, 433);
    expect(reach).toBe(264);
    expect((328 - reach + 369) / 2).toBe(433 / 2);
  });

  it("never reaches down", () => {
    expect(fieldReach(100, 41, 433)).toBe(0);
  });
});
