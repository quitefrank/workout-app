import { describe, expect, it } from "vitest";
import { focusLift } from "../scroller";

describe("focusLift", () => {
  it("centres the field where iOS reveals one (measured on the phone)", () => {
    // the stepper's field rests at 615 to 656 on the 812pt screen; the number pad leaves 433pt visible, and iOS put
    // the field at 196, the same 196pt above and below it
    expect(focusLift(615 + 41 / 2, 433)).toBe(419);
    expect(615 - focusLift(615 + 41 / 2, 433)).toBe(196);
  });

  it("never moves the screen down when the field is already above the centre", () => {
    expect(focusLift(150, 433)).toBe(0);
  });

  it("rounds to whole points", () => {
    expect(Number.isInteger(focusLift(500.3, 433))).toBe(true);
  });
});
