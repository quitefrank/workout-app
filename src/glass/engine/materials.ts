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
  const VALUE_KEYS = Object.keys(U).filter((k) => !NOT_VALUES.has(k) && !/Color$/.test(k));
  setFill(P);
  U.cur = P;
  U.apply = (p: Material) => {
    U.cur = p;
    for (const k of VALUE_KEYS) if (p[k] !== undefined) U[k].value = p[k];
    U.ior.value = iorFor(p); setFill(p); fitBezel();
  };
  // the raw radius is tracked because U.r holds the clamped one, which differs from r whenever r exceeds half the box
  let rawR = NaN;
  U.setSize = (w: number, h: number, r: number) => {
    if (U.w.value === w && U.h.value === h && rawR === r) return;
    rawR = r;
    U.w.value = w; U.h.value = h; U.r.value = Math.min(r, w / 2, h / 2); fitBezel();
  };
  // dispose unsubscribes from the family; the owner disposes the meshes' materials
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
