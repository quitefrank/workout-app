/* eslint-disable @typescript-eslint/no-explicit-any */
import { FROST_SIGMA, type Material } from "../presets";

/* The frost: a Gaussian blur of the page on the GPU, one per family because each has its own radius. Two separable passes
   into a pair of render targets a fraction of the page's size; the fraction follows the radius (halving until the sigma is
   under 2.5 texels) so the kernel is always 17 taps, and the raw page has mipmaps (the page render target has none), which feed the small targets without aliasing.
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
  const owned: { dispose: () => void }[] = [];
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
    const geo = new THREE.PlaneGeometry(2, 2); owned.push(m, geo);
    const scene = new THREE.Scene(); scene.add(new THREE.Mesh(geo, m)); return scene;
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
    dispose: () => { off?.(); rtA.dispose(); rtB.dispose(); for (const o of owned) o.dispose(); },
    // the passes run only when the page or the radius changed; the targets keep the result between frames
    render: (renderer: any) => { if (!dirty) return; dirty = false; renderer.setRenderTarget(rtA); renderer.render(sceneA, camera); renderer.setRenderTarget(rtB); renderer.render(sceneB, camera); renderer.setRenderTarget(null); },
  };
}
