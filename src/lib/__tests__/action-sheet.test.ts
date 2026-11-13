import { describe, expect, it } from "vitest";
import { ACTION_SHEET, placeActionSheet } from "../action-sheet";

const phone = { width: 402, height: 874 };

describe("placeActionSheet", () => {
  it("pins the More button's top-right corner and grows down", () => {
    // the active workout's More: 44pt, 16pt from the trailing edge, under the status bar
    const p = placeActionSheet({ top: 62, bottom: 106, right: 386 }, 220, phone);
    expect(p).toEqual({ pin: "top", right: 16, top: 62, width: ACTION_SHEET.width });
  });

  it("grows up from a trigger low on the screen", () => {
    const p = placeActionSheet({ top: 760, bottom: 794, right: 386 }, 220, phone);
    expect(p.pin).toBe("bottom");
    expect(p.bottom).toBe(874 - 794);
  });

  it("stays inside the screen", () => {
    const narrow = { width: 320, height: 568 };
    const p = placeActionSheet({ top: 20, bottom: 54, right: 120 }, 200, narrow);
    expect(p.width).toBe(296);
    expect(p.right).toBe(ACTION_SHEET.margin);
    const tall = placeActionSheet({ top: 400, bottom: 434, right: 386 }, 500, phone);
    // too tall to hang from the trigger: lifted until its top is 12pt from the screen's
    expect(tall).toMatchObject({ pin: "bottom", bottom: 874 - 500 - 12 });
  });
});
