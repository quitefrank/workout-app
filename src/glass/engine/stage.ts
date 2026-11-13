/* eslint-disable @typescript-eslint/no-explicit-any */
import { averageUnder, blendSides, decideDark, stepSide, unpadRows } from "../context";
import { CTXV, prominentMaterial, type Family, type Material } from "../presets";
import { scrollTop } from "@/lib/scroller";
import { debugState } from "../debug-state";
import { makeFrost } from "./frost";
import { CAST_MARGIN, GLASS_MARGIN, makeCastMaterial, makeGlassMaterial, makeUniforms, type Uniforms } from "./materials";
import { lensState } from "../lens-state";
import { holdExpired, navState } from "../nav-state";
import { PUSH, pushLayers, pushProgress } from "@/lib/page-push";
import { makeTabsLayer } from "./tabs";

/* The Glass Lab V3's GPU surface (makeGpu, lines 4275 to 4501), for the app: a canvas, a content texture the painter
   draws into, glass meshes placed from DOM rects, for whatever glass the current screen holds. Changes from the lab:
   glass elements are found every frame and come and go; their size and radius are uniforms; units, bands and the top
   edge come from the DOM's data attributes; there is no bottom edge and no over layer (a bar's own text is live DOM
   above the canvas). */

export type StageOptions = {
  THREE: any; T: any;
  canvas: HTMLCanvasElement; W: number; H: number; dpr: number;
  bars: Family;
  appearance: () => "dark" | "light";
  /** paint the page; `origin` is where the canvas sits on screen, subtracted from every rect */
  draw: (c: CanvasRenderingContext2D, origin: { x: number; y: number }) => void;
  /** what the page looks like now; the canvas's place is added to it by the stage */
  signature: () => string;
  /** the first frame on which every glass element on screen has its shaders built */
  onReady?: () => void;
  /** a frame threw or the GPU device was lost: the loop has stopped and the caller should fall back to the CSS
   *  material (`deviceLost`: a fresh start may work) */
  onError?: (err: unknown, deviceLost: boolean) => void;
};

type Unit = { key: Element; s: number | null; onDark: boolean | null; els: Element[]; Us: Uniforms[] };
type Entry = { el: Element; U: Uniforms; mesh: any; cast: any; ready: boolean; compile: string; since: number };

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
  const { Fn, uv, vec2, vec3, float, int, ivec2, max, min, floor, clamp, mix, smoothstep, step: stepNode, texture, textureLoad, uniform, sRGBTransferEOTF, screenCoordinate, Loop } = T;
  const contentCanvas = document.createElement("canvas"); contentCanvas.width = Math.round(W * dpr); contentCanvas.height = Math.round(H * dpr);
  const cctx = contentCanvas.getContext("2d")!;
  // raw sRGB bytes (no decode on sampling): the frost averages them as they are, and the optics decode where they read
  const rawTex = new THREE.CanvasTexture(contentCanvas); rawTex.colorSpace = THREE.NoColorSpace;
  rawTex.generateMipmaps = true; rawTex.minFilter = THREE.LinearMipmapLinearFilter; rawTex.magFilter = THREE.LinearFilter;
  const cw = contentCanvas.width, ch = contentCanvas.height;
  // The page push (src/lib/page-push.ts): a copy of the page that was on screen when a link was tapped, slid against the
  // new page in the page pass below, so the bars stay put and refract both as they move, as the phone's do
  const prevCanvas = document.createElement("canvas"); prevCanvas.width = cw; prevCanvas.height = ch;
  const prevCtx = prevCanvas.getContext("2d")!;
  const prevTex = new THREE.CanvasTexture(prevCanvas); prevTex.colorSpace = THREE.NoColorSpace;
  prevTex.generateMipmaps = false; prevTex.minFilter = THREE.LinearFilter; prevTex.magFilter = THREE.LinearFilter;
  const NAV = { on: uniform(0), topX: uniform(0), underX: uniform(0), topIsNew: uniform(1), dim: uniform(0), shadow: uniform(0) };
  // The page with its scroll edge effect is rendered once into pageTex whenever the page or the effect moves; the screen
  // shows it, and the glass and its frosts read it, so a bar refracts and blurs the dimmed band it sits on, as the phone's
  // do. The edge blur alone reads the raw page.
  const pageRT = new THREE.RenderTarget(cw, ch, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, generateMipmaps: false, depthBuffer: false });
  pageRT.texture.colorSpace = THREE.NoColorSpace;
  const pageTex = pageRT.texture;
  const barsFrost = makeFrost(THREE, T, pageTex, cw, ch, dpr, o.bars);
  // the capsule's frost: the bar's sigma and Pill blur added in quadrature (a blur of a blur)
  const pillFrost = makeFrost(THREE, T, pageTex, cw, ch, dpr, o.bars, (P: Material) => Math.hypot(Math.max(0, P.frost) * (2.5 / 6), P.pillBlur || 0));
  const frosts = [barsFrost, pillFrost];
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
    // the push: the top page from topX rightwards, the page under it shifted by underX, dimmed, with a soft shadow off
    // the top page's leading edge. During a push the edge blur reads the composite unblurred (no frost of the copy).
    const px = fu.x.mul(W);
    const tu = vec2(px.sub(NAV.topX).div(W), fu.y), uu = vec2(px.sub(NAV.underX).div(W), fu.y);
    const topC = mix(texture(prevTex, tu).rgb, texture(rawTex, tu).rgb, NAV.topIsNew);
    const shade = float(1).sub(clamp(NAV.topX.sub(px).div(PUSH.shadowWidth), 0, 1));
    const underC = mix(texture(rawTex, uu).rgb, texture(prevTex, uu).rgb, NAV.topIsNew)
      .mul(float(1).sub(NAV.dim))
      .mul(float(1).sub(shade.mul(shade).mul(NAV.shadow)));
    const pushed = mix(underC, topC, stepNode(NAV.topX, px));
    const sharp = mix(texture(rawTex, fu).rgb, pushed, NAV.on), soft = mix(texture(edgeFrost.tex, fu).rgb, pushed, NAV.on);
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
  const ctx = { THREE, T, W, H, dpr, contentTex: pageTex, blurTex: barsFrost.tex, pillTex: pillFrost.tex };

  // a control showing a blend of its two sides takes the blend; at the page's own side it takes the family's live values
  const sideBlend = (f: Unit): Material | null => {
    if (f.s === null) return null;
    const pageDark = o.appearance() === "dark";
    if (f.s === (pageDark ? 1 : 0)) return null;
    return blendSides(o.bars.sideValues("light"), o.bars.sideValues("dark"), f.s);
  };

  const join = (el: Element, U: Uniforms) => {
    if (el.closest("[data-glass-skip]")) return;
    const key = unit(el);
    let f = units.get(key);
    if (!f) { f = { key, s: null, onDark: null, els: [], Us: [] }; units.set(key, f); }
    f.els.push(el); f.Us.push(U);
    const unitRef = f;
    U.override = () => sideBlend(unitRef);
    const v = sideBlend(f); if (v) U.apply(v);
  };
  const leave = (el: Element) => {
    for (const [key, f] of units) {
      const i = f.els.indexOf(el);
      if (i >= 0) { f.els.splice(i, 1); f.Us.splice(i, 1); }
      if (!f.els.length) units.delete(key);
    }
  };
  // CSS glass (`.glass-css`: the Journal pill in its CSS mode) gets no mesh, but still joins its unit, so the context rule
  // keeps setting the unit's side (ctx-dark / ctx-light), which its CSS material reads
  const cssOnly = new Map<Element, Uniforms>();

  const add = (el: Element) => {
    const U = makeUniforms(THREE, T, o.bars);
    join(el, U);
    // Glass Prominent has its own stack, on the page's side, and follows the appearance through the family's listener
    if (el.classList.contains("glass-prominent")) {
      U.override = () => prominentMaterial(o.appearance());
      U.apply(U.override()!);
    }
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeGlassMaterial(ctx, U));
    const cast = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), makeCastMaterial(THREE, T, U, dpr)); cast.renderOrder = -1;
    scene.add(mesh); scene.add(cast);
    // each element's node graph is built once; build it off the frame (hidden until ready) so a screen change does not
    // hitch. compileAsync skips invisible objects and collects both meshes synchronously, so both start together while
    // still visible; the loop hides them until they are ready.
    const entry: Entry = { el, U, mesh, cast, ready: false, compile: "compiling", since: performance.now() };
    entries.set(el, entry);
    const took = () => `${Math.round(performance.now() - entry.since)}ms`;
    Promise.all([renderer.compileAsync(mesh, camera, scene), renderer.compileAsync(cast, camera, scene)]).then(
      () => { entry.ready = true; entry.compile = `ok ${took()}`; },
      (err) => { entry.ready = true; entry.compile = `failed ${took()}: ${String((err as Error)?.message ?? err)}`; },
    );
  };
  const remove = (e: Entry) => {
    e.U.dispose();
    scene.remove(e.mesh); scene.remove(e.cast);
    e.mesh.material.dispose(); e.cast.material.dispose(); e.mesh.geometry.dispose(); e.cast.geometry.dispose();
    entries.delete(e.el);
    leave(e.el);
  };

  const tabs = makeTabsLayer(THREE, T, { W, H, dpr, pageTex, barsFrost: barsFrost.tex });
  scene.add(tabs.mesh);
  // built off the frame like the glass; the CSS material holds the screen until it is
  let tabsReady = false;
  renderer.compileAsync(tabs.mesh, camera, scene).then(() => { tabsReady = true; }, () => { tabsReady = true; });

  // Adapt and the context rule read the page's average brightness: the raw page (no edge effect, so the rule never reads
  // its own dimming) kept as a small grid, one cell per 8px, each footprint averaged from it in sRGB, as the readings
  // were. The grid is a box average on the GPU read back asynchronously, one read in flight, so it lands a frame or two
  // after the page; a synchronous read here stalled every scroll frame on the GPU.
  const AVG_CELL = 8, aw = Math.ceil(W / AVG_CELL), ah = Math.ceil(H / AVG_CELL), cellPx = AVG_CELL * dpr;
  const avgRT = new THREE.RenderTarget(aw, ah, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, generateMipmaps: false, depthBuffer: false });
  avgRT.texture.colorSpace = THREE.NoColorSpace;
  const avgMat = new THREE.MeshBasicNodeMaterial();
  avgMat.colorNode = Fn(() => {
    // this fragment's cell, and the exact block of content texels it covers (the last row and column clamped)
    const cx = floor(screenCoordinate.x), cy = floor(screenCoordinate.y);
    const x0 = int(floor(cx.mul(cellPx))), x1 = int(min(floor(cx.add(1).mul(cellPx)), float(cw)));
    const y0 = int(floor(cy.mul(cellPx))), y1 = int(min(floor(cy.add(1).mul(cellPx)), float(ch)));
    const sum = vec3(0, 0, 0).toVar(), n = float(0).toVar();
    Loop({ start: y0, end: y1, type: "int", name: "py" }, ({ py }: any) => {
      Loop({ start: x0, end: x1, type: "int", name: "px" }, ({ px }: any) => {
        // the canvas texture is uploaded bottom row first
        sum.addAssign(textureLoad(rawTex, ivec2(px, int(ch - 1).sub(py)), int(0)).rgb);
        n.addAssign(1);
      });
    });
    return sum.div(max(n, float(1)));
  })();
  const avgScene = new THREE.Scene(); avgScene.add(new THREE.Mesh(pageGeo, avgMat));
  let avgBytes: Uint8ClampedArray | null = null, avgWanted = true, avgInFlight = false;
  const readAverages = () => {
    avgWanted = false; avgInFlight = true;
    renderer.setRenderTarget(avgRT); renderer.render(avgScene, pageCam); renderer.setRenderTarget(null);
    renderer.readRenderTargetPixelsAsync(avgRT, 0, 0, aw, ah).then(
      (b: Uint8Array) => { if (!stopped) avgBytes = unpadRows(b, aw, ah, false); },
      () => { avgWanted = true; },
    ).finally(() => { avgInFlight = false; });
  };
  const avgUnder = (r: { x0: number; x1: number; y0: number; y1: number }) => averageUnder(avgBytes, aw, ah, AVG_CELL, r);
  // laid out at all (no display: none on it or above it); a fixed element has no offsetParent, so that cannot be the test
  const shown = (el: Element) => el.getClientRects().length > 0;
  const html = document.documentElement;
  let lastScrimT = -1;
  // Where the canvas is, measured every frame rather than assumed at 0,0: with the keyboard up iOS slides the viewport
  // and reports rects against what is on screen, so the canvas can sit off its own origin. Every rect the glass reads
  // is taken relative to it, and the page is painted at the same origin.
  const org = { x: 0, y: 0 };
  const rectOf = (el: Element) => {
    const b = el.getBoundingClientRect();
    return { left: b.left - org.x, top: b.top - org.y, right: b.right - org.x, bottom: b.bottom - org.y, width: b.width, height: b.height };
  };
  const bandOf = (f: Unit) => {
    const kind = (f.key as HTMLElement).dataset?.glassUnit;
    if (kind === "top") {
      const bar = f.key.querySelector("[data-glass-bar]") ?? f.key;
      return { x0: 0, x1: W, y0: 0, y1: rectOf(bar).bottom + CTXV.reach };
    }
    const rs = f.els.filter(shown).map(rectOf);
    if (!rs.length) return null;
    // the stage can be taller than the viewport (Safari's large viewport); the dock reads down to the visible bottom
    if (kind === "dock") return { x0: 0, x1: W, y0: Math.min(...rs.map((q) => q.top)) - CTXV.dockAbove, y1: Math.min(H, window.innerHeight - org.y) };
    return { x0: Math.min(...rs.map((q) => q.left)), x1: Math.max(...rs.map((q) => q.right)), y0: Math.min(...rs.map((q) => q.top)), y1: Math.max(...rs.map((q) => q.bottom)) };
  };

  let lastSig: string | null = null, pageDirty = true, lastEdgeKey = "", lastT = performance.now(), frame = 0, stopped = false, readySent = false;
  let pushT0 = 0;
  // A tap copies the page on screen, once the shader is showing it (before that the CSS material is, and nothing pushes)
  navState.snapshot = () => {
    if (stopped || !html.classList.contains("gpu")) return false;
    prevCtx.clearRect(0, 0, cw, ch);
    prevCtx.drawImage(contentCanvas, 0, 0);
    prevTex.needsUpdate = true;
    return true;
  };
  const step = () => {
    const now = performance.now(), dt = Math.min(100, now - lastT); lastT = now;
    const cr = o.canvas.getBoundingClientRect(); org.x = cr.left; org.y = cr.top;

    // the glass on screen now
    // Sheets, menus, the Journal card (.jcard-stage, its glass layer included) and any control on them are CSS
    // (globals.css): the shader reads the page, so a control on a sheet would show what is behind the sheet, not the
    // sheet. `.glass-css` keeps the CSS material anywhere and only joins its unit for the context rule.
    const want = new Set<Element>(), wantCss = new Set<Element>();
    document.querySelectorAll(".glass").forEach((el) => {
      if (el.closest(".glass-sheet, .jcard-stage")) return;
      (el.classList.contains("glass-css") ? wantCss : want).add(el);
    });
    for (const e of Array.from(entries.values())) if (!want.has(e.el)) remove(e);
    for (const el of want) if (!entries.has(el)) add(el);
    for (const [el, U] of Array.from(cssOnly)) if (!wantCss.has(el)) { U.dispose(); cssOnly.delete(el); leave(el); }
    for (const el of wantCss) if (!cssOnly.has(el)) { const U = makeUniforms(THREE, T, o.bars); cssOnly.set(el, U); join(el, U); }

    // The page push: hold the copy until the new route has rendered, paint it this frame, then run the spring
    if (navState.phase === "hold") {
      if (holdExpired(now)) navState.phase = "idle";
      else if (navState.committed) { navState.phase = "run"; pushT0 = now; lastSig = null; }
    }
    if (navState.phase !== "idle") {
      const p = navState.phase === "run" ? pushProgress(now - pushT0) : 0;
      const L = pushLayers(navState.direction, p, W);
      NAV.on.value = 1; NAV.topX.value = L.topX; NAV.underX.value = L.underX; NAV.topIsNew.value = L.topIsNew ? 1 : 0;
      NAV.dim.value = L.dim; NAV.shadow.value = L.topX > 0 && L.topX < W ? PUSH.shadowAlpha : 0;
      pageDirty = true;
      if (p >= 1) navState.phase = "idle";
    } else if (NAV.on.value !== 0) { NAV.on.value = 0; pageDirty = true; }

    // The page is drawn to the texture (and re-blurred) only when its signature moves: scroll, DOM, appearance. Between
    // those frames only the glass is composited, which is what keeps a 3x phone at frame rate.
    const sig = `${o.signature()}|${org.x}|${org.y}`;
    if (sig !== lastSig) {
      lastSig = sig;
      cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      o.draw(cctx, org);
      rawTex.needsUpdate = true; edgeFrost.touch(); pageDirty = true; avgWanted = true;
    }
    if (avgWanted && !avgInFlight) readAverages();

    const sheetOpen = html.classList.contains("sheet-open");
    // the scrim is painted into the page, under the glass, so the glass takes the same dimming itself, following the
    // scrim's fade (its opacity); the bars' HTML symbols follow it through --scrim-t (globals.css)
    let scrimT = 0;
    for (const s of document.querySelectorAll<HTMLElement>("[data-scrim]")) scrimT = Math.max(scrimT, parseFloat(getComputedStyle(s).opacity) || 0);
    if (scrimT <= 0.001) scrimT = 0;
    if (scrimT !== lastScrimT) {
      lastScrimT = scrimT;
      html.style.setProperty("--scrim-t", scrimT.toFixed(3));
      html.classList.toggle("scrim-dim", scrimT > 0);
    }
    const dimBy = 1 - scrimT * (parseFloat(getComputedStyle(html).getPropertyValue("--scrim-alpha")) || 0.2);
    let allReady = true;
    for (const e of entries.values()) {
      const laidOut = shown(e.el);
      if (laidOut && !e.ready) allReady = false;
      // the dock steps aside while a sheet is up (visibility hidden keeps its layout, so check the class)
      const inDock = !!e.el.closest("[data-glass-unit='dock']");
      // glass in the content hides with its HTML (the active workout's stepper cards under the rest arc); any glass hides
      // while it carries data-glass-hidden (the Journal pill while its card is up, in the card's match and shader modes)
      const vis =
        e.ready && laidOut && !(sheetOpen && inDock) && !(e.el as HTMLElement).hasAttribute("data-glass-hidden") &&
        (inDock || getComputedStyle(e.el).visibility !== "hidden");
      e.mesh.visible = e.cast.visible = vis;
      if (!vis) continue;
      const r = rectOf(e.el);
      e.U.setSize(r.width, r.height, parseFloat(getComputedStyle(e.el).borderTopLeftRadius) || 0);
      // glass in the content under the pinned bars
      e.U.dim.value = dimBy;
      const z = e.el.closest("[data-glass-unit='top'], [data-glass-unit='dock']") ? 0.1 : 0.06;
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
      // a unit holding a glass that is growing over the screen (the Journal pill in the card's shader mode) keeps its side
      if (f.els.some((el) => (el as HTMLElement).hasAttribute("data-glass-hold"))) continue;
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
      EDGE.topOn.value = dim || Math.min(1, Math.max(0, scrollTop() / Math.max(1, CTXV.fadeIn)));
      EDGE.topDim.value = dim; EDGE.topS.value = top.s ?? 0;
      EDGE.topReach.value = rectOf(bar).bottom + CTXV.reach;
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

    for (const e of entries.values()) e.U.pillMix.value = 0;
    const barEl = lensState.bar;
    const bar = barEl ? entries.get(barEl) : undefined;
    const tabsShown = tabsReady && !!barEl && !!bar && bar.mesh.visible;
    tabs.mesh.visible = tabsShown;
    if (tabsShown) {
      const P = bar.U.cur;
      tabs.place(barEl, rectOf(barEl), P, html.classList.contains("tabs-gpu"));
      // the bar learns where its capsule is (for Pill blur), in its own px
      bar.U.pillMix.value = (P.pillBlur || 0) > 0 ? 1 : 0;
      bar.U.pillC.value.set(lensState.x * lensState.swell, 0); bar.U.pillS.value.set(lensState.w * lensState.swell, lensState.h * lensState.swell);
      // the HTML ink steps aside once the canvas has it
      if (tabs.inkReady() && !html.classList.contains("tabs-gpu")) html.classList.add("tabs-gpu");
    }
    renderer.render(scene, camera);
    // the bars take their side from the first grid, so the CSS material holds the screen until one has arrived
    if (allReady && tabsReady && avgBytes && !readySent) { readySent = true; o.onReady?.(); }
    if (++debugState.frames % 15 === 0) {
      debugState.entries = Array.from(entries.values()).map((e) => ({
        label: `${(e.el.getAttribute("aria-label") ?? e.el.textContent ?? "").trim().slice(0, 18)} ${e.el.className.toString().slice(0, 24)}`,
        laidOut: shown(e.el),
        compile: e.ready ? e.compile : `compiling ${Math.round(performance.now() - e.since)}ms`,
      }));
    }
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
    navState.snapshot = null; navState.phase = "idle";
    // the units' classes first: removing the last entry of a unit drops the unit
    for (const f of units.values()) f.key.classList.remove("ctx-dark", "ctx-light");
    html.classList.remove("tabs-gpu");
    for (const e of Array.from(entries.values())) remove(e);
    for (const [el, U] of Array.from(cssOnly)) { U.dispose(); cssOnly.delete(el); leave(el); }
    [...frosts, edgeFrost].forEach((f) => f.dispose());
    tabs.dispose();
    [pageMat, bgMat, avgMat, pageGeo, bgGeo, rawTex, prevTex, pageRT, avgRT].forEach((x) => x.dispose());
    renderer.dispose();
  };
}
