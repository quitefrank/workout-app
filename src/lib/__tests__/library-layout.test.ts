import { describe, expect, it } from "vitest";
import { initialTab, libraryLayoutFrom, tabsFor } from "../library-layout";

describe("libraryLayoutFrom", () => {
  it("defaults to the one scroll", () => {
    expect(libraryLayoutFrom(() => undefined)).toBe("scroll");
    expect(libraryLayoutFrom(() => "tabs")).toBe("scroll");
  });
  it("reads a saved layout", () => {
    expect(libraryLayoutFrom(() => "pills")).toBe("pills");
    expect(libraryLayoutFrom(() => "pills-all")).toBe("pills-all");
  });
});

describe("tabsFor", () => {
  it("shows no pills for the one scroll", () => {
    expect(tabsFor("scroll")).toEqual([]);
  });
  it("puts All first only when asked", () => {
    expect(tabsFor("pills")).toEqual(["exercises", "workouts", "programs"]);
    expect(tabsFor("pills-all")).toEqual(["all", "exercises", "workouts", "programs"]);
  });
});

describe("initialTab", () => {
  it("opens on the first pill with nothing stored", () => {
    expect(initialTab("pills", null)).toBe("exercises");
    expect(initialTab("pills-all", null)).toBe("all");
  });
  it("keeps the pill picked last", () => {
    expect(initialTab("pills", "programs")).toBe("programs");
  });
  it("falls back when the layout no longer has the stored pill", () => {
    expect(initialTab("pills", "all")).toBe("exercises");
    expect(initialTab("pills", "junk")).toBe("exercises");
  });
});
