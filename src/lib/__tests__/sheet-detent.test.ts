import { describe, expect, it } from "vitest";
import { releaseDismisses, sheetFit, sheetSlide } from "../sheet-detent";

describe("sheetFit", () => {
  it("hugs short content, inset", () => {
    expect(sheetFit(874, 240)).toEqual({ height: 240, full: false });
  });
  it("stays inset right up to the large detent", () => {
    expect(sheetFit(874, 811)).toEqual({ height: 811, full: false });
  });
  it("caps at the kit's large detent, edge to edge", () => {
    expect(sheetFit(874, 812)).toEqual({ height: 812, full: true });
    expect(sheetFit(874, 2000)).toEqual({ height: 812, full: true });
  });
  it("is the large detent with no content height, for the keyboard", () => {
    expect(sheetFit(874)).toEqual({ height: 812, full: true });
  });
});

describe("sheetSlide", () => {
  it("rests at zero and never rises above its place", () => {
    expect(sheetSlide(812, 812)).toBe(0);
    expect(sheetSlide(900, 812)).toBe(0);
  });
  it("slides by what the drag has hidden, stopping at fully hidden", () => {
    expect(sheetSlide(712, 812)).toBe(100);
    expect(sheetSlide(-20, 812)).toBe(812);
  });
});

describe("releaseDismisses", () => {
  it("returns from a slow release above halfway and closes below it", () => {
    expect(releaseDismisses(500, 0, 812)).toBe(false);
    expect(releaseDismisses(300, 0, 812)).toBe(true);
  });
  it("lets a flick carry it either way", () => {
    expect(releaseDismisses(600, -1.5, 812)).toBe(true);
    expect(releaseDismisses(300, 1.5, 812)).toBe(false);
  });
});
