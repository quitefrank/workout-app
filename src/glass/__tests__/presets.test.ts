import { describe, expect, it } from "vitest";
import { bezelFor, createFamily, iorFor, PRESET1_BARS, PRESET1_LIGHT, SHADOW_OFF, SHEET_DARK, SHEET_LIGHT } from "../presets";

describe("presets", () => {
  it("index of refraction from the Refraction slider", () => {
    expect(iorFor({ refraction: 70 })).toBeCloseTo(1.4998, 4);
    expect(iorFor({ refraction: 100 })).toBeCloseTo(1.714, 3);
  });

  it("bezel is splay times the smaller side", () => {
    expect(bezelFor({ splay: 0.3 }, 360, 62)).toBeCloseTo(18.6, 5);
  });

  it("Preset 1 sides are the saved database row (three-bars, version 204)", () => {
    expect(PRESET1_BARS.haze).toBe(0.5);
    expect(PRESET1_BARS.hazeAdapt).toBe(0.7);
    expect(PRESET1_LIGHT.grazing).toBe(0.03);
    expect(PRESET1_LIGHT.fill2Color).toBe(0xfefefe);
  });

  it("a family carries SHADOW_OFF under each side and follows the appearance", () => {
    const fam = createFamily(PRESET1_BARS, PRESET1_LIGHT, "light");
    expect(fam.P.grazing).toBe(0.03);
    expect(fam.sideValues("dark").grazing).toBe(SHADOW_OFF.grazing);
    const seen: number[] = [];
    fam.onParams((P) => seen.push(P.light));
    fam.setAppearance("dark");
    expect(fam.P.light).toBe(0.35);
    expect(seen).toEqual([0.35]);
  });

  it("an unsubscribed listener is not called on setAppearance", () => {
    const fam = createFamily(PRESET1_BARS, PRESET1_LIGHT, "light");
    const seen: number[] = [];
    const off = fam.onParams((P) => seen.push(P.light));
    off();
    fam.setAppearance("dark");
    expect(seen).toEqual([]);
  });

  it("P is a copy, and switching sides restores and does not leak keys", () => {
    const fam = createFamily({ ...PRESET1_BARS, onlyDark: 1 }, PRESET1_LIGHT, "dark");
    expect(fam.P.onlyDark).toBe(1);
    fam.P.light = 99;
    expect(fam.sideValues("dark").light).toBe(0.35);
    expect(fam.sideValues("light").light).toBe(0.25);
    fam.setAppearance("light");
    expect(fam.P.light).toBe(0.25);
    expect("onlyDark" in fam.P).toBe(false);
    fam.setAppearance("dark");
    fam.setAppearance("light");
    expect(fam.P).toEqual(fam.sideValues("light"));
  });

  it("the sheet is the measured device sheet", () => {
    expect(SHEET_DARK.frost).toBe(30);
    expect(SHEET_DARK.hazeL).toBe(0.12);
    expect(SHEET_LIGHT.hazeL).toBe(0.92);
    expect(SHEET_DARK.cornerSplay).toBe(2);
  });
});
