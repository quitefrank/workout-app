# Canvas Glass (the Glass Lab's renderer in the app) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every glass surface in the app is drawn by the Glass Lab V3 WebGPU shader with Frank's Preset 1, over a canvas copy of the page, exactly as the lab draws its programme screen.

**Architecture:** The lab keeps real DOM elements for layout and paints each one into a 2D canvas at its box (`box(el)`), then a WebGPU pass refracts that canvas under glass meshes placed at the glass elements' boxes, with the glass controls' own symbols and labels left as DOM on top. The app does the same. Its HTML stays the layout, hit-test and accessibility layer; a generic painter turns it into a display list and paints it into the content canvas; an opaque WebGPU canvas sits over the HTML with `pointer-events: none` (so taps reach the real links underneath) and under every `.glass` element (whose labels and inputs stay live DOM above it). The lab's material, frost, scroll edge effect, context rule and capsule are ported from `docs/lab/glass-lab-v3.html` line for line, with one change: an element's width, height and radius become uniforms, because the app's glass resizes (the timer pill) and appears per route. Browsers without WebGPU keep the CSS material and the DOM-sampling context rule that exist today.

**Tech Stack:** three@0.186.0 (`three/webgpu`, `three/tsl`, the lab's exact version), Next.js 16 client components, Canvas 2D, Vitest (jsdom) for the pure modules, Playwright (Chrome, which has WebGPU) for screenshots.

---

## Context for the implementer

Read these first:

- `CLAUDE.md` at the repo root, sections "Glass context rule" and "App".
- `docs/lab/glass-lab-v3.html` (gitignored, local only). The module script starts at line 3840. Line numbers below refer to this file as it is on 2026-10-12. Some lines elsewhere in it are megabytes long (inlined fonts and symbols); read it with `sed -n 'A,Bp' | cut -c1-900`, never whole.
- `docs/lab/glass-presets.md` for where the numbers come from.

Frank's decision (2026-10-12): the app paints its screens in canvas so the lab's glass runs on them. Do not approximate the material in CSS on WebGPU browsers, and do not invent effects the lab does not have. When this plan says "port", copy the lab's code and its comments, changing only what the step names.

Facts the plan relies on:

- The lab's live material is the `tuning` row `three-bars` of the V3 artifact (https://claude.ai/artifact/8eSmBSNFc9Aqo1bwH9eKZ4), version 204 on 2026-10-12, mode `preset1`. Its dark and light sides equal the lab's `PRESET1_BARS` and `PRESET1_LIGHT` constants (lines 3285 and 3290). The sheet family has no saved preset; it uses `deviceSheet` (lines 3248 and 3256).
- Every preset carries `SHADOW_OFF` underneath it (line 3274). `PRESET1_BARS` has no `grazing` key, so dark grazing is `SHADOW_OFF.grazing` = 0.35.
- The lab's context rule and edge numbers: `CTXV` (line 4271). Only the top edge is drawn; Frank removed the dock's on 2026-10-11.
- The app already marks units: `data-glass-unit="top" | "dock" | "box"` (TopBar, tab bar, active workout bottom bar, hero action rows), `data-edge="soft" | "dim"` on the top bar, `data-glass-bar` on the top bar's 44pt row. Sheets carry `data-glass-skip`. A `.glass` outside any unit is its own unit.
- WebGPU exists in the Playwright MCP's Chrome (`navigator.gpu` is true) and on Frank's iPhone (the lab runs there).

House rules: no em dashes anywhere (code, comments, docs, commits); Conventional Commit prefixes; commit messages end with the `Co-Authored-By` line; never print keys; never run `supabase db reset`.

## File map

| File | Responsibility |
|---|---|
| `src/glass/presets.ts` | Preset 1 (both sides), the sheet preset, `SHADOW_OFF`, `CTXV`, `FROST_SIGMA`, `iorFor`, `bezelFor`, and the family object (`P`, `onParams`, `sideValues`) the shader reads |
| `src/glass/context.ts` | The context rule's pure maths: hysteresis, crossfade step, side blend |
| `src/glass/engine/materials.ts` | `makeUniforms`, `makeCastMaterial`, `makeGlassMaterial` (lab lines 3955 to 4212), with size uniforms |
| `src/glass/engine/frost.ts` | `makeFrost` (lab lines 4234 to 4267) |
| `src/glass/engine/stage.ts` | The render loop: content canvas, page pass with the edge effect, frosts, meshes per glass element, units, capsule (lab `makeGpu`, lines 4275 to 4501), for a DOM whose glass comes and goes |
| `src/glass/paint/css.ts` | Pure parsers for computed `background-image` gradients, `box-shadow`, `border-radius` |
| `src/glass/paint/display-list.ts` | Walks the DOM into a display list in document coordinates |
| `src/glass/paint/paint.ts` | Paints a display list into the content canvas at a scroll position |
| `src/glass/paint/svg.ts` | An `<svg>` with its computed styles inlined, as an image |
| `src/glass/glass-stage.tsx` | Client component: feature detection, the canvas element, wiring the stage to the app's DOM |
| `src/app/globals.css` | `html.gpu` rules: CSS material off, CSS edge off, DOM capsule off, z-order |
| `src/app/layout.tsx` | Mounts `GlassStage` |
| `src/components/sheet.tsx`, `src/components/tab-bar.tsx` | `data-scrim`, `sheet-open`, `data-glass-pill` hooks |
| `src/components/glass-context.tsx` | Stands down when `html.gpu` is set |

---

### Task 1: Commit the CSS path as the fallback

The working tree holds the CSS port of the context rule and the pinned TopBar. It becomes the non-WebGPU path.

**Files:**
- Modify: none beyond what is in the tree.

- [ ] **Step 1: Run the suite and the build**

Run: `bun run test && bun run build`
Expected: all tests pass, build ends with the route table and no errors.

- [ ] **Step 2: Lint**

Run: `bun run lint`
Expected: no errors in `src/components/glass-context.tsx`, `src/components/top-bar.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app src/components
git commit -m "$(cat <<'EOF'
feat(glass): pinned top bar, units and the context rule in CSS

The fallback for browsers without WebGPU: a unit reads the page behind it from the DOM and takes Preset 1's dark or light side, and the top bar has the lab's soft or dim scroll edge.

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: three.js

**Files:**
- Modify: `package.json`, `bun.lock`

- [ ] **Step 1: Install the lab's version**

Run: `bun add three@0.186.0 && bun add -d @types/three@0.180.0`
Expected: both added. (`@types/three` lags three; the engine files type TSL loosely, see Task 5.)

- [ ] **Step 2: Check the entry points resolve in a client bundle**

Create `src/glass/engine/probe.ts`:

```ts
export async function probe(): Promise<boolean> {
  const THREE = await import("three/webgpu");
  const TSL = await import("three/tsl");
  return typeof THREE.WebGPURenderer === "function" && typeof TSL.Fn === "function";
}
```

Run: `bun run build`
Expected: build passes. Then delete `src/glass/engine/probe.ts`.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lock
git commit -m "chore: add three 0.186.0, the Glass Lab's renderer

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Presets

**Files:**
- Create: `src/glass/presets.ts`
- Test: `src/glass/__tests__/presets.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
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

  it("the sheet is the measured device sheet", () => {
    expect(SHEET_DARK.frost).toBe(30);
    expect(SHEET_DARK.hazeL).toBe(0.12);
    expect(SHEET_LIGHT.hazeL).toBe(0.92);
    expect(SHEET_DARK.cornerSplay).toBe(2);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/glass/__tests__/presets.test.ts`
Expected: FAIL, cannot resolve `../presets`.

- [ ] **Step 3: Write `src/glass/presets.ts`**

```ts
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
export const CTXV = { dark: 0.4, light: 0.5, fade: 0.25, dim: 0.55, white: 0.6, reach: 34, blur: 5, fadeIn: 40 };

export const iorFor = (P: Material) =>
  1 + (P.refraction !== undefined ? P.refraction : P.ior !== undefined ? (P.ior - 1) / 0.00714 : 70) * 0.00714;

export const bezelFor = (P: Material, w: number, h: number) => Math.max(0.01, P.splay) * Math.min(w, h);

/** One material family (bars and buttons, or the sheet): the live values for the page's appearance, and both sides. */
export type Family = {
  P: Material;
  onParams: (fn: (P: Material) => void) => void;
  sideValues: (side: Side) => Material;
  setAppearance: (side: Side) => void;
};

export function createFamily(dark: Material, light: Material, appearance: Side): Family {
  const sides: Record<Side, Material> = { dark: { ...SHADOW_OFF, ...dark }, light: { ...SHADOW_OFF, ...light } };
  const P: Material = { ...sides[appearance] };
  const listeners: ((P: Material) => void)[] = [];
  return {
    P,
    onParams: (fn) => listeners.push(fn),
    sideValues: (side) => sides[side],
    setAppearance: (side) => {
      Object.assign(P, sides[side]);
      listeners.forEach((fn) => fn(P));
    },
  };
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `bun run test src/glass/__tests__/presets.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/glass/presets.ts src/glass/__tests__/presets.test.ts
git commit -m "feat(glass): Preset 1 and the sheet preset from the Glass Lab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: The context rule's maths

The lab's `stepContext` and `sideBlend` (lines 4395 to 4420) mix DOM and maths. The maths moves here so it can be tested.

**Files:**
- Create: `src/glass/context.ts`
- Test: `src/glass/__tests__/context.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { blendSides, decideDark, lerpRgb, stepSide } from "../context";

describe("context rule", () => {
  it("first reading splits at 0.45", () => {
    expect(decideDark(null, 0.44)).toBe(true);
    expect(decideDark(null, 0.46)).toBe(false);
  });

  it("hysteresis: dark until 0.50, light until 0.40", () => {
    expect(decideDark(true, 0.48)).toBe(true);
    expect(decideDark(true, 0.5)).toBe(false);
    expect(decideDark(false, 0.42)).toBe(false);
    expect(decideDark(false, 0.39)).toBe(true);
  });

  it("the side moves linearly over the fade, jumping on the first frame", () => {
    expect(stepSide(null, 1, 16, 250)).toBe(1);
    expect(stepSide(0, 1, 125, 250)).toBeCloseTo(0.5);
    expect(stepSide(0.9, 1, 125, 250)).toBe(1);
    expect(stepSide(0.5, 0, 50, 250)).toBeCloseTo(0.3);
  });

  it("colours mix per channel on the 0xRRGGBB integers", () => {
    expect(lerpRgb(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(lerpRgb(0xff0000, 0x0000ff, 1)).toBe(0x0000ff);
  });

  it("numbers mix, blends and lens mode switch at 0.5", () => {
    const o = blendSides({ light: 0.25, fillBlend: 1, fillColor: 0xf8f8f8 }, { light: 0.35, fillBlend: 0, fillColor: 0x999999 }, 0.4);
    expect(o.light).toBeCloseTo(0.29);
    expect(o.fillBlend).toBe(1);
    expect(o.fillColor).toBe(lerpRgb(0xf8f8f8, 0x999999, 0.4));
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/glass/__tests__/context.test.ts`
Expected: FAIL, cannot resolve `../context`.

- [ ] **Step 3: Write `src/glass/context.ts`**

```ts
import { CTXV, type Material } from "./presets";

/**
 * The context rule (lab lines 4395 to 4420). Each small control reads the page under it and takes the side of its preset
 * that suits it: the dark side over dark content, the light side over light, whatever the appearance. Dark below 0.40,
 * light again above 0.50, so a control on a boundary does not flicker; the move is a 0.25s crossfade of every value.
 */

export function decideDark(onDark: boolean | null, avgL: number): boolean {
  if (onDark === null) return avgL < (CTXV.dark + CTXV.light) / 2;
  return onDark ? avgL < CTXV.light : avgL < CTXV.dark;
}

/** s: 0 = light, 1 = dark, moving linearly at dt / fade; the first frame jumps straight to the goal */
export function stepSide(s: number | null, goal: number, dt: number, fadeMs: number): number {
  if (s === null) return goal;
  const span = Math.max(1, fadeMs);
  return goal > s ? Math.min(goal, s + dt / span) : Math.max(goal, s - dt / span);
}

export function lerpRgb(a: number, b: number, t: number): number {
  const c = (x: number, sh: number) => (x >> sh) & 255;
  let o = 0;
  for (const sh of [16, 8, 0]) o |= Math.round(c(a, sh) + (c(b, sh) - c(a, sh)) * t) << sh;
  return o;
}

/** Light side A to dark side B at t */
export function blendSides(A: Material, B: Material, t: number): Material {
  const o: Material = {};
  for (const k of new Set([...Object.keys(A), ...Object.keys(B)])) {
    const a = A[k];
    const b = B[k];
    if (typeof a !== "number" || typeof b !== "number") o[k] = t < 0.5 ? a : b;
    else if (/Color$/.test(k)) o[k] = lerpRgb(a, b, t);
    else if (/Blend$|Srgb$|^lensMode$/.test(k)) o[k] = t < 0.5 ? a : b;
    else o[k] = a + (b - a) * t;
  }
  return o;
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `bun run test src/glass/__tests__/context.test.ts`
Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add src/glass/context.ts src/glass/__tests__/context.test.ts
git commit -m "feat(glass): the context rule's hysteresis and crossfade, from the lab

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: The glass material

Port of lab lines 3952 to 4212. Changes from the lab, and only these:

1. `w`, `h` and `r` are uniforms (`U.w`, `U.h`, `U.r`) set by the stage every frame, so one material serves an element whose size changes. Every expression that used the numbers uses the uniforms: `half`, `radius`, `innerHalf`, `quad`, the cast's `quad`. The mesh is a 1x1 plane scaled by the stage.
2. `bezel` is a uniform updated from the size and the live values (`U.setSize`), in place of `U.bezels`.
3. Lens 1 (DialKit's whole-body lens) is left out: no preset uses it (`lensMode` 0 everywhere) and Frank did not want the body bent (2026-10-11). The `taps` list keeps the three dispersion taps.
4. `DPR` and `AA` come from the stage (`ctx.dpr`).
5. TSL is typed loosely: `const T = TSL as any` and `THREE as any`. TSL's own typings fight its builder style; the lab is plain JavaScript.

**Files:**
- Create: `src/glass/engine/materials.ts`

- [ ] **Step 1: Write the module**

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * The Glass Lab V3's glass material (docs/lab/glass-lab-v3.html, lines 3952 to 4212), ported. The lab's comments are kept.
 * Changes: size and radius are uniforms; lens 1 is left out; DPR comes from the stage.
 */
import { bezelFor, iorFor, type Family, type Material } from "../presets";

export const GLASS_MARGIN = 4;
export const CAST_MARGIN = 32;

export type Uniforms = Record<string, any> & {
  cur: Material;
  apply: (p: Material) => void;
  setSize: (w: number, h: number, r: number) => void;
  override?: () => Material | null;
  dispose: () => void;
};

export type GlassCtx = { THREE: any; T: any; W: number; H: number; dpr: number; contentTex: any; blurTex: any; pillTex: any | null };

export function makeUniforms(THREE: any, T: any, family: Family): Uniforms {
  const { uniform } = T;
  const P = family.P;
  const U: any = {
    thickness: uniform(P.thickness), ior: uniform(iorFor(P)), dispersion: uniform(P.dispersion), frost: uniform(P.frost), light: uniform(P.light),
    haze: uniform(P.haze ?? 0), hazeL: uniform(P.hazeL ?? 0.46), hazeAdapt: uniform(P.hazeAdapt ?? 0), hazeBlack: uniform(P.hazeBlack ?? 0),
    bright: uniform(P.bright), cornerSplay: uniform(P.cornerSplay ?? 2), edgeW: uniform(P.edgeW ?? 1.25),
    splay: uniform(P.splay ?? 0.3), prism: uniform(P.prism ?? 0), grazing: uniform(P.grazing ?? 0.35), shade: uniform(P.shade ?? 0),
    shadeDepth: uniform(P.shadeDepth ?? 30), glow: uniform(P.glow ?? 0), glowDepth: uniform(P.glowDepth ?? 10), outline: uniform(P.outline ?? 0),
    sideShadow: uniform(P.sideShadow ?? 0), sideW: uniform(P.sideW ?? 0.5), cast: uniform(P.cast ?? 0),
    fillOpacity: uniform(P.fillOpacity ?? 0), fillBlend: uniform(P.fillBlend ?? 1), fillColor: uniform(new THREE.Vector3()),
    fill2Opacity: uniform(P.fill2Opacity ?? 0), fill2Blend: uniform(P.fill2Blend ?? 1), fill2Color: uniform(new THREE.Vector3()),
    // the element's size and corner radius in px, and the bevel width they give (set by the stage every frame)
    w: uniform(1), h: uniform(1), r: uniform(0), bezel: uniform(1),
    // the selected capsule, for the bar that holds it: centre and size in the bar's own px (set by the render loop), and
    // whether the capsule takes the extra blur (Pill blur above 0)
    pillC: uniform(new THREE.Vector2(0, 0)), pillS: uniform(new THREE.Vector2(0, 0)), pillMix: uniform(0),
    // the average brightness of the page under this element (sRGB), kept up to date by the render loop, for Adapt
    avgL: uniform(0.5),
  };
  const NOT_VALUES = new Set(["ior", "cur", "apply", "override", "setSize", "dispose", "pillC", "pillS", "pillMix", "w", "h", "r", "bezel", "avgL"]);
  // the fill colour travels as its sRGB components, untouched by colour management, since the blend happens in sRGB
  const toRgb = (u: any, c: number) => u.value.set(((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255);
  const setFill = (p: Material) => { toRgb(U.fillColor, p.fillColor ?? 0x999999); toRgb(U.fill2Color, p.fill2Color ?? 0xefefef); };
  const fitBezel = () => { const w = U.w.value, h = U.h.value; U.bezel.value = Math.max(1, Math.min(bezelFor(U.cur, w, h), w / 2, h / 2)); };
  setFill(P);
  U.cur = P;
  U.apply = (p: Material) => {
    U.cur = p;
    for (const k of Object.keys(U)) if (!NOT_VALUES.has(k) && !/Color$/.test(k) && p[k] !== undefined) U[k].value = p[k];
    U.ior.value = iorFor(p); setFill(p); fitBezel();
  };
  U.setSize = (w: number, h: number, r: number) => {
    if (U.w.value === w && U.h.value === h && U.r.value === r) return;
    U.w.value = w; U.h.value = h; U.r.value = Math.min(r, w / 2, h / 2); fitBezel();
  };
  // a control showing a blend of its two sides takes the blend; the page's side alone is the family's live values
  U.dispose = family.onParams((p) => U.apply((U.override && U.override()) || p));
  return U as Uniforms;
}

// The kit's cast shadow (Fill + Shadow's black drop shadow: 0/8, blur 15, spread 0, Normal blend, hidden behind the shape):
// a plain black quad under the glass whose alpha is the shape pushed down 8 and blurred (sigma 7.5), outside the shape
// only. Its own mesh, 32px past the element, so the glass shader's quad can stay tight.
export function makeCastMaterial(THREE: any, T: any, U: Uniforms, dpr: number) {
  const { Fn, uv, vec2, vec3, float, abs, max, min, length, smoothstep, exp } = T;
  const AA = 1 / dpr;
  const half = vec2(U.w.mul(0.5), U.h.mul(0.5)), radius = U.r, quad = vec2(U.w.add(2 * CAST_MARGIN), U.h.add(2 * CAST_MARGIN));
  const sdf = Fn(([p]: any[]) => { const q = abs(p).sub(half).add(radius); return length(max(q, vec2(0, 0))).add(min(max(q.x, q.y), float(0))).sub(radius); });
  const m = new THREE.MeshBasicNodeMaterial(); m.transparent = true; m.depthTest = false; m.depthWrite = false;
  m.colorNode = vec3(0, 0, 0);
  m.opacityNode = Fn(() => {
    const p = uv().sub(0.5).mul(quad); const d = sdf(p);
    const cov = float(1).div(float(1).add(exp(sdf(p.sub(vec2(0, -8))).mul(1.702).div(7.5))));
    return cov.mul(smoothstep(float(-AA / 2), float(AA / 2), d)).mul(U.cast);
  })();
  return m;
}

// Lens 0 (a bevel that refracts like a slab, measured against the phone).
export function makeGlassMaterial(ctx: GlassCtx, U: Uniforms) {
  const { THREE, T } = ctx;
  const { Fn, uv, vec2, vec3, float, abs, max, min, length, clamp, pow, mix, dot, normalize, refract, smoothstep, texture, positionWorld, exp, select, sRGBTransferEOTF } = T;
  const AA = 1 / ctx.dpr;
  const half = vec2(U.w.mul(0.5), U.h.mul(0.5));
  const radius = U.r;
  const screenPx = vec2(ctx.W, ctx.H);
  const bezel = U.bezel;
  const avgL = U.avgL;
  const sdf = Fn(([p]: any[]) => {
    const q = abs(p).sub(half).add(radius);
    return length(max(q, vec2(0, 0))).add(min(max(q.x, q.y), float(0))).sub(radius);
  });
  // Along a straight edge the bevel is `bezel` wide. Where the nearest edge is a rounded corner it widens to
  // cornerSplay times that (capped at the corner radius), blending in over half a radius, so a capsule's ends and a circle's
  // whole rim dome like the real material while the long edges keep the kit's rim width.
  const innerHalf = vec2(U.w.mul(0.5).sub(radius), U.h.mul(0.5).sub(radius));
  const bezelAt = Fn(([p]: any[]) => {
    const q = abs(p).sub(innerHalf);
    const cw = smoothstep(radius.mul(-0.6).sub(0.5), float(0), min(q.x, q.y));
    return mix(bezel, min(bezel.mul(U.cornerSplay), radius), cw);
  });
  const heightAt = Fn(([p]: any[]) => {
    const t = clamp(sdf(p).negate().div(bezelAt(p)), 0, 1);
    return pow(float(1).sub(pow(float(1).sub(t), 4)), 0.25).mul(U.thickness);
  });
  // The quad runs GLASS_MARGIN px past the shape on every side, room for the kit's ring and slivers outside the edge
  const quad = vec2(U.w.add(2 * GLASS_MARGIN), U.h.add(2 * GLASS_MARGIN));
  // Coverage of the kit's edge layers at a point, both strictly outside the shape like the drop shadows they are: the 0.5px
  // ring past the edge, and the two slivers past the ends (the shape shrunk and pushed sideways, where that pokes out of
  // the shape). The slivers have no blur, as the kit's do not: one device pixel of coverage feather.
  const edgeCov = Fn(([p, d]: any[]) => {
    // coverage feathers are one device pixel wide and centred on the boundary, as a rasteriser's area coverage is
    const outside = smoothstep(float(-AA / 2), float(AA / 2), d);
    const ring = outside.mul(float(1).sub(smoothstep(float(0.5 - AA / 2), float(0.5 + AA / 2), d)));
    const push = U.sideW.mul(2.5), shrink = U.sideW.mul(1.5), soft = float(AA / 2);
    const sliver = (dx: any) => float(1).sub(smoothstep(soft.negate(), soft, sdf(p.sub(vec2(dx, 0))).add(shrink)));
    const side = max(sliver(push), sliver(push.negate())).mul(outside);
    return vec2(ring, side);
  });
  const mat = new THREE.MeshBasicNodeMaterial(); mat.transparent = true;
  mat.colorNode = Fn(() => {
    const p = uv().sub(0.5).mul(quad);
    const d = sdf(p);
    const e = float(0.75);
    const dhdx = heightAt(p.add(vec2(e, 0))).sub(heightAt(p.sub(vec2(e, 0)))).div(e.mul(2));
    const dhdy = heightAt(p.add(vec2(0, e))).sub(heightAt(p.sub(vec2(0, e)))).div(e.mul(2));
    const n = normalize(vec3(dhdx.negate(), dhdy.negate(), 1));
    const baseUv = positionWorld.xy.add(screenPx.mul(0.5)).div(screenPx);
    const I = vec3(0, 0, -1);
    // the frost is a full blur at any value, as Figma's is; only a frost of nearly 0 shows the sharp page
    const frostMix = smoothstep(float(0), float(0.5), U.frost);
    let col = vec3(0, 0, 0);
    // the selected capsule's footprint, where the page is read from the blurrier frost when the capsule has extra blur
    const pq = abs(p.sub(U.pillC)).sub(U.pillS.mul(0.5)).add(U.pillS.y.mul(0.5));
    const pd = length(max(pq, vec2(0, 0))).add(min(max(pq.x, pq.y), float(0))).sub(U.pillS.y.mul(0.5));
    const inPill = float(1).sub(smoothstep(float(-0.8), float(0.8), pd)).mul(U.pillMix);
    const taps: [number, [number, number, number]][] = [[-1, [1, 0, 0]], [0, [0, 1, 0]], [1, [0, 0, 1]]];
    // Prism: on the steep part of the bevel the split widens up to 9x and the read reaches up to 5x further across the glass
    const steep = smoothstep(float(0.05), float(0.45), float(1).sub(n.z)).mul(U.prism);
    for (const [k, wgt] of taps) {
      const eta = float(1).div(max(U.ior.add(U.dispersion.mul(0.08).mul(k).mul(float(1).add(steep.mul(8)))), 1.0001));
      const ray = refract(I, n, eta);
      // how far the bent ray travels before it leaves the slab; capped so a steep bevel cannot pull in content from across the screen
      const travel = min(U.thickness.div(max(abs(ray.z), 0.05)), bezel.mul(1.5)).mul(float(1).add(steep.mul(4)));
      const shifted = baseUv.add(ray.xy.mul(travel).div(screenPx));
      // the page and its frost hold sRGB bytes (the blur runs on those, as the device's does); decoded here for the optics
      const sharp = sRGBTransferEOTF(texture(ctx.contentTex, shifted).rgb);
      const soft = sRGBTransferEOTF(texture(ctx.blurTex, shifted).rgb);
      const read = mix(sharp, soft, frostMix);
      const underPill = ctx.pillTex ? mix(read, sRGBTransferEOTF(texture(ctx.pillTex, shifted).rgb), inPill) : read;
      col = col.add(underPill.mul(vec3(wgt[0], wgt[1], wgt[2])));
    }
    col = col.mul(U.bright);
    // Haze, in sRGB: the pixel's luminance pulled toward a level by scaling the colour, so chroma follows luminance. The
    // level is the slider's plus, as Adapt goes up, the page's own average brightness under this element. Black cannot be
    // scaled, so Black lift adds the luminance it is short of as grey. The lighten floor for the heavy pulls (over 50%) is
    // the older sheet presets'. A no-op at 0.
    // toVar() at each stage: TSL inlines a node's whole expression wherever it is read, and a fill slot reads its input three
    // times, so four slots without variables grew the shader 81-fold (seconds to compile, and the phone's GPU gave up)
    const srgb = pow(max(col, 0.0), 1 / 2.2).toVar();
    const LUMA = vec3(0.2126, 0.7152, 0.0722);
    const lum = dot(srgb, LUMA);
    const level = clamp(U.hazeL.add(avgL.mul(U.hazeAdapt)), 0, 1);
    const locked = clamp(srgb.mul(level.div(max(lum, 0.02))), 0, 1);
    const pulled = mix(srgb, locked, U.haze);
    const short = max(mix(lum, level, U.haze).sub(dot(pulled, LUMA)), 0);
    const lifted = clamp(pulled.add(short.mul(U.hazeBlack)), 0, 1);
    const floorAmt = clamp(U.haze.sub(0.5).mul(2), 0, 1);
    const tinted = max(lifted, vec3(level, level, level).mul(floorAmt));
    let s = mix(srgb, tinted, smoothstep(float(0), float(0.01), U.haze)).toVar();
    // The fill layers, blended in sRGB as Figma does, Fill 2 then Fill 1. Luminosity is the PDF/Photoshop definition: the
    // base takes the fill's luminance, keeping its hue and saturation, then the result is clipped back into range.
    const lumOf = (c: any) => dot(c, vec3(0.3, 0.59, 0.11));
    // the under slot: Normal, Plus lighter, Plus darker (0, 1, 2)
    const simpleOver = (base: any, F: any, a: any, blend: any) => {
      const normal = mix(base, F, a), lighter = clamp(base.add(F.mul(a)), 0, 1), darker = clamp(base.add(F.sub(1).mul(a)), 0, 1);
      return select(blend.lessThan(0.5), normal, select(blend.lessThan(1.5), lighter, darker));
    };
    s = simpleOver(s, U.fill2Color, U.fill2Opacity, U.fill2Blend).toVar();
    // the top slot: Normal, Luminosity, Plus lighter, Plus darker (0 to 3); the luminosity maths inline, as a TSL function
    // here stalls the GPU for seconds a frame
    {
      const F = U.fillColor, a = U.fillOpacity;
      const withLum = (() => {
        const c = s.add(lumOf(F).sub(lumOf(s)));
        const L = lumOf(c), nn = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));
        const liftedC = select(nn.lessThan(0), L.add(c.sub(L).mul(L.div(max(L.sub(nn), 0.0001)))), c);
        return select(x.greaterThan(1), L.add(liftedC.sub(L).mul(float(1).sub(L).div(max(x.sub(L), 0.0001)))), liftedC);
      })();
      const normal = mix(s, F, a), luminosity = mix(s, withLum, a), lighter = clamp(s.add(F.mul(a)), 0, 1), darker = clamp(s.add(F.sub(1).mul(a)), 0, 1);
      s = select(U.fillBlend.lessThan(0.5), normal, select(U.fillBlend.lessThan(1.5), luminosity, select(U.fillBlend.lessThan(2.5), lighter, darker))).toVar();
    }
    col = pow(s, 2.2);
    // glass reflects more at grazing angles, so the steep part of the bevel shows less of what is behind it
    const grazing = clamp(float(1).sub(n.z), 0, 1);
    col = col.mul(float(1).sub(grazing.mul(U.grazing)));
    // The kit's inner shadows, by their own geometry: each is the shape grown by 40 and pushed 40 up or down, blurred, showing
    // where that pokes back inside the shape. The plus-lighter pair is the Edge glow (blur 10), the linear-burn one from the
    // top is the Top shade (blur 30); both applied in sRGB, as Figma blends.
    const holeCov = (shiftY: number, sig: any) => { const hh = sdf(p.sub(vec2(0, shiftY))).sub(40); return float(1).div(float(1).add(exp(hh.negate().mul(1.702).div(sig)))); };
    const sigG = max(U.glowDepth.mul(0.5), 0.5), sigS = max(U.shadeDepth.mul(0.5), 0.5);
    const glowCov = holeCov(-40, sigG).add(holeCov(40, sigG));
    const shadeCov = holeCov(-40, sigS);
    const s2 = pow(max(col, 0.0), 1 / 2.2);
    col = pow(clamp(s2.add(U.glow.mul(glowCov)).sub(U.shade.mul(shadeCov)), 0, 1), 2.2);
    // Edge light, the kit's way. Two plus-lighter inner shadows offset straight up and straight down light only the edges that
    // face up or down: a band of Light size inside the edge (0.75px feather), equal top and bottom, fading to nothing at the
    // sides as the shape curves round. Light intensity scales it (25% = kit).
    const axis = vec2(0, 1);
    const nlen = length(n.xy); const ndir = n.xy.div(max(nlen, 0.0001)); const onEdge = smoothstep(float(0), float(0.02), nlen);
    const lightRel = U.light.div(0.25);
    // the band ends at least one device pixel inside the silhouette, so a Light size of 0 never puts a bright hairline on
    // the very edge where it would alias against the page
    const inset = max(U.edgeW, AA);
    const band = smoothstep(inset.add(Math.max(0.75, AA)).negate(), inset.negate(), d);
    // sixth power: the light is gone about 50 degrees round the corner, well before the tip, as in the kit's render
    const facing = pow(abs(dot(ndir, axis)), 6).mul(onEdge);
    const L1 = normalize(vec3(axis.x, axis.y, 0.5)), L2 = normalize(vec3(axis.x.negate(), axis.y.negate(), 0.5));
    // strength measured off the phone: the hairline peaks at about 2.2x the bar body, which is +0.105 in linear light at the
    // kit's 25%; the gloss is scaled with it
    const gloss = pow(max(dot(n, L1), 0), 24).add(pow(max(dot(n, L2), 0), 24)).mul(band).mul(0.06).mul(lightRel);
    const rim = band.mul(facing).mul(0.105).mul(lightRel);
    col = col.add(rim).add(gloss);
    // Past the edge the pixel is the page as it is; then the ring and the slivers darken whatever is there, glass or page
    // (linear burn: the kit's grey subtracted in sRGB), after the blend so a hairline keeps its full depth.
    const cov = edgeCov(p, d);
    const glassS = pow(max(col, 0.0), 1 / 2.2);
    const pageS = texture(ctx.contentTex, baseUv).rgb;
    const base = mix(glassS, pageS, smoothstep(float(0), float(0.8), d));
    const dark = U.outline.mul(cov.x).add(U.sideShadow.mul(cov.y));
    return sRGBTransferEOTF(clamp(base.sub(dark), 0, 1));
  })();
  mat.opacityNode = Fn(() => {
    const p = uv().sub(0.5).mul(quad); const d = sdf(p);
    const inside = float(1).sub(smoothstep(float(-0.8), float(0.8), d));
    const cov = edgeCov(p, d);
    const on = (u: any) => smoothstep(float(0), float(0.001), u);
    const edge = clamp(cov.x.mul(on(U.outline)).add(cov.y.mul(on(U.sideShadow))), 0, 1);
    return max(inside, edge);
  })();
  return mat;
}
```

- [ ] **Step 2: Type check**

Run: `bunx tsc --noEmit -p .`
Expected: no errors in `src/glass/engine/materials.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/glass/engine/materials.ts
git commit -m "feat(glass): port the Glass Lab's material, with size as uniforms

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: The frost

Port of lab lines 4226 to 4267, unchanged except `DPR` comes in as an argument and `params` is a `Family` (or the edge's fixed sigma).

**Files:**
- Create: `src/glass/engine/frost.ts`

- [ ] **Step 1: Write the module**

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { FROST_SIGMA, type Material } from "../presets";

/* The frost: a Gaussian blur of the page on the GPU, one per family because each has its own radius. Two separable passes
   into a pair of render targets a fraction of the page's size; the fraction follows the radius (halving until the sigma is
   under 2.5 texels) so the kernel is always 17 taps, and the page texture's mipmaps feed the small targets without aliasing.
   Sampling clamps at the edges, so a bar at the bottom of the screen blurs against the screen's own edge pixels, as
   backdrop-filter does. It averages the page's sRGB bytes as they are, the way the device's blur does (a blur in linear
   light comes out brighter). (Glass Lab V3, lines 4226 to 4267.) */
export type Frost = { tex: any; touch: () => void; render: (renderer: any) => void; refit: () => void; dispose: () => void };

export function makeFrost(
  THREE: any, T: any, src: any, cw: number, ch: number, dpr: number,
  source: { P: Material; onParams?: (fn: (P: Material) => void) => () => void },
  sigmaOf: (P: Material) => number = (P) => Math.max(0, P.frost) * FROST_SIGMA,
): Frost {
  const { Fn, uv, vec3, float, exp, texture, uniform } = T;
  const K = 8;
  const rt = () => { const t = new THREE.RenderTarget(4, 4, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false }); t.texture.colorSpace = THREE.NoColorSpace; return t; };
  const rtA = rt(), rtB = rt();
  const sigma = uniform(1), stepA = uniform(new THREE.Vector2(1, 0)), stepB = uniform(new THREE.Vector2(0, 1));
  const pass = (tex: any, step: any) => {
    const m = new THREE.MeshBasicNodeMaterial();
    m.colorNode = Fn(() => {
      let acc = vec3(0, 0, 0), wsum = float(0);
      for (let i = -K; i <= K; i++) {
        const wgt = exp(float(-i * i).div(sigma.mul(sigma).mul(2)));
        acc = acc.add(texture(tex, uv().add(step.mul(i))).rgb.mul(wgt)); wsum = wsum.add(wgt);
      }
      return acc.div(wsum);
    })();
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m)); return scene;
  };
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); camera.position.z = 1;
  const sceneA = pass(src, stepA), sceneB = pass(rtA.texture, stepB);
  let scale = 0, dirty = true;
  const fit = () => {
    const sd = sigmaOf(source.P) * dpr; // Figma's number to a sigma, in page texels
    const s = Math.min(0.5, Math.max(1 / 32, Math.pow(2, -Math.ceil(Math.log2(Math.max(sd, 0.01) / 2.5)))));
    if (s !== scale) { scale = s; const w = Math.max(4, Math.round(cw * s)), h = Math.max(4, Math.round(ch * s)); rtA.setSize(w, h); rtB.setSize(w, h); stepA.value.set(1 / w, 0); stepB.value.set(0, 1 / h); }
    sigma.value = Math.max(0.05, sd * scale); dirty = true;
  };
  fit(); const off = source.onParams?.(fit);
  return {
    tex: rtB.texture,
    touch: () => { dirty = true; },
    refit: fit,
    dispose: () => { off?.(); rtA.dispose(); rtB.dispose(); },
    // the passes run only when the page or the radius changed; the targets keep the result between frames
    render: (renderer: any) => { if (!dirty) return; dirty = false; renderer.setRenderTarget(rtA); renderer.render(sceneA, camera); renderer.setRenderTarget(rtB); renderer.render(sceneB, camera); renderer.setRenderTarget(null); },
  };
}
```

- [ ] **Step 2: Type check and commit**

Run: `bunx tsc --noEmit -p .`
Expected: no errors in `src/glass/engine/frost.ts`.

```bash
git add src/glass/engine/frost.ts
git commit -m "feat(glass): port the Glass Lab's frost

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: CSS parsers for the painter

The painter reads computed styles. Computed values are normalised by the browser (colours as `rgb()`/`rgba()`, lengths in px), so the parsers handle that form only.

**Files:**
- Create: `src/glass/paint/css.ts`
- Test: `src/glass/__tests__/css.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { gradientLine, parseBoxShadows, parseColor, parseLinearGradients, splitTopLevel } from "../paint/css";

describe("computed CSS parsers", () => {
  it("splits on top-level commas only", () => {
    expect(splitTopLevel("linear-gradient(red, blue), linear-gradient(rgb(1, 2, 3), green)")).toEqual([
      "linear-gradient(red, blue)",
      "linear-gradient(rgb(1, 2, 3), green)",
    ]);
  });

  it("parses rgb and rgba", () => {
    expect(parseColor("rgb(255, 0, 10)")).toEqual([255, 0, 10, 1]);
    expect(parseColor("rgba(0, 0, 0, 0.3)")).toEqual([0, 0, 0, 0.3]);
    expect(parseColor("rgb(0 0 0 / 55%)")).toEqual([0, 0, 0, 0.55]);
    expect(parseColor("transparent")).toEqual([0, 0, 0, 0]);
  });

  it("parses a gradient with an angle and plain stops", () => {
    const [g] = parseLinearGradients("linear-gradient(160deg, rgb(201, 89, 50), rgb(81, 18, 9))");
    expect(g.angle).toBe(160);
    expect(g.stops).toEqual([
      { color: "rgb(201, 89, 50)", pos: 0 },
      { color: "rgb(81, 18, 9)", pos: 1 },
    ]);
  });

  it("defaults to bottom, reads side keywords and percentage stops, fills missing positions", () => {
    const [g] = parseLinearGradients("linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0) 25%, rgba(0, 0, 0, 0) 45%, rgba(0, 0, 0, 0.6))");
    expect(g.angle).toBe(180);
    expect(g.stops.map((s) => s.pos)).toEqual([0, 0.25, 0.45, 1]);
    const [h] = parseLinearGradients("linear-gradient(to right, rgb(0, 0, 0), rgb(1, 1, 1))");
    expect(h.angle).toBe(90);
  });

  it("ignores non-gradient layers", () => {
    expect(parseLinearGradients("none")).toEqual([]);
    expect(parseLinearGradients('url("a.png")')).toEqual([]);
  });

  it("gradient line follows the CSS spec", () => {
    const l = gradientLine(180, 100, 50);
    expect(l).toEqual({ x0: 50, y0: 0, x1: 50, y1: 50 });
    const d = gradientLine(90, 100, 50);
    expect(d.x0).toBeCloseTo(0);
    expect(d.x1).toBeCloseTo(100);
  });

  it("parses box shadows, inset and outer", () => {
    expect(parseBoxShadows("rgba(60, 60, 67, 0.29) 0px 0.5px 0px 0px inset")).toEqual([
      { color: "rgba(60, 60, 67, 0.29)", x: 0, y: 0.5, blur: 0, spread: 0, inset: true },
    ]);
    expect(parseBoxShadows("rgba(0, 0, 0, 0.12) 0px 3px 8px 0px, rgba(0, 0, 0, 0.04) 0px 3px 1px 0px")).toHaveLength(2);
    expect(parseBoxShadows("none")).toEqual([]);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `bun run test src/glass/__tests__/css.test.ts`
Expected: FAIL, cannot resolve `../paint/css`.

- [ ] **Step 3: Write `src/glass/paint/css.ts`**

```ts
/** Parsers for computed CSS values (the browser has already resolved colours to rgb() and lengths to px). */

export type Rgba = [number, number, number, number];
export type Stop = { color: string; pos: number };
export type Gradient = { angle: number; stops: Stop[] };
export type Shadow = { color: string; x: number; y: number; blur: number; spread: number; inset: boolean };

export function splitTopLevel(s: string, sep = ","): string[] {
  const out: string[] = [];
  let depth = 0, start = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    else if (ch === sep && depth === 0) { out.push(s.slice(start, i).trim()); start = i + 1; }
  }
  const last = s.slice(start).trim();
  if (last) out.push(last);
  return out;
}

export function parseColor(c: string): Rgba | null {
  if (c === "transparent") return [0, 0, 0, 0];
  const m = c.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)/);
  if (!m) return null;
  let a = m[4] == null ? 1 : parseFloat(m[4]);
  if (m[4]?.endsWith("%")) a /= 100;
  return [Number(m[1]), Number(m[2]), Number(m[3]), a];
}

const SIDES: Record<string, number> = { "to top": 0, "to right": 90, "to bottom": 180, "to left": 270 };

export function parseLinearGradients(value: string): Gradient[] {
  if (!value || value === "none") return [];
  const out: Gradient[] = [];
  for (const layer of splitTopLevel(value)) {
    const m = layer.match(/^linear-gradient\((.*)\)$/s);
    if (!m) continue;
    const parts = splitTopLevel(m[1]);
    let angle = 180;
    if (/^-?[\d.]+deg$/.test(parts[0])) angle = parseFloat(parts.shift()!);
    else if (parts[0] in SIDES) angle = SIDES[parts.shift()!];
    else if (/^to /.test(parts[0])) parts.shift(); // corners: rare in this app, drawn top to bottom
    const raw = parts.map((p) => {
      const pm = p.match(/^(rgba?\([^)]*\)|transparent)\s*([\d.]+%)?$/);
      return { color: pm ? pm[1] : p, pos: pm && pm[2] ? parseFloat(pm[2]) / 100 : null };
    });
    out.push({ angle, stops: fillPositions(raw) });
  }
  return out;
}

function fillPositions(raw: { color: string; pos: number | null }[]): Stop[] {
  const n = raw.length;
  const pos = raw.map((s) => s.pos);
  if (pos[0] == null) pos[0] = 0;
  if (pos[n - 1] == null) pos[n - 1] = 1;
  for (let i = 1; i < n; i++) {
    if (pos[i] != null) continue;
    let j = i;
    while (pos[j] == null) j++;
    const a = pos[i - 1]!, b = pos[j]!;
    for (let k = i; k < j; k++) pos[k] = a + ((b - a) * (k - i + 1)) / (j - i + 1);
  }
  return raw.map((s, i) => ({ color: s.color, pos: pos[i]! }));
}

/** The CSS gradient line for an angle over a w x h box (CSS Images 3, linear-gradient) */
export function gradientLine(angle: number, w: number, h: number) {
  const a = (angle * Math.PI) / 180;
  const L = Math.abs(w * Math.sin(a)) + Math.abs(h * Math.cos(a));
  const dx = (Math.sin(a) * L) / 2, dy = (-Math.cos(a) * L) / 2;
  const round = (v: number) => Math.round(v * 1e6) / 1e6;
  return { x0: round(w / 2 - dx), y0: round(h / 2 - dy), x1: round(w / 2 + dx), y1: round(h / 2 + dy) };
}

export function parseBoxShadows(value: string): Shadow[] {
  if (!value || value === "none") return [];
  return splitTopLevel(value).map((s) => {
    const color = s.match(/rgba?\([^)]*\)/)?.[0] ?? "rgb(0, 0, 0)";
    const nums = s.replace(color, "").match(/-?[\d.]+px/g)?.map(parseFloat) ?? [];
    return { color, x: nums[0] ?? 0, y: nums[1] ?? 0, blur: nums[2] ?? 0, spread: nums[3] ?? 0, inset: /\binset\b/.test(s) };
  });
}
```

- [ ] **Step 4: Run it to see it pass**

Run: `bun run test src/glass/__tests__/css.test.ts`
Expected: 7 passed.

- [ ] **Step 5: Commit**

```bash
git add src/glass/paint/css.ts src/glass/__tests__/css.test.ts
git commit -m "feat(glass): computed-style parsers for the canvas painter

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 8: SVG to image

Icons and Recharts are inline `<svg>`. Their colours come from CSS (`currentColor`, `var(--ink-2)`), which a detached image cannot resolve, so the clone gets each element's computed paint inlined.

**Files:**
- Create: `src/glass/paint/svg.ts`

- [ ] **Step 1: Write the module**

```ts
/**
 * An inline <svg> as an image the canvas can draw. The clone carries each element's computed fill, stroke, opacity and
 * font, since a detached image cannot read the page's CSS. Cached by the serialised clone; `onLoad` fires when a new
 * image finishes decoding so the stage repaints.
 */
const PAINT = ["fill", "fill-opacity", "stroke", "stroke-opacity", "stroke-width", "stroke-linecap", "stroke-linejoin", "opacity", "font-size", "font-family", "font-weight"] as const;
const cache = new Map<string, HTMLImageElement>();

export function svgImage(svg: SVGSVGElement, onLoad: () => void): HTMLImageElement | null {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  const src = [svg, ...Array.from(svg.querySelectorAll("*"))];
  const dst = [clone, ...Array.from(clone.querySelectorAll("*"))];
  src.forEach((el, i) => {
    const cs = getComputedStyle(el);
    for (const k of PAINT) dst[i].setAttribute(k, cs.getPropertyValue(k));
    dst[i].removeAttribute("class");
  });
  const r = svg.getBoundingClientRect();
  clone.setAttribute("width", String(r.width));
  clone.setAttribute("height", String(r.height));
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const hit = cache.get(xml);
  if (hit) return hit.complete && hit.naturalWidth ? hit : null;
  const img = new Image();
  img.onload = onLoad;
  img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(xml);
  cache.set(xml, img);
  if (cache.size > 400) cache.delete(cache.keys().next().value!);
  return null;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/glass/paint/svg.ts
git commit -m "feat(glass): inline svg with computed paint, as a canvas image

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 9: The display list

The lab paints each element at `box(el)` with its own font and colour (`drawText`, lines 4221 to 4232). This generalises that: walk the DOM once per layout change into a list of drawing items in document coordinates; scrolling only moves them.

What gets painted: background colours, linear gradients (all layers), border radii (per corner), borders (uniform width), outer box shadows (the first one), inset hairlines (inset shadows with no blur, the grouped list separators), text, inline `<svg>`, `<img>`, and `overflow` clipping (the horizontal template rails). What is skipped: anything inside `.glass` or `.glass-sheet` (drawn as glass, with its contents live above the canvas), `[data-live]` (inputs that stay live above the canvas), the toaster, `display: none`, `visibility: hidden`, opacity 0. A scrim marked `data-scrim="on"` is painted as `rgba(0, 0, 0, 0.2)` over the viewport, as the lab paints its sheet scrim into the page.

**Files:**
- Create: `src/glass/paint/display-list.ts`

- [ ] **Step 1: Write the module**

```ts
import { parseBoxShadows, parseColor, parseLinearGradients, type Gradient, type Shadow } from "./css";
import { svgImage } from "./svg";

export type Clip = { x: number; y: number; w: number; h: number; radii: number[]; fixed: boolean; parent: Clip | null };
type Base = { fixed: boolean; clip: Clip | null; alpha: number };
export type Item =
  | (Base & { k: "box"; x: number; y: number; w: number; h: number; radii: number[]; color: string | null; gradients: Gradient[]; shadow: Shadow | null; border: { w: number; color: string } | null })
  | (Base & { k: "line"; x: number; y: number; w: number; h: number; color: string })
  | (Base & { k: "text"; x: number; y: number; text: string; font: string; color: string; letterSpacing: string; maxWidth: number | null })
  | (Base & { k: "image"; x: number; y: number; w: number; h: number; img: CanvasImageSource });

export type DisplayList = { items: Item[]; bg: string; pending: boolean };

const SKIP = ".glass, .glass-sheet, [data-live], [data-sonner-toaster], [data-glass-canvas], script, style, template";

export function buildDisplayList(root: HTMLElement, onAsset: () => void): DisplayList {
  const items: Item[] = [];
  const sy = window.scrollY, sx = window.scrollX;
  let pending = false;
  const bg = getComputedStyle(document.body).backgroundColor;

  const walk = (el: Element, fixed: boolean, clip: Clip | null, alpha: number) => {
    if (el.matches(SKIP)) return;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    if ((el as HTMLElement).dataset?.scrim !== undefined) {
      if ((el as HTMLElement).dataset.scrim === "on") items.push({ k: "box", x: 0, y: 0, w: window.innerWidth, h: window.innerHeight, radii: [0, 0, 0, 0], color: "rgba(0, 0, 0, 0.2)", gradients: [], shadow: null, border: null, fixed: true, clip: null, alpha: 1 });
      return;
    }
    const a = alpha * Number(cs.opacity);
    if (a <= 0.001) return;
    const isFixed = fixed || cs.position === "fixed";
    const r = el.getBoundingClientRect();
    const ox = isFixed ? 0 : sx, oy = isFixed ? 0 : sy;
    const x = r.left + ox, y = r.top + oy;
    const visible = cs.visibility !== "hidden";

    if (visible && r.width > 0 && r.height > 0) {
      const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => Math.min(parseFloat(v) || 0, r.width / 2, r.height / 2));
      const color = parseColor(cs.backgroundColor);
      const gradients = parseLinearGradients(cs.backgroundImage);
      const shadows = parseBoxShadows(cs.boxShadow);
      const outer = shadows.find((s) => !s.inset) ?? null;
      const bw = parseFloat(cs.borderTopWidth) || 0;
      const bc = parseColor(cs.borderTopColor);
      const border = bw > 0 && bc && bc[3] > 0 && cs.borderTopStyle !== "none" ? { w: bw, color: cs.borderTopColor } : null;
      if ((color && color[3] > 0) || gradients.length || border) {
        items.push({ k: "box", x, y, w: r.width, h: r.height, radii, color: color && color[3] > 0 ? cs.backgroundColor : null, gradients, shadow: outer, border, fixed: isFixed, clip, alpha: a });
      }
      // inset hairlines: the grouped list's separators (inset 0 0.5px 0 var(--sep))
      for (const s of shadows) {
        if (!s.inset || s.blur || s.spread) continue;
        if (s.y > 0) items.push({ k: "line", x, y, w: r.width, h: s.y, color: s.color, fixed: isFixed, clip, alpha: a });
        if (s.y < 0) items.push({ k: "line", x, y: y + r.height + s.y, w: r.width, h: -s.y, color: s.color, fixed: isFixed, clip, alpha: a });
      }
      if (el instanceof SVGSVGElement) {
        const img = svgImage(el, onAsset);
        if (img) items.push({ k: "image", x, y, w: r.width, h: r.height, img, fixed: isFixed, clip, alpha: a });
        else pending = true;
        return;
      }
      if (el instanceof HTMLImageElement) {
        if (el.complete && el.naturalWidth) items.push({ k: "image", x, y, w: r.width, h: r.height, img: el, fixed: isFixed, clip, alpha: a });
        else { pending = true; el.addEventListener("load", onAsset, { once: true }); }
        return;
      }
    }

    let childClip = clip;
    if (cs.overflowX !== "visible" || cs.overflowY !== "visible") {
      const radii = [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius].map((v) => parseFloat(v) || 0);
      childClip = { x, y, w: r.width, h: r.height, radii, fixed: isFixed, parent: clip };
    }

    for (const node of Array.from(el.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        if (visible) text(node as Text, el as HTMLElement, cs, isFixed, childClip, a);
      } else if (node.nodeType === Node.ELEMENT_NODE) {
        walk(node as Element, isFixed, childClip, a);
      }
    }
  };

  const text = (node: Text, parent: HTMLElement, cs: CSSStyleDeclaration, fixed: boolean, clip: Clip | null, alpha: number) => {
    const raw = node.data;
    if (!raw.trim()) return;
    const transform = cs.textTransform;
    const font = `${cs.fontStyle} ${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    const ox = fixed ? 0 : sx, oy = fixed ? 0 : sy;
    const range = document.createRange();
    range.selectNodeContents(node);
    const rects = Array.from(range.getClientRects()).filter((q) => q.width > 0);
    if (!rects.length) return;
    // one line per distinct line box; a wrapped node is split where the characters' tops change
    const lines: { start: number; end: number; rect: DOMRect }[] = [];
    if (rects.length === 1) lines.push({ start: 0, end: raw.length, rect: rects[0] });
    else {
      let start = 0, top: number | null = null, rect: DOMRect | null = null;
      for (let i = 0; i < raw.length; i++) {
        range.setStart(node, i); range.setEnd(node, i + 1);
        const q = range.getBoundingClientRect();
        if (q.width === 0 && q.height === 0) continue;
        if (top !== null && Math.abs(q.top - top) > 2) { lines.push({ start, end: i, rect: rect! }); start = i; rect = null; }
        top = q.top;
        rect = rect ? new DOMRect(rect.left, rect.top, q.right - rect.left, Math.max(rect.height, q.height)) : q;
      }
      if (rect) lines.push({ start, end: raw.length, rect });
    }
    const truncate = cs.textOverflow === "ellipsis" && parent.scrollWidth > parent.clientWidth;
    const fontSize = parseFloat(cs.fontSize);
    for (const ln of lines) {
      let t = raw.slice(ln.start, ln.end).replace(/\s+/g, " ");
      if (ln === lines[0]) t = t.trimStart();
      if (ln === lines[lines.length - 1]) t = t.trimEnd();
      if (transform === "uppercase") t = t.toUpperCase();
      else if (transform === "lowercase") t = t.toLowerCase();
      // the baseline: the line box's centre plus the font's ascent minus half its height (0.8 and 0.2 of the em for SF)
      const baseline = ln.rect.top + ln.rect.height / 2 + fontSize * 0.3 + oy;
      const pr = parent.getBoundingClientRect();
      items.push({ k: "text", x: ln.rect.left + ox, y: baseline, text: t, font, color: cs.color, letterSpacing: cs.letterSpacing, maxWidth: truncate ? pr.right - ln.rect.left : null, fixed, clip, alpha });
    }
  };

  walk(root, false, null, 1);
  return { items, bg, pending };
}
```

- [ ] **Step 2: Type check and commit**

Run: `bunx tsc --noEmit -p .`
Expected: no errors in `src/glass/paint/`.

```bash
git add src/glass/paint/display-list.ts
git commit -m "feat(glass): walk the page into a display list for the canvas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 10: Painting the display list

**Files:**
- Create: `src/glass/paint/paint.ts`

- [ ] **Step 1: Write the module**

```ts
import { gradientLine } from "./css";
import type { Clip, DisplayList, Item } from "./display-list";

/** Paint a display list into the content canvas (already scaled to device pixels) at the current scroll. */
export function paintList(c: CanvasRenderingContext2D, list: DisplayList, scrollX: number, scrollY: number, W: number, H: number) {
  c.fillStyle = list.bg;
  c.fillRect(0, 0, W, H);
  for (const it of list.items) {
    const dx = it.fixed ? 0 : -scrollX, dy = it.fixed ? 0 : -scrollY;
    if (!onScreen(it, dx, dy, W, H)) continue;
    c.save();
    c.globalAlpha = it.alpha;
    if (it.clip) applyClip(c, it.clip, scrollX, scrollY);
    draw(c, it, dx, dy);
    c.restore();
  }
}

function onScreen(it: Item, dx: number, dy: number, W: number, H: number) {
  if (it.k === "text") return it.y + dy > -100 && it.y + dy < H + 100;
  return it.y + dy < H && it.y + dy + it.h > 0 && it.x + dx < W && it.x + dx + it.w > 0;
}

function applyClip(c: CanvasRenderingContext2D, clip: Clip, sx: number, sy: number) {
  if (clip.parent) applyClip(c, clip.parent, sx, sy);
  const dx = clip.fixed ? 0 : -sx, dy = clip.fixed ? 0 : -sy;
  c.beginPath();
  c.roundRect(clip.x + dx, clip.y + dy, clip.w, clip.h, clip.radii);
  c.clip();
}

function draw(c: CanvasRenderingContext2D, it: Item, dx: number, dy: number) {
  switch (it.k) {
    case "box": {
      const x = it.x + dx, y = it.y + dy;
      const path = () => { c.beginPath(); c.roundRect(x, y, it.w, it.h, it.radii); };
      if (it.shadow && it.color) {
        c.save(); c.shadowColor = it.shadow.color; c.shadowBlur = it.shadow.blur; c.shadowOffsetX = it.shadow.x; c.shadowOffsetY = it.shadow.y;
        path(); c.fillStyle = it.color; c.fill(); c.restore();
      } else if (it.color) { path(); c.fillStyle = it.color; c.fill(); }
      // CSS paints the first gradient layer on top
      for (const g of [...it.gradients].reverse()) {
        const l = gradientLine(g.angle, it.w, it.h);
        const grad = c.createLinearGradient(x + l.x0, y + l.y0, x + l.x1, y + l.y1);
        for (const s of g.stops) grad.addColorStop(Math.min(1, Math.max(0, s.pos)), s.color);
        path(); c.fillStyle = grad; c.fill();
      }
      if (it.border) { c.beginPath(); c.roundRect(x + it.border.w / 2, y + it.border.w / 2, it.w - it.border.w, it.h - it.border.w, it.radii); c.lineWidth = it.border.w; c.strokeStyle = it.border.color; c.stroke(); }
      return;
    }
    case "line":
      c.fillStyle = it.color; c.fillRect(it.x + dx, it.y + dy, it.w, it.h);
      return;
    case "text": {
      c.font = it.font; c.fillStyle = it.color; c.textBaseline = "alphabetic"; c.textAlign = "left";
      if ("letterSpacing" in c) (c as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = it.letterSpacing === "normal" ? "0px" : it.letterSpacing;
      let t = it.text;
      if (it.maxWidth != null && c.measureText(t).width > it.maxWidth) {
        while (t.length > 1 && c.measureText(t + "…").width > it.maxWidth) t = t.slice(0, -1);
        t = t.trimEnd() + "…";
      }
      c.fillText(t, it.x + dx, it.y + dy);
      return;
    }
    case "image":
      c.drawImage(it.img, it.x + dx, it.y + dy, it.w, it.h);
      return;
  }
}
```

- [ ] **Step 2: Type check and commit**

Run: `bunx tsc --noEmit -p .`
Expected: no errors.

```bash
git add src/glass/paint/paint.ts
git commit -m "feat(glass): paint the display list into the content canvas

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 11: The stage

Port of the lab's `makeGpu` (lines 4275 to 4501). Changes:

1. Glass elements are found every frame (`.glass` for the bars family, `.glass-sheet` for the sheet family). A new element gets its uniforms, glass mesh and cast mesh; an element that left the DOM has its meshes disposed. Each element's size and radius go to its uniforms (`U.setSize`) and its meshes are scaled to match.
2. Units come from the DOM: an element's unit is its nearest `[data-glass-unit]`, or itself. Bands: `top` from the screen top to 34pt past `[data-glass-bar]`; `dock` from 20pt above its highest glass to the screen bottom; anything else the box round its shown controls. A unit whose element has `data-edge="dim"` is on media. `ctx-dark` / `ctx-light` go on the unit element (the lab's `.surface`).
3. The top edge comes from the top unit (`data-edge`), scrolled by `window.scrollY`. No bottom edge.
4. The capsule follows `[data-glass-pill]` (pad 2, height 54), in the bars family.
5. The page comes from `draw(cctx)` (the painter) and the signature function the caller passes.
6. The sheet family does not flip and sits at z 0.3; bars at 0.1; a glass control on a sheet at 0.4 and, like the sheet, it keeps the page's side. Sheet-open hides the dock (`html.sheet-open`), as the lab's dock steps aside.

**Files:**
- Create: `src/glass/engine/stage.ts`

- [ ] **Step 1: Write the module**

```ts
/* eslint-disable @typescript-eslint/no-explicit-any */
import { blendSides, decideDark, stepSide } from "../context";
import { CTXV, type Family, type Material } from "../presets";
import { makeFrost } from "./frost";
import { CAST_MARGIN, GLASS_MARGIN, makeCastMaterial, makeGlassMaterial, makeUniforms, type Uniforms } from "./materials";

/* The Glass Lab V3's GPU surface (lines 4275 to 4501), for the app: a canvas, a content texture the painter draws into,
   glass meshes placed from DOM rects, for whatever glass the current screen holds. */

export type StageOptions = {
  THREE: any; T: any;
  canvas: HTMLCanvasElement; W: number; H: number; dpr: number;
  bars: Family; sheet: Family;
  appearance: () => "dark" | "light";
  draw: (c: CanvasRenderingContext2D) => void;
  signature: () => string;
};

type Unit = { key: Element; s: number | null; onDark: boolean | null; els: Element[]; Us: Uniforms[] };
type Entry = { el: Element; U: Uniforms; mesh: any; cast: any; family: "bars" | "sheet"; ready: boolean };

export async function startStage(o: StageOptions): Promise<() => void> {
  const { THREE, T, canvas, W, H, dpr } = o;
  const { Fn, uv, vec2, vec3, float, abs, max, min, length, clamp, mix, smoothstep, texture, uniform, sRGBTransferEOTF } = T;
  const contentCanvas = document.createElement("canvas"); contentCanvas.width = Math.round(W * dpr); contentCanvas.height = Math.round(H * dpr);
  const cctx = contentCanvas.getContext("2d")!;
  // raw sRGB bytes (no decode on sampling): the frost averages them as they are, and the optics decode where they read
  const rawTex = new THREE.CanvasTexture(contentCanvas); rawTex.colorSpace = THREE.NoColorSpace;
  rawTex.generateMipmaps = true; rawTex.minFilter = THREE.LinearMipmapLinearFilter; rawTex.magFilter = THREE.LinearFilter;
  const cw = contentCanvas.width, ch = contentCanvas.height;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true }); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  await renderer.init();
  // The page with its scroll edge effect is rendered once into pageTex whenever the page or the effect moves; the screen
  // shows it, and the glass and its frosts read it, so a bar refracts and blurs the dimmed band it sits on, as the phone's
  // do. The edge blur alone reads the raw page.
  const pageRT = new THREE.RenderTarget(cw, ch, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
  pageRT.texture.colorSpace = THREE.NoColorSpace;
  const pageTex = pageRT.texture;
  const barsFrost = makeFrost(THREE, T, pageTex, cw, ch, dpr, o.bars);
  const sheetFrost = makeFrost(THREE, T, pageTex, cw, ch, dpr, o.sheet);
  // the capsule's frost: the bar's sigma and Pill blur added in quadrature (a blur of a blur)
  const pillFrost = makeFrost(THREE, T, pageTex, cw, ch, dpr, o.bars, (P: Material) => Math.hypot(Math.max(0, P.frost) * (2.5 / 6), P.pillBlur || 0));
  const frosts = [barsFrost, sheetFrost, pillFrost];
  const scene = new THREE.Scene(); const camera = new THREE.OrthographicCamera(-W / 2, W / 2, H / 2, -H / 2, 0.1, 100); camera.position.z = 10;
  // The scroll edge effect (Apple's soft style) behind the pinned top bar: the page is blurred progressively toward the
  // screen edge and, while the bar is on its light side, dissolved toward white; while it is on its dark side, dimmed.
  const edgeFrost = makeFrost(THREE, T, rawTex, cw, ch, dpr, { P: CTXV as unknown as Material }, () => CTXV.blur);
  const EDGE = { topS: uniform(0), topReach: uniform(0), topOn: uniform(0), topDim: uniform(0), dimAmt: uniform(CTXV.dim), whiteAmt: uniform(CTXV.white) };
  const pageMat = new THREE.MeshBasicNodeMaterial();
  pageMat.colorNode = Fn(() => {
    // a render target reads back flipped, so this pass writes the page upside down (the frost's two passes cancel out)
    const fu = vec2(uv().x, float(1).sub(uv().y));
    const sharp = texture(rawTex, fu).rgb, soft = texture(edgeFrost.tex, fu).rgb;
    const y = float(1).sub(fu.y).mul(H);
    // weight 1 at the screen edge, falling to 0 at the reach (smoothstep over the last four fifths)
    const wTop = float(1).sub(smoothstep(EDGE.topReach.mul(0.2), EDGE.topReach, y)).mul(EDGE.topOn);
    let c = mix(sharp, soft, clamp(wTop.mul(1.3), 0, 1));
    // light side: toward white; dark side: dimmed. A media edge always dims, whatever the side
    c = mix(mix(c, vec3(1, 1, 1), wTop.mul(EDGE.whiteAmt)), c.mul(float(1).sub(wTop.mul(EDGE.dimAmt))), max(EDGE.topS, EDGE.topDim));
    return c;
  })();
  const pageScene = new THREE.Scene(); pageScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), pageMat));
  const pageCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); pageCam.position.z = 1;
  const bgMat = new THREE.MeshBasicNodeMaterial(); bgMat.colorNode = sRGBTransferEOTF(texture(pageTex, uv()).rgb);
  scene.add(new THREE.Mesh(new THREE.PlaneGeometry(W, H), bgMat));

  const unit = (el: Element) => el.closest("[data-glass-unit]") ?? el;
  const units = new Map<Element, Unit>();
  const entries = new Map<Element, Entry>();
  const ctxFor = (family: "bars" | "sheet") => ({ THREE, T, W, H, dpr, contentTex: pageTex, blurTex: (family === "bars" ? barsFrost : sheetFrost).tex, pillTex: family === "bars" ? pillFrost.tex : null });

  const sideBlend = (f: Unit): Material | null => {
    if (f.s === null) return null;
    const pageDark = o.appearance() === "dark";
    if (f.s === (pageDark ? 1 : 0)) return null;
    return blendSides(o.bars.sideValues("light"), o.bars.sideValues("dark"), f.s);
  };

  const add = (el: Element, family: "bars" | "sheet") => {
    const fam = family === "bars" ? o.bars : o.sheet;
    const U = makeUniforms(THREE, T, fam);
    // a control on a sheet sits on large glass, which keeps the page's appearance, so it does not flip
    if (family === "bars" && !el.closest("[data-glass-skip]")) {
      const key = unit(el);
      let f = units.get(key);
      if (!f) { f = { key, s: null, onDark: null, els: [], Us: [] }; units.set(key, f); }
      f.els.push(el); f.Us.push(U);
      const unitRef = f;
      U.override = () => sideBlend(unitRef);
      const v = sideBlend(f); if (v) U.apply(v);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeGlassMaterial(ctxFor(family), U));
    const cast = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeCastMaterial(THREE, T, U, dpr)); cast.renderOrder = -1;
    scene.add(mesh); scene.add(cast);
    // each element's node graph is built once; build it off the frame (hidden until ready) so a screen change does not hitch
    const entry: Entry = { el, U, mesh, cast, family, ready: false };
    entries.set(el, entry);
    renderer.compileAsync(mesh, camera, scene).then(() => renderer.compileAsync(cast, camera, scene)).then(() => { entry.ready = true; }, () => { entry.ready = true; });
  };
  const remove = (e: Entry) => {
    e.U.dispose();
    scene.remove(e.mesh); scene.remove(e.cast);
    e.mesh.material.dispose(); e.cast.material.dispose(); e.mesh.geometry.dispose(); e.cast.geometry.dispose();
    entries.delete(e.el);
    for (const [key, f] of units) {
      const i = f.els.indexOf(e.el);
      if (i >= 0) { f.els.splice(i, 1); f.Us.splice(i, 1); }
      if (!f.els.length) units.delete(key);
    }
  };

  // The selected tab's capsule, drawn over the glass so the bar's content stays visible through it: a black capsule at
  // the opacity Preset 1 sets (about 0.3x the bar over black, 0.9x in light on the phone)
  const uW = uniform(80), uH = uniform(54), uAmt = uniform(0.6);
  const capsule = (p: any) => { const half = vec2(uW.mul(0.5), uH.mul(0.5)); const rad = uH.mul(0.5); const q = abs(p).sub(half).add(rad); return length(max(q, vec2(0, 0))).add(min(max(q.x, q.y), float(0))).sub(rad); };
  const pm = new THREE.MeshBasicNodeMaterial(); pm.transparent = true; pm.depthTest = false; pm.depthWrite = false;
  pm.colorNode = vec3(0, 0, 0);
  pm.opacityNode = Fn(() => { const p = uv().sub(0.5).mul(vec2(uW, uH)); return float(1).sub(smoothstep(float(-0.8), float(0.8), capsule(p))).mul(uAmt); })();
  const pillMesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), pm); pillMesh.renderOrder = 10; pillMesh.visible = false; scene.add(pillMesh);

  // Adapt and the context rule read the page's average brightness: the page kept as a small copy (one cell per 8px,
  // refreshed with the page), each footprint averaged from it in sRGB
  const AVG_CELL = 8, aw = Math.ceil(W / AVG_CELL), ah = Math.ceil(H / AVG_CELL);
  const avgCanvas = document.createElement("canvas"); avgCanvas.width = aw; avgCanvas.height = ah;
  const actx = avgCanvas.getContext("2d", { willReadFrequently: true })!;
  let avgBytes: Uint8ClampedArray | null = null;
  const avgUnder = (r: { x0: number; x1: number; y0: number; y1: number }) => {
    if (!avgBytes) return 0.5;
    const x0 = Math.max(0, Math.floor(r.x0 / AVG_CELL)), x1 = Math.min(aw, Math.ceil(r.x1 / AVG_CELL)), y0 = Math.max(0, Math.floor(r.y0 / AVG_CELL)), y1 = Math.min(ah, Math.ceil(r.y1 / AVG_CELL));
    let sum = 0, n = 0;
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const i = (y * aw + x) * 4; sum += avgBytes[i] * 0.2126 + avgBytes[i + 1] * 0.7152 + avgBytes[i + 2] * 0.0722; n++; }
    return n ? sum / n / 255 : 0.5;
  };
  const shown = (el: Element) => (el as HTMLElement).offsetParent !== null || getComputedStyle(el).position === "fixed";
  const bandOf = (f: Unit) => {
    const kind = (f.key as HTMLElement).dataset?.glassUnit;
    if (kind === "top") {
      const bar = f.key.querySelector("[data-glass-bar]") ?? f.key;
      return { x0: 0, x1: W, y0: 0, y1: bar.getBoundingClientRect().bottom + CTXV.reach };
    }
    const rs = f.els.filter(shown).map((el) => el.getBoundingClientRect());
    if (!rs.length) return null;
    if (kind === "dock") return { x0: 0, x1: W, y0: Math.min(...rs.map((q) => q.top)) - 20, y1: H };
    return { x0: Math.min(...rs.map((q) => q.left)), x1: Math.max(...rs.map((q) => q.right)), y0: Math.min(...rs.map((q) => q.top)), y1: Math.max(...rs.map((q) => q.bottom)) };
  };

  let lastSig: string | null = null, pageDirty = true, lastEdgeKey = "", lastT = performance.now(), frame = 0, stopped = false;
  const loop = () => {
    if (stopped) return;
    frame = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(100, now - lastT); lastT = now;

    // the glass on screen now
    const want = new Map<Element, "bars" | "sheet">();
    document.querySelectorAll(".glass").forEach((el) => want.set(el, "bars"));
    document.querySelectorAll(".glass-sheet").forEach((el) => want.set(el, "sheet"));
    for (const e of Array.from(entries.values())) if (!want.has(e.el)) remove(e);
    for (const [el, fam] of want) if (!entries.has(el)) add(el, fam);

    const sig = o.signature();
    if (sig !== lastSig) {
      lastSig = sig;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.draw(cctx);
      rawTex.needsUpdate = true; edgeFrost.touch(); pageDirty = true;
      actx.drawImage(contentCanvas, 0, 0, aw, ah); avgBytes = actx.getImageData(0, 0, aw, ah).data;
    }

    for (const e of entries.values()) {
      const vis = e.ready && shown(e.el) && !(e.family === "bars" && e.el.closest("[data-glass-unit='dock']") && document.documentElement.classList.contains("sheet-open"));
      e.mesh.visible = e.cast.visible = vis;
      if (!vis) continue;
      const r = e.el.getBoundingClientRect();
      const rad = parseFloat(getComputedStyle(e.el).borderTopLeftRadius) || 0;
      e.U.setSize(r.width, r.height, rad);
      // bars under the sheet, the sheet over them, a control on the sheet over the sheet
      const z = e.family === "sheet" ? 0.3 : e.el.closest(".glass-sheet") ? 0.4 : 0.1;
      const cx = r.left + r.width / 2 - W / 2, cy = H / 2 - (r.top + r.height / 2);
      e.mesh.scale.set(r.width + 2 * GLASS_MARGIN, r.height + 2 * GLASS_MARGIN, 1); e.mesh.position.set(cx, cy, z);
      e.cast.scale.set(r.width + 2 * CAST_MARGIN, r.height + 2 * CAST_MARGIN, 1); e.cast.position.set(cx, cy, z - 0.05);
      e.U.avgL.value = avgUnder({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom });
    }

    // each unit reads the page behind it as one: the band its edge effect covers when it has one, otherwise the box round
    // its visible controls. A bar over a media edge sits on the dimming, so it is on its dark side
    let top: Unit | null = null;
    for (const f of units.values()) {
      if (!f.els.some(shown)) continue;
      const band = bandOf(f);
      if (!band) continue;
      const media = (f.key as HTMLElement).dataset?.edge === "dim";
      const onDark = decideDark(f.onDark, media ? 0 : avgUnder(band));
      if (onDark !== f.onDark) { f.onDark = onDark; f.key.classList.toggle("ctx-dark", onDark); f.key.classList.toggle("ctx-light", !onDark); }
      const next = stepSide(f.s, onDark ? 1 : 0, dt, CTXV.fade * 1000);
      if (next !== f.s) { f.s = next; const v = sideBlend(f) ?? o.bars.P; f.Us.forEach((U) => U.apply(v)); }
      if ((f.key as HTMLElement).dataset?.glassUnit === "top") top = f;
    }

    // the edge effect follows its bar: the soft effect shows once content has scrolled under the bar, a media edge always
    if (top) {
      const dim = (top.key as HTMLElement).dataset.edge === "dim" ? 1 : 0;
      const bar = top.key.querySelector("[data-glass-bar]") ?? top.key;
      EDGE.topOn.value = dim || Math.min(1, Math.max(0, window.scrollY / Math.max(1, CTXV.fadeIn)));
      EDGE.topDim.value = dim; EDGE.topS.value = top.s ?? 0;
      EDGE.topReach.value = bar.getBoundingClientRect().bottom + CTXV.reach;
    } else EDGE.topOn.value = 0;

    // the page with its effects, then every frost that reads it (only when either moved)
    edgeFrost.render(renderer);
    const edgeKey = Object.values(EDGE).map((u: any) => u.value).join("|");
    if (pageDirty || edgeKey !== lastEdgeKey) {
      pageDirty = false; lastEdgeKey = edgeKey;
      renderer.setRenderTarget(pageRT); renderer.render(pageScene, pageCam); renderer.setRenderTarget(null);
      frosts.forEach((f) => f.touch());
    }
    frosts.forEach((f) => f.render(renderer));

    const pillEl = document.querySelector("[data-glass-pill]");
    const barEl = pillEl?.closest(".glass") ?? null;
    const bar = barEl ? entries.get(barEl) : undefined;
    const pillShown = !!pillEl && !!bar && bar.mesh.visible;
    const P = bar ? bar.U.cur : o.bars.P;
    pillMesh.visible = pillShown && (P.pillOpacity || 0) > 0;
    for (const e of entries.values()) if (e.family === "bars") e.U.pillMix.value = 0;
    if (pillShown && pillEl && bar) {
      bar.U.pillMix.value = (P.pillBlur || 0) > 0 ? 1 : 0;
      const r = pillEl.getBoundingClientRect(); const w = r.width + 2 * 2, h = 54;
      // Pill darkening is the share of the bar's sRGB value the capsule takes away; the blend happens in linear light
      uW.value = w; uH.value = h; uAmt.value = 1 - Math.pow(1 - Math.min(1, P.pillOpacity || 0), 2.2);
      const x = r.left + r.width / 2 - W / 2, y = H / 2 - (r.top + r.height / 2);
      pillMesh.scale.set(w, h, 1); pillMesh.position.set(x, y, 0.5);
      bar.U.pillC.value.set(x - bar.mesh.position.x, y - bar.mesh.position.y); bar.U.pillS.value.set(w, h);
    }
    renderer.render(scene, camera);
  };
  loop();

  return () => {
    stopped = true; cancelAnimationFrame(frame);
    for (const e of Array.from(entries.values())) remove(e);
    for (const f of units.values()) f.key.classList.remove("ctx-dark", "ctx-light");
    [...frosts, edgeFrost].forEach((f) => f.dispose());
    pageRT.dispose();
    renderer.dispose();
  };
}
```

- [ ] **Step 2: Type check and commit**

Run: `bunx tsc --noEmit -p .`
Expected: no errors.

```bash
git add src/glass/engine/stage.ts
git commit -m "feat(glass): port the Glass Lab's render loop for the app's DOM

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 12: GlassStage and the page hooks

**Files:**
- Create: `src/glass/glass-stage.tsx`
- Modify: `src/app/layout.tsx` (mount next to `GlassContext`)
- Modify: `src/components/sheet.tsx` (scrim marker, `sheet-open`)
- Modify: `src/components/tab-bar.tsx` (`data-glass-pill` on the selected tab)
- Modify: `src/components/glass-context.tsx` (stand down under `html.gpu`)
- Modify: `src/app/globals.css` (`html.gpu` rules)
- Modify: `src/app/workouts/[id]/exercise-card.tsx`, `src/app/workouts/[id]/active-workout.tsx`, `src/app/settings/settings-form.tsx` (`data-live` on inputs, textareas, selects outside glass)

- [ ] **Step 1: Write `src/glass/glass-stage.tsx`**

```tsx
"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { buildDisplayList, type DisplayList } from "./paint/display-list";
import { paintList } from "./paint/paint";
import { createFamily, PRESET1_BARS, PRESET1_LIGHT, SHEET_DARK, SHEET_LIGHT } from "./presets";

/**
 * The Glass Lab's renderer over the app. The page's HTML stays where it is (layout, taps, VoiceOver); this canvas sits
 * over it, opaque, with pointer-events off, and shows the page painted from that HTML with every glass element drawn by
 * the lab's shader. The glass elements' own labels and the live inputs sit above the canvas. Without WebGPU nothing
 * happens and the CSS material stays.
 */
export function GlassStage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pathname = usePathname();
  const dirty = useRef(0);

  useEffect(() => {
    dirty.current++;
  }, [pathname]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !("gpu" in navigator)) return;
    let stop: (() => void) | null = null;
    let cancelled = false;
    let list: DisplayList | null = null;
    let running = 0;
    const html = document.documentElement;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const appearance = () => (media.matches ? "dark" : "light") as "dark" | "light";
    const bars = createFamily(PRESET1_BARS, PRESET1_LIGHT, appearance());
    const sheet = createFamily(SHEET_DARK, SHEET_LIGHT, appearance());
    const bump = () => { dirty.current++; list = null; };

    const observer = new MutationObserver((records) => {
      // the stage's own class writes on units are not page changes
      if (records.every((r) => r.type === "attributes" && r.attributeName === "class" && (r.target as Element).matches?.("[data-glass-unit], .glass"))) return;
      bump();
    });
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true });
    const onTransition = (e: Event) => { running += e.type === "transitionrun" || e.type === "animationstart" ? 1 : -1; if (running < 0) running = 0; bump(); };
    const events = ["transitionrun", "transitionend", "transitioncancel", "animationstart", "animationend"];
    events.forEach((t) => document.addEventListener(t, onTransition, true));
    // a horizontal rail scrolling moves content under the glass
    const onInnerScroll = (e: Event) => { if (e.target !== document) bump(); };
    document.addEventListener("scroll", onInnerScroll, true);
    const onAppearance = () => { bars.setAppearance(appearance()); sheet.setAppearance(appearance()); bump(); };
    media.addEventListener("change", onAppearance);
    document.fonts?.ready.then(bump);

    const start = async () => {
      const [THREE, T] = await Promise.all([import("three/webgpu"), import("three/tsl")]);
      if (cancelled) return;
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(window.devicePixelRatio || 1, 3);
      canvas.style.width = W + "px"; canvas.style.height = H + "px";
      try {
        stop = await (await import("./engine/stage")).startStage({
          THREE, T, canvas, W, H, dpr, bars, sheet, appearance,
          draw: (c) => {
            if (!list) list = buildDisplayList(document.body, bump);
            paintList(c, list, window.scrollX, window.scrollY, W, H);
            if (list.pending || running > 0) list = null;
          },
          signature: () => `${window.scrollX}|${window.scrollY}|${dirty.current}|${running > 0 ? performance.now() : 0}|${appearance()}`,
        });
        if (cancelled) { stop(); return; }
        html.classList.add("gpu");
      } catch (err) {
        console.error("No WebGPU glass here, keeping the CSS material:", err);
        html.classList.remove("gpu");
      }
    };
    void start();

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(() => { stop?.(); stop = null; bump(); void start(); }, 150);
    };
    window.addEventListener("resize", onResize);

    return () => {
      cancelled = true;
      stop?.();
      html.classList.remove("gpu");
      observer.disconnect();
      events.forEach((t) => document.removeEventListener(t, onTransition, true));
      document.removeEventListener("scroll", onInnerScroll, true);
      media.removeEventListener("change", onAppearance);
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return <canvas ref={canvasRef} data-glass-canvas aria-hidden className="glass-canvas" />;
}
```

- [ ] **Step 2: Mount it**

In `src/app/layout.tsx`, import `GlassStage` from `@/glass/glass-stage` and render `<GlassStage />` right after `<GlassContext />`.

- [ ] **Step 3: Page hooks**

In `src/components/sheet.tsx`, on the scrim div add `data-scrim={open ? "on" : "off"}`, and add an effect that keeps `sheet-open` on `<html>` while any sheet is open:

```tsx
useEffect(() => {
  if (!open) return;
  document.documentElement.classList.add("sheet-open");
  return () => document.documentElement.classList.remove("sheet-open");
}, [open]);
```

In `src/components/tab-bar.tsx`, on the tab `Link` add `data-glass-pill={on ? "" : undefined}`.

In `src/components/glass-context.tsx`, first line of `run`: `if (document.documentElement.classList.contains("gpu")) return;`

Add `data-live` to every `<input>`, `<textarea>` and `<select>` that is not inside a `.glass` element: `src/app/workouts/[id]/exercise-card.tsx` lines 236, 320, 330, 463; `src/app/workouts/[id]/active-workout.tsx` line 242; `src/app/settings/settings-form.tsx` line 50. (The library search input sits inside a glass pill and needs nothing.)

- [ ] **Step 4: `html.gpu` CSS**

Append to `src/app/globals.css`:

```css
/* ------------------------------------------------------------
   WebGPU glass (GlassStage). The canvas covers the page, opaque, with
   taps passing through to the HTML under it. Glass elements keep only
   their contents; the shader draws the material, the edge effect and
   the selected capsule. Live inputs sit above the canvas.
   ------------------------------------------------------------ */
.glass-canvas {
  display: none;
}

html.gpu .glass-canvas {
  display: block;
  position: fixed;
  inset: 0;
  z-index: 5;
  pointer-events: none;
}

html.gpu .glass,
html.gpu .glass-sheet {
  z-index: 6;
  background: none;
  -webkit-backdrop-filter: none;
  backdrop-filter: none;
  box-shadow: none;
}

html.gpu .glass::before,
html.gpu .glass::after,
html.gpu .glass-sheet::before,
html.gpu .glass-sheet::after {
  display: none;
}

html.gpu .top-edge,
html.gpu [data-glass-pill] > span:first-child {
  display: none;
}

html.gpu [data-live] {
  position: relative;
  z-index: 6;
}

html.gpu [data-scrim] {
  background: transparent;
}

html.sheet-open [data-glass-unit="dock"] {
  visibility: hidden;
}
```

The `.glass` rule in `@layer components` sets `position: relative`, so `z-index: 6` applies.

- [ ] **Step 5: Build and run the suite**

Run: `bun run test && bun run build`
Expected: all tests pass; build clean.

- [ ] **Step 6: Commit**

```bash
git add src/glass/glass-stage.tsx src/app/layout.tsx src/app/globals.css src/components src/app/workouts src/app/settings
git commit -m "feat(glass): the Glass Lab's renderer over the app, CSS kept as the fallback

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 13: Check against the lab

Use the Playwright MCP browser (Chrome, WebGPU on). Viewport 375 x 812. Dev server: `bun run dev`.

- [ ] **Step 1: The lab, for reference**

Copy `docs/lab/glass-lab-v3.html` to a scratch folder, serve it (`python3 -I -m http.server 8765 --bind 127.0.0.1` from that folder), open `http://127.0.0.1:8765/glass-lab-v3.html?app=1` in light and dark, wait 4s, screenshot. Write Preset 1 into `localStorage` key `glass-lab-v3:three:bars` first (the `three-bars` row's `preset1` slot with `mode: "preset1"`), so the lab shows Frank's material and not its built-in Preset 2.

- [ ] **Step 2: The app**

For each of `/`, `/templates`, a `/templates/[id]`, `/exercises`, `/analytics`, `/workouts`, `/settings`, in light and dark: load, wait 3s, screenshot at scroll 0, scroll 400, screenshot. Then `browser_evaluate` `document.documentElement.classList.contains("gpu")` (expect true) and the console (expect no errors, no `Device Lost`).

- [ ] **Step 3: Compare and fix**

Compare the tab bar, a 44pt circle and the top edge with the lab's at the same appearance: the rim light, the lensing at the capsule's ends, the edge darkening, the haze over dark content, the capsule. Differences in the material mean the port drifted from the lab; diff `src/glass/engine/materials.ts` against lab lines 3995 to 4212 and fix the port. Differences in the page (text position, missing backgrounds) are painter bugs; fix in `src/glass/paint/`.

- [ ] **Step 4: 3x check**

Resize to 375 x 812 with deviceScaleFactor 3 (`browser_run_code_unsafe` with `page.setViewportSize` after a context with `deviceScaleFactor: 3`, or a fresh Playwright script) and confirm no `WebGPU Device Lost` in the console after scrolling for 10s.

- [ ] **Step 5: Commit any fixes**

```bash
git commit -am "fix(glass): match the lab on <what was off>

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 14: On the phone

- [ ] **Step 1: Deploy a preview**

Push a branch (`git push origin HEAD:canvas-glass`); Vercel builds a preview. Give Frank the preview URL.

- [ ] **Step 2: Frank checks on the iPhone**

He opens it in Safari and as the installed PWA, light and dark, and compares against the lab artifact in app mode. Ask him for screenshots of anything off. Do not merge to `main` until he says it matches.

---

## Later plans (in order)

1. **Phone fidelity pass.** Driven by Frank's screenshots from Task 14: painter gaps (tabular figures, letter spacing on WebKit, chart tooltips), anything the shader shows differently at 3x, shader compile hitches when a sheet first opens (warm the sheet material at start).
2. **Live inputs painted.** The active workout's number fields and notes stay DOM above the canvas in this plan, so a glass bar scrolling over them does not refract them. Paint them and keep a transparent live input on top for the caret.
3. **Retire or keep the CSS fallback.** Frank's call once the canvas path has run on his phone for a while.
