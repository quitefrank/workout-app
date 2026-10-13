/* eslint-disable @typescript-eslint/no-explicit-any */
import { blendSides, decideDark, stepSide } from "../context";
import { CTXV, type Family, type Material } from "../presets";
import { makeFrost } from "./frost";
import { CAST_MARGIN, GLASS_MARGIN, makeCastMaterial, makeGlassMaterial, makeUniforms, type Uniforms } from "./materials";

/* The Glass Lab V3's GPU surface (makeGpu, lines 4275 to 4501), for the app: a canvas, a content texture the painter
   draws into, glass meshes placed from DOM rects, for whatever glass the current screen holds. Changes from the lab:
   glass elements are found every frame and come and go; their size and radius are uniforms; units, bands and the top
   edge come from the DOM's data attributes; there is no bottom edge and no over layer (a bar's own text is live DOM
   above the canvas). */

export type StageOptions = {
  THREE: any; T: any;
  canvas: HTMLCanvasElement; W: number; H: number; dpr: number;
  bars: Family; sheet: Family;
  appearance: () => "dark" | "light";
  draw: (c: CanvasRenderingContext2D) => void;
  signature: () => string;
  /** the first frame on which every glass element on screen has its shaders built */
  onReady?: () => void;
  /** a frame threw or the GPU device was lost: the loop has stopped and the caller should fall back to the CSS
   *  material (`deviceLost`: a fresh start may work) */
  onError?: (err: unknown, deviceLost: boolean) => void;
};

type Unit = { key: Element; s: number | null; onDark: boolean | null; els: Element[]; Us: Uniforms[] };
type Entry = { el: Element; U: Uniforms; mesh: any; cast: any; family: "bars" | "sheet"; ready: boolean };

export async function startStage(o: StageOptions): Promise<() => void> {
  const { THREE, canvas, W, H, dpr } = o;
  const renderer = new THREE.WebGPURenderer({ canvas, antialias: true }); renderer.setPixelRatio(dpr); renderer.setSize(W, H, false);
  // anything below failing (init, a shader, an allocation) leaves no renderer behind
  try {
    await renderer.init();
    // three falls back to WebGL 2 without WebGPU; the app keeps its CSS material instead
    if (!renderer.backend?.isWebGPUBackend) throw new Error("WebGPU is not available");
    return setup(o, renderer);
  } catch (err) {
    renderer.dispose();
    throw err;
  }
}

function setup(o: StageOptions, renderer: any): () => void {
  const { THREE, T, W, H, dpr } = o;
  const { Fn, uv, vec2, vec3, float, abs, max, min, length, clamp, mix, smoothstep, texture, uniform, sRGBTransferEOTF } = T;
  const contentCanvas = document.createElement("canvas"); contentCanvas.width = Math.round(W * dpr); contentCanvas.height = Math.round(H * dpr);
  const cctx = contentCanvas.getContext("2d")!;
  // raw sRGB bytes (no decode on sampling): the frost averages them as they are, and the optics decode where they read
  const rawTex = new THREE.CanvasTexture(contentCanvas); rawTex.colorSpace = THREE.NoColorSpace;
  rawTex.generateMipmaps = true; rawTex.minFilter = THREE.LinearMipmapLinearFilter; rawTex.magFilter = THREE.LinearFilter;
  const cw = contentCanvas.width, ch = contentCanvas.height;
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
  // Measured off the phone's Photos Library (dark side, top): the page at about 0.45 of itself at the screen edge, 0.75
  // 95pt down, gone by about 140pt, detail blurred to a third around the buttons.
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
    // light side: toward white; dark side: dimmed. A media edge (a photo grid, as Photos draws its Library) always dims,
    // whatever the side
    c = mix(mix(c, vec3(1, 1, 1), wTop.mul(EDGE.whiteAmt)), c.mul(float(1).sub(wTop.mul(EDGE.dimAmt))), max(EDGE.topS, EDGE.topDim));
    return c;
  })();
  const pageGeo = new THREE.PlaneGeometry(2, 2);
  const pageScene = new THREE.Scene(); pageScene.add(new THREE.Mesh(pageGeo, pageMat));
  const pageCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 10); pageCam.position.z = 1;
  const bgMat = new THREE.MeshBasicNodeMaterial(); bgMat.colorNode = sRGBTransferEOTF(texture(pageTex, uv()).rgb);
  const bgGeo = new THREE.PlaneGeometry(W, H);
  scene.add(new THREE.Mesh(bgGeo, bgMat));

  const unit = (el: Element) => el.closest("[data-glass-unit]") ?? el;
  const units = new Map<Element, Unit>();
  const entries = new Map<Element, Entry>();
  const ctxFor = (family: "bars" | "sheet") => ({ THREE, T, W, H, dpr, contentTex: pageTex, blurTex: (family === "bars" ? barsFrost : sheetFrost).tex, pillTex: family === "bars" ? pillFrost.tex : null });

  // a control showing a blend of its two sides takes the blend; at the page's own side it takes the family's live values
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
    // each element's node graph is built once; build it off the frame (hidden until ready) so a screen change does not
    // hitch. compileAsync skips invisible objects and collects both meshes synchronously, so both start together while
    // still visible; the loop hides them until they are ready.
    const entry: Entry = { el, U, mesh, cast, family, ready: false };
    entries.set(el, entry);
    const done = () => { entry.ready = true; };
    Promise.all([renderer.compileAsync(mesh, camera, scene), renderer.compileAsync(cast, camera, scene)]).then(done, done);
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

  // The selected tab's capsule, drawn in the canvas over the glass so the bar's content stays visible through it. On the
  // device the capsule is darker than the bar in both appearances (measured: about 0.3x the bar over black, 0.9x in
  // light), so it is a black capsule at the opacity Preset 1 sets rather than the kit's plus blend, which lifts instead
  // of darkening.
  const PILL_PAD = 2, PILL_H = 54;
  const uW = uniform(80), uH = uniform(PILL_H), uAmt = uniform(0.6);
  const capsule = (p: any) => { const half = vec2(uW.mul(0.5), uH.mul(0.5)); const rad = uH.mul(0.5); const q = abs(p).sub(half).add(rad); return length(max(q, vec2(0, 0))).add(min(max(q.x, q.y), float(0))).sub(rad); };
  const pm = new THREE.MeshBasicNodeMaterial(); pm.transparent = true; pm.depthTest = false; pm.depthWrite = false;
  pm.colorNode = vec3(0, 0, 0);
  pm.opacityNode = Fn(() => { const p = uv().sub(0.5).mul(vec2(uW, uH)); return float(1).sub(smoothstep(float(-0.8), float(0.8), capsule(p))).mul(uAmt); })();
  const pillGeo = new THREE.PlaneGeometry(1, 1);
  const pillMesh = new THREE.Mesh(pillGeo, pm); pillMesh.renderOrder = 10; pillMesh.visible = false; scene.add(pillMesh);

  // Adapt and the context rule read the page's average brightness: the page kept as a small copy (one cell per 8px,
  // refreshed with the page), each footprint averaged from it in sRGB, as the readings were
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
  // laid out at all (no display: none on it or above it); a fixed element has no offsetParent, so that cannot be the test
  const shown = (el: Element) => el.getClientRects().length > 0;
  const html = document.documentElement;
  const bandOf = (f: Unit) => {
    const kind = (f.key as HTMLElement).dataset?.glassUnit;
    if (kind === "top") {
      const bar = f.key.querySelector("[data-glass-bar]") ?? f.key;
      return { x0: 0, x1: W, y0: 0, y1: bar.getBoundingClientRect().bottom + CTXV.reach };
    }
    const rs = f.els.filter(shown).map((el) => el.getBoundingClientRect());
    if (!rs.length) return null;
    // the stage can be taller than the viewport (Safari's large viewport); the dock reads down to the visible bottom
    if (kind === "dock") return { x0: 0, x1: W, y0: Math.min(...rs.map((q) => q.top)) - CTXV.dockAbove, y1: Math.min(H, window.innerHeight) };
    return { x0: Math.min(...rs.map((q) => q.left)), x1: Math.max(...rs.map((q) => q.right)), y0: Math.min(...rs.map((q) => q.top)), y1: Math.max(...rs.map((q) => q.bottom)) };
  };

  let lastSig: string | null = null, pageDirty = true, lastEdgeKey = "", lastT = performance.now(), frame = 0, stopped = false, readySent = false;
  const step = () => {
    const now = performance.now(), dt = Math.min(100, now - lastT); lastT = now;

    // the glass on screen now
    const want = new Map<Element, "bars" | "sheet">();
    document.querySelectorAll(".glass").forEach((el) => want.set(el, "bars"));
    document.querySelectorAll(".glass-sheet").forEach((el) => want.set(el, "sheet"));
    for (const e of Array.from(entries.values())) if (!want.has(e.el)) remove(e);
    for (const [el, fam] of want) if (!entries.has(el)) add(el, fam);

    // The page is drawn to the texture (and re-blurred) only when its signature moves: scroll, DOM, appearance. Between
    // those frames only the glass is composited, which is what keeps a 3x phone at frame rate.
    const sig = o.signature();
    if (sig !== lastSig) {
      lastSig = sig;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.draw(cctx);
      rawTex.needsUpdate = true; edgeFrost.touch(); pageDirty = true;
      actx.drawImage(contentCanvas, 0, 0, aw, ah); avgBytes = actx.getImageData(0, 0, aw, ah).data;
    }

    const sheetOpen = html.classList.contains("sheet-open");
    let allReady = true;
    for (const e of entries.values()) {
      const laidOut = shown(e.el);
      if (laidOut && !e.ready) allReady = false;
      // the dock steps aside while a sheet is up (visibility hidden keeps its layout, so check the class)
      const vis = e.ready && laidOut && !(sheetOpen && e.family === "bars" && e.el.closest("[data-glass-unit='dock']"));
      e.mesh.visible = e.cast.visible = vis;
      if (!vis) continue;
      const r = e.el.getBoundingClientRect();
      const rad = parseFloat(getComputedStyle(e.el).borderTopLeftRadius) || 0;
      e.U.setSize(r.width, r.height, rad);
      // glass in the content under the pinned bars, the bars under the sheet, the sheet over them, a control on the
      // sheet over the sheet
      const z = e.family === "sheet" ? 0.3 : e.el.closest(".glass-sheet") ? 0.4 : e.el.closest("[data-glass-unit='top'], [data-glass-unit='dock']") ? 0.1 : 0.06;
      const cx = r.left + r.width / 2 - W / 2, cy = H / 2 - (r.top + r.height / 2);
      e.mesh.scale.set(r.width + 2 * GLASS_MARGIN, r.height + 2 * GLASS_MARGIN, 1); e.mesh.position.set(cx, cy, z);
      e.cast.scale.set(r.width + 2 * CAST_MARGIN, r.height + 2 * CAST_MARGIN, 1); e.cast.position.set(cx, cy, z - 0.05);
      e.U.avgL.value = avgUnder({ x0: r.left, x1: r.right, y0: r.top, y1: r.bottom });
    }

    // The context rule. Each unit reads the page behind it as one: the band its edge effect covers when it has one,
    // otherwise the box round its visible controls. Dark below 0.40, light again above 0.50, a 0.25s crossfade. A bar
    // over a media edge sits on the dimming, so it is on its dark side.
    let top: Unit | null = null;
    for (const f of units.values()) {
      // the dock steps aside under a sheet, so it reads nothing until it is back
      if (!f.els.some(shown) || (sheetOpen && (f.key as HTMLElement).dataset?.glassUnit === "dock")) continue;
      const band = bandOf(f);
      if (!band) continue;
      const media = (f.key as HTMLElement).dataset?.edge === "dim";
      const onDark = decideDark(f.onDark, media ? 0 : avgUnder(band));
      if (onDark !== f.onDark) { f.onDark = onDark; f.key.classList.toggle("ctx-dark", onDark); f.key.classList.toggle("ctx-light", !onDark); }
      const next = stepSide(f.s, onDark ? 1 : 0, dt, CTXV.fade * 1000);
      if (next !== f.s) { f.s = next; const v = sideBlend(f) ?? o.bars.P; f.Us.forEach((U) => U.apply(v)); }
      if ((f.key as HTMLElement).dataset?.glassUnit === "top") top = f;
    }

    // the edge effect follows its bar: the soft effect shows once content has scrolled under the bar (Apple's automatic
    // style), a media edge always
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
      const r = pillEl.getBoundingClientRect(); const w = r.width + 2 * PILL_PAD, h = PILL_H;
      // Pill darkening is the share of the bar's sRGB value the capsule takes away; the blend happens in linear light
      uW.value = w; uH.value = h; uAmt.value = 1 - Math.pow(1 - Math.min(1, P.pillOpacity || 0), 2.2);
      const x = r.left + r.width / 2 - W / 2, y = H / 2 - (r.top + r.height / 2);
      pillMesh.scale.set(w, h, 1); pillMesh.position.set(x, y, 0.5);
      // tell the bar where its capsule is, in the bar's own coordinates
      bar.U.pillC.value.set(x - bar.mesh.position.x, y - bar.mesh.position.y); bar.U.pillS.value.set(w, h);
    }
    renderer.render(scene, camera);
    if (allReady && !readySent) { readySent = true; o.onReady?.(); }
  };
  // one report, then no more frames: a broken frame would throw on every one after it
  const halt = (err: unknown, deviceLost: boolean) => {
    if (stopped) return;
    stopped = true; cancelAnimationFrame(frame);
    o.onError?.(err, deviceLost);
  };
  const loop = () => {
    if (stopped) return;
    frame = requestAnimationFrame(loop);
    try {
      step();
    } catch (err) {
      halt(err, false);
    }
  };
  // the GPU process restarted, the tab was backgrounded too long, a driver reset: nothing renders on this device again.
  // Disposing the renderer destroys the device on purpose, which also lands here, after `stopped` is set.
  renderer.onDeviceLost = (info: { message?: string; reason?: string }) => {
    renderer._isDeviceLost = true;
    halt(new Error(`WebGPU device lost: ${info?.reason ?? ""} ${info?.message ?? ""}`.trim()), true);
  };
  loop();

  return () => {
    stopped = true; cancelAnimationFrame(frame);
    // the units' classes first: removing the last entry of a unit drops the unit
    for (const f of units.values()) f.key.classList.remove("ctx-dark", "ctx-light");
    for (const e of Array.from(entries.values())) remove(e);
    [...frosts, edgeFrost].forEach((f) => f.dispose());
    [pageMat, bgMat, pm, pageGeo, bgGeo, pillGeo, rawTex, pageRT].forEach((x) => x.dispose());
    renderer.dispose();
  };
}
