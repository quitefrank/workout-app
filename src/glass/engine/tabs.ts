/* eslint-disable @typescript-eslint/no-explicit-any */
import { LENS } from "@/lib/tab-lens";
import { lensState } from "../lens-state";
import type { Material } from "../presets";
import { svgImage } from "../paint/svg";

/* The tabs layer, the Glass Lab V3's (makeGpu, "The tabs layer"), for the app: everything over the tab bar's glass,
   drawn in the canvas. At rest it is the selected tab's capsule (on the device darker than the bar in both appearances,
   measured about 0.3x the bar over black and 0.9x in light, so a black capsule at Preset 1's opacity rather than the
   kit's plus blend, which lifts instead of darkening) and the tab ink. Lifted (src/lib/tab-lens.ts) the capsule is the
   lens of iOS 26: clear glass that magnifies and bends the page and the ink under it and splits colour at its rim.
   The ink is one mask of every symbol and label, coloured here: the tint inside the lens, the bar's ink outside, so a
   lens half over a tab tints half of it. The lens itself comes from lensState, written by the tab bar. */

/** The layer runs this far past the bar, room for a lifted lens poking over its edges */
const M = 16;

type Rect = { left: number; top: number; width: number; height: number };
type Opts = { W: number; H: number; dpr: number; pageTex: any; barsFrost: any };

/** A CSS colour as sRGB 0..1, through the canvas's own parser (alpha dropped) */
const rgbOf = (() => {
  let c: CanvasRenderingContext2D | null = null;
  return (css: string, fallback: [number, number, number]): [number, number, number] => {
    c ??= document.createElement("canvas").getContext("2d");
    if (!c || !css) return fallback;
    c.fillStyle = "#000"; c.fillStyle = css;
    const s = String(c.fillStyle);
    if (s.startsWith("#")) return [1, 3, 5].map((i) => parseInt(s.slice(i, i + 2), 16) / 255) as [number, number, number];
    const m = /rgba?\(([^)]+)\)/.exec(s);
    if (!m) return fallback;
    const [r, g, b] = m[1].split(/[\s,/]+/).map(Number);
    return [r / 255, g / 255, b / 255];
  };
})();

export function makeTabsLayer(THREE: any, T: any, o: Opts) {
  const { Fn, uv, vec2, vec3, vec4, float, max, length, clamp, mix, pow, exp, sign, dot, select, smoothstep, texture, uniform, sRGBTransferEOTF } = T;
  const { W, H, dpr } = o;
  const inkCanvas = document.createElement("canvas");
  const ictx = inkCanvas.getContext("2d")!;
  const inkTex = new THREE.CanvasTexture(inkCanvas); inkTex.colorSpace = THREE.NoColorSpace;
  inkTex.generateMipmaps = true; inkTex.minFilter = THREE.LinearMipmapLinearFilter; inkTex.magFilter = THREE.LinearFilter;
  const L = {
    quad: uniform(new THREE.Vector2(100, 70)), c: uniform(new THREE.Vector2(0, 0)), s: uniform(new THREE.Vector2(0, 0)),
    lift: uniform(0), amt: uniform(0.6), swell: uniform(1), barW: uniform(new THREE.Vector2(0, 0)), inkAmt: uniform(0),
    mag: uniform(1), refr: uniform(0), fringe: uniform(0), push: uniform(0), clear: uniform(0), veil: uniform(0),
    ink: uniform(new THREE.Vector3(1, 1, 1)), acc: uniform(new THREE.Vector3(0, 0.5, 1)),
  };
  const screenPx = vec2(W, H);
  const mat = new THREE.MeshBasicNodeMaterial(); mat.transparent = true; mat.depthTest = false; mat.depthWrite = false;
  mat.colorNode = Fn(() => {
    // p: the bar's own px, unswelled, y up; q: from the lens centre. The lens is a stadium, so its distance is exact
    const p = uv().sub(0.5).mul(L.quad).toVar();
    const q = p.sub(L.c).toVar();
    const rad = L.s.y.mul(0.5), seg = max(L.s.x.mul(0.5).sub(rad), 0);
    const dv = q.sub(vec2(clamp(q.x, seg.negate(), seg), 0)).toVar();
    const dl = length(dv);
    const d = dl.sub(rad).toVar();
    const nrm = dv.div(max(dl, 0.0001)).toVar();
    // no lens at all (no tab selected) is no lens, not a dot
    const inL = float(1).sub(smoothstep(float(-0.8), float(0.8), d)).mul(smoothstep(float(0), float(1), L.s.y)).toVar();
    // the rim: 0 inside the outer 45% of the radius, 1 at the edge; the read there bends outward, so the rim shows what
    // is just past it, squeezed, and the middle is magnified
    const rim = clamp(float(1).add(d.div(max(rad.mul(0.45), 1))), 0, 1);
    const bend = nrm.mul(L.refr.mul(rim.mul(rim)).mul(L.lift)).toVar();
    const inner = L.c.add(q.div(mix(float(1), L.mag, L.lift))).toVar();
    const pageUv = (sp: any) => L.barW.add(sp.mul(L.swell)).add(screenPx.mul(0.5)).div(screenPx);
    const inkUv = (sp: any) => sp.div(L.quad).add(0.5);
    // one read per channel, the split growing with the bend (red out, blue in), as the bar's own glass splits
    const at = (k: number) => inner.add(bend.mul(float(1).add(L.fringe.mul(0.35 * k))));
    const ar = at(1), ag = at(0), ab = at(-1);
    const sharpRead = (sp: any) => sRGBTransferEOTF(texture(o.pageTex, pageUv(sp)).rgb);
    const softRead = (sp: any) => sRGBTransferEOTF(texture(o.barsFrost, pageUv(sp)).rgb);
    const pageR = mix(softRead(ar).r, sharpRead(ar).r, L.clear);
    const pageG = mix(softRead(ag).g, sharpRead(ag).g, L.clear);
    const pageB = mix(softRead(ab).b, sharpRead(ab).b, L.clear);
    // the lens body: the page through it, a touch lifted, and a hairline of light round the rim, strongest on top
    const hl = pow(rim, 6).mul(float(0.18).add(max(nrm.y, 0).mul(0.3)));
    const lit = vec3(pageR, pageG, pageB).mul(1.04).add(0.012).add(hl);
    // the veil: toward black under light ink, toward white under dark, so the tint inside stays legible
    const away = select(dot(L.ink, vec3(0.2126, 0.7152, 0.0722)).greaterThan(0.5), vec3(0, 0, 0), vec3(1, 1, 1));
    const body = mix(lit, away, L.veil).toVar();
    const aBody = inL.mul(L.lift);
    // Pill darkening is the share of the bar's sRGB value the capsule takes away; the blend happens in linear light
    const aDark = inL.mul(L.amt).mul(float(1).sub(L.lift));
    // ink: through the lens per channel in the tint; outside, pushed away from the lens, in the bar's ink
    const inR = texture(inkTex, inkUv(ar)).a.mul(L.inkAmt), inG = texture(inkTex, inkUv(ag)).a.mul(L.inkAmt), inB = texture(inkTex, inkUv(ab)).a.mul(L.inkAmt);
    const push = vec2(sign(q.x).mul(L.push).mul(L.lift).mul(exp(max(d, 0).negate().div(24))), 0);
    const outA = texture(inkTex, inkUv(p.sub(push))).a.mul(L.inkAmt);
    const acc = sRGBTransferEOTF(L.acc), ink = sRGBTransferEOTF(L.ink);
    const inkP = vec3(acc.x.mul(inR), acc.y.mul(inG), acc.z.mul(inB)).mul(inL).add(ink.mul(outA).mul(float(1).sub(inL))).toVar();
    const aInk = max(inR, max(inG, inB)).mul(inL).add(outA.mul(float(1).sub(inL))).toVar();
    // body, then the capsule's darkening, then the ink, over each other (premultiplied)
    const p1 = body.mul(aBody).mul(float(1).sub(aDark)).toVar();
    const a1 = aDark.add(aBody.mul(float(1).sub(aDark))).toVar();
    const p2 = inkP.add(p1.mul(float(1).sub(aInk)));
    const a2 = aInk.add(a1.mul(float(1).sub(aInk))).toVar();
    return vec4(p2.div(max(a2, 0.0001)), a2);
  })();
  const geo = new THREE.PlaneGeometry(1, 1);
  const mesh = new THREE.Mesh(geo, mat); mesh.renderOrder = 10;

  // The mask: every tab's symbol and label at twice the screen's density, so the lens can magnify it. Only its alpha is
  // read, so the colours the HTML ink has do not matter; it is redrawn when the bar's size, the labels or a symbol
  // image change.
  let inkKey = "", loads = 0, pending = true;
  const drawInk = (bar: HTMLElement, rect: Rect, swell: number, bw: number, bh: number) => {
    const K = Math.min(6, dpr * 2), qw = bw + 2 * M, qh = bh + 2 * M;
    const iw = Math.round(qw * K), ih = Math.round(qh * K);
    // a new size needs a new GPU texture, not an upload into the old one
    if (iw !== inkCanvas.width || ih !== inkCanvas.height) { inkCanvas.width = iw; inkCanvas.height = ih; inkTex.dispose(); }
    ictx.setTransform(K, 0, 0, K, 0, 0); ictx.clearRect(0, 0, qw, qh);
    // a rect on screen to the mask's px: from the bar's corner, unswelled, past the margin
    const local = (r: DOMRect) => ({ x: (r.left - rect.left) / swell + M, y: (r.top - rect.top) / swell + M, w: r.width / swell, h: r.height / swell });
    pending = false;
    for (const face of Array.from(bar.querySelectorAll<HTMLElement>("a[data-tab-ink]"))) {
      const svg = face.querySelector<SVGSVGElement>("[data-tab-icon] svg");
      if (svg) {
        const { img, loading } = svgImage(svg, () => { loads++; });
        if (loading) pending = true;
        if (img) { const r = local(svg.getBoundingClientRect()); ictx.drawImage(img, r.x, r.y, r.w, r.h); }
      }
      const label = face.querySelector<HTMLElement>("[data-tab-label]");
      if (label) {
        const cs = getComputedStyle(label), r = local(label.getBoundingClientRect());
        ictx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
        ictx.fillStyle = "#fff"; ictx.textAlign = "center"; ictx.textBaseline = "middle";
        ictx.fillText(label.textContent ?? "", r.x + r.w / 2, r.y + r.h / 2 + 0.5);
      }
    }
    inkTex.needsUpdate = true;
  };

  // the ink colours follow the bar's side with the context rule's crossfade, as the HTML's colour transition does
  let ink: number[] | null = null, acc: number[] | null = null, lastT = 0;
  return {
    mesh,
    /** Place the layer over the bar (`rect` its box on screen, swell included) for this frame. */
    place(bar: HTMLElement, rect: Rect, P: Material, inkOn: boolean) {
      const swell = lensState.swell, bw = bar.offsetWidth, bh = bar.offsetHeight;
      const labels = Array.from(bar.querySelectorAll("a[data-tab-ink]"), (a) => a.textContent).join("|");
      // the selected tab's symbol is drawn bolder
      const key = `${bw}|${bh}|${labels}|${loads}|${bar.querySelector("[aria-current]")?.getAttribute("href")}`;
      if (key !== inkKey || pending) { inkKey = key; drawInk(bar, rect, swell, bw, bh); }
      const now = performance.now(), f = lastT ? Math.min(1, ((now - lastT) / 250) * 3) : 1; lastT = now;
      const cs = getComputedStyle(bar);
      const inkGoal = rgbOf(cs.getPropertyValue("--glass-ink").trim(), [1, 1, 1]), accGoal = rgbOf(cs.getPropertyValue("--glass-ink-on").trim(), [0.04, 0.52, 1]);
      ink = ink ? ink.map((v, i) => v + (inkGoal[i] - v) * f) : inkGoal;
      acc = acc ? acc.map((v, i) => v + (accGoal[i] - v) * f) : accGoal;
      const cx = rect.left + rect.width / 2 - W / 2, cy = H / 2 - (rect.top + rect.height / 2);
      L.quad.value.set(bw + 2 * M, bh + 2 * M); L.c.value.set(lensState.x, 0); L.s.value.set(lensState.w, lensState.h);
      L.lift.value = lensState.lift; L.swell.value = swell; L.barW.value.set(cx, cy); L.inkAmt.value = inkOn ? 1 : 0;
      L.amt.value = 1 - Math.pow(1 - Math.min(1, P.pillOpacity || 0), 2.2);
      L.mag.value = LENS.lensMag; L.refr.value = LENS.lensRefract; L.fringe.value = LENS.lensFringe; L.push.value = LENS.lensPush; L.clear.value = LENS.lensClear; L.veil.value = LENS.lensVeil;
      L.ink.value.set(ink[0], ink[1], ink[2]); L.acc.value.set(acc[0], acc[1], acc[2]);
      mesh.scale.set((bw + 2 * M) * swell, (bh + 2 * M) * swell, 1); mesh.position.set(cx, cy, 0.5);
    },
    /** The mask has every symbol decoded, so the HTML ink can step aside */
    inkReady: () => !pending && inkKey !== "",
    dispose() { mat.dispose(); geo.dispose(); inkTex.dispose(); },
  };
}
