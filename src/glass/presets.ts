/**
 * The Glass Lab V3's material values (docs/lab/glass-lab-v3.html, lines 3229 to 3299), as the
 * lab's database held them on 2026-10-12 (tuning/three-bars, version 204, mode preset1). Change
 * them only by copying a newer row from the lab.
 */

export type Material = Record<string, number>;
export type Side = "dark" | "light";

// Frost is entered as Figma's number and rendered as a Gaussian of sigma = number x 2.5/6 points
export const FROST_SIGMA = 2.5 / 6;

// The kit's shadow layers and fills, off unless a preset says otherwise
export const SHADOW_OFF: Material = {
  lensMode: 0, prism: 0, grazing: 0.35, shade: 0, shadeDepth: 30, glow: 0, glowDepth: 10, outline: 0, sideShadow: 0,
  sideW: 0.5, cast: 0, fillOpacity: 0, fillColor: 0x999999, fillBlend: 1, fill2Opacity: 0, fill2Color: 0xefefef, fill2Blend: 0,
};

// The kit's Glass panel: Light 0 at 25%, Refraction 70, Depth 30, Dispersion 20, Frost 6, Splay 20
const KIT_LENS: Material = { splay: 0.2, cornerSplay: 2, thickness: 30, refraction: 70, dispersion: 0.2, edgeW: 1.25 };

// Preset 1, dark: the material settled on 2026-09-19
export const PRESET1_BARS: Material = {
  bright: 1, cast: 0.04, cornerSplay: 1, dispersion: 0.2, edgeW: 0, fill2Blend: 0, fill2Color: 0xefefef, fill2Opacity: 0,
  fillBlend: 1, fillColor: 0x999999, fillOpacity: 0, frost: 4, glow: 0.16, glowDepth: 10, haze: 0.5, hazeAdapt: 0.7,
  hazeBlack: 1, hazeL: 0.2, light: 0.35, outline: 0.35, pillBlur: 4, pillOpacity: 0.4, pillSrgb: 1, refraction: 70, shade: 0,
  shadeDepth: 30, sideShadow: 0.35, sideW: 0.5, splay: 0.3, thickness: 30,
};

// Preset 1, light: matched to the phone's light tab bar on 2026-10-11
export const PRESET1_LIGHT: Material = {
  bright: 1, grazing: 0.03, cast: 0.03, cornerSplay: 1, dispersion: 0.2, edgeW: 0, fill2Blend: 0, fill2Color: 0xfefefe,
  fill2Opacity: 0.5, fillBlend: 1, fillColor: 0xf8f8f8, fillOpacity: 0.2, frost: 4, glow: 0.16, glowDepth: 10, haze: 0,
  hazeAdapt: 0, hazeBlack: 0, hazeL: 0.2, light: 0.25, outline: 0.14, pillBlur: 4, pillOpacity: 0.07, pillSrgb: 1,
  refraction: 70, shade: 0.1, shadeDepth: 36, sideShadow: 0.1, sideW: 1, splay: 0.3, thickness: 30,
};

// The sheet family has no saved preset: the lab uses iOS 26 device, measured
export const SHEET_DARK: Material = { ...KIT_LENS, frost: 30, light: 0.25, haze: 0.85, hazeL: 0.12, hazeAdapt: 0, hazeBlack: 0, bright: 1 };
export const SHEET_LIGHT: Material = { ...KIT_LENS, frost: 30, light: 0.25, haze: 0.85, hazeL: 0.92, hazeAdapt: 0, hazeBlack: 0, bright: 1 };

// The context rule's and the top edge effect's numbers, read off the phone
// (`dockAbove`: the dock's band starts this far above its glass)
export const CTXV = { dark: 0.4, light: 0.5, fade: 0.25, dim: 0.55, white: 0.6, reach: 34, dockAbove: 20, blur: 5, fadeIn: 40 };

export const iorFor = (P: Material) =>
  1 + (P.refraction !== undefined ? P.refraction : P.ior !== undefined ? (P.ior - 1) / 0.00714 : 70) * 0.00714;

export const bezelFor = (P: Material, w: number, h: number) => Math.max(0.01, P.splay) * Math.min(w, h);

/** One material family (bars and buttons, or the sheet): the live values for the page's appearance, and both sides. */
export type Family = {
  P: Material;
  onParams: (fn: (P: Material) => void) => () => void;
  sideValues: (side: Side) => Readonly<Material>;
  setAppearance: (side: Side) => void;
};

export function createFamily(dark: Material, light: Material, appearance: Side): Family {
  const sides: Record<Side, Material> = { dark: { ...SHADOW_OFF, ...dark }, light: { ...SHADOW_OFF, ...light } };
  const P: Material = { ...sides[appearance] };
  const listeners: ((P: Material) => void)[] = [];
  return {
    P,
    onParams: (fn) => {
      listeners.push(fn);
      return () => {
        const i = listeners.indexOf(fn);
        if (i >= 0) listeners.splice(i, 1);
      };
    },
    sideValues: (side) => sides[side],
    setAppearance: (side) => {
      for (const k of Object.keys(P)) delete P[k];
      Object.assign(P, sides[side]);
      listeners.forEach((fn) => fn(P));
    },
  };
}
