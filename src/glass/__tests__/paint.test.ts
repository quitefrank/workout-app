import { afterEach, describe, expect, it } from "vitest";
import { setColorResolver } from "../paint/css";
import type { Clip, DisplayList, Item } from "../paint/display-list";
import { fitText, gradientGeometry, paintList } from "../paint/paint";

/** Records calls and property writes on a stand-in 2D context. Like a real one, it keeps the last colour it accepted
 *  and ignores one it cannot parse (here, any oklch()). */
function fakeContext(scale = 1) {
  const log: string[] = [];
  const props = new Map<string | symbol, unknown>();
  const ctx = new Proxy({} as Record<string | symbol, unknown>, {
    get(_, k) {
      if (props.has(k)) return props.get(k);
      if (k === "getTransform") return () => ({ a: scale });
      if (k === "measureText") return (t: string) => ({ width: t.length * 10 });
      if (k === "createLinearGradient") return (...a: number[]) => { log.push(`grad ${a.join(",")}`); return { addColorStop: (t: number, col: string) => log.push(`stop ${t} ${col}`) }; };
      return (...a: unknown[]) => log.push(`${String(k)} ${a.map((v) => (Array.isArray(v) ? `[${v}]` : v)).join(",")}`.trim());
    },
    set(_, k, v) {
      if (typeof v === "string" && v.startsWith("oklch")) return true;
      props.set(k, v);
      log.push(`${String(k)}=${typeof v === "object" ? "obj" : v}`);
      return true;
    },
    has: () => true,
  });
  return { c: ctx as unknown as CanvasRenderingContext2D, log };
}

const base = { fixed: false, clip: null, alpha: 1 };
const box = (o: Partial<Extract<Item, { k: "box" }>>): Item => ({ k: "box", x: 0, y: 0, w: 10, h: 10, radii: [0, 0, 0, 0], color: "red", gradients: [], shadows: [], border: null, ...base, ...o });
const list = (items: Item[]): DisplayList => ({ items, bg: "white", pending: false, sticky: false });

describe("painter helpers", () => {
  it("lengthens the gradient line instead of clamping stops outside 0 to 1", () => {
    const g = gradientGeometry({ angle: 180, stops: [{ color: "a", pos: -0.5 }, { color: "b", pos: 1 }] }, 100, 100)!;
    expect([g.x0, g.y0, g.x1, g.y1]).toEqual([50, -50, 50, 100]);
    expect(g.stops).toEqual([{ t: 0, color: "a" }, { t: 1, color: "b" }]);
  });

  it("resolves px stops against the gradient line", () => {
    const g = gradientGeometry({ angle: 90, stops: [{ color: "a", pos: 0, posPx: 20 }, { color: "b", pos: 1 }] }, 200, 50)!;
    expect(g.stops.map((q) => q.t)).toEqual([0.1, 1]);
    expect(gradientGeometry({ angle: 180, stops: [] }, 10, 10)).toBeNull();
  });

  it("truncates to the longest prefix that fits with an ellipsis", () => {
    const m = (t: string) => t.length * 10;
    expect(fitText("Bench", 50, m)).toBe("Bench");
    expect(fitText("Bench press", 60, m)).toBe("Bench…");
    expect(fitText("Bench press", 70, m)).toBe("Bench…"); // the space before the ellipsis is dropped
    expect(fitText("Bench", 5, m)).toBe("…");
    // never half an emoji: "ab" plus half a surrogate pair would fit 40, but is not a prefix CSS could draw
    expect(fitText("ab\u{1F4AA}\u{1F4AA}", 40, m)).toBe("ab…");
  });
});

describe("paintList", () => {
  it("fills the background, scrolls document items, keeps fixed items, culls off-screen ones", () => {
    const { c, log } = fakeContext();
    paintList(c, list([box({ y: 500 }), box({ y: 10, fixed: true, color: "blue" }), box({ y: 5000, color: "green" })]), 0, 480, 390, 844);
    expect(log.filter((l) => l.startsWith("fillRect") || l.startsWith("roundRect"))).toEqual([
      "fillRect 0,0,390,844",
      "roundRect 0,20,10,10,[0,0,0,0]",
      "roundRect 0,10,10,10,[0,0,0,0]",
    ]);
    expect(log).not.toContain("fillStyle=green");
  });

  it("applies the clip chain outermost first, each with its own scroll", () => {
    const { c, log } = fakeContext();
    const outer: Clip = { x: 0, y: 0, w: 100, h: 100, radii: [4, 4, 4, 4], fixed: true, parent: null, scroller: null, sx0: 0, sy0: 0 };
    const inner: Clip = { x: 0, y: 100, w: 50, h: 50, radii: [0, 0, 0, 0], fixed: false, parent: outer, scroller: null, sx0: 0, sy0: 0 };
    paintList(c, list([box({ y: 110, clip: inner })]), 0, 100, 390, 844);
    expect(log.filter((l) => l.startsWith("roundRect") || l.startsWith("clip"))).toEqual([
      "roundRect 0,0,100,100,[4,4,4,4]", "clip",
      "roundRect 0,0,50,50,[0,0,0,0]", "clip",
      "roundRect 0,10,10,10,[0,0,0,0]",
    ]);
  });

  it("scales shadow blur and offsets to device pixels and draws them only outside the box", () => {
    const { c, log } = fakeContext(3);
    paintList(c, list([box({ x: 10, y: 10, color: null, shadows: [{ color: "black", x: 0, y: 4, blur: 8, spread: 0, inset: false }] })]), 0, 0, 390, 844);
    expect(log).toContain("clip evenodd");
    expect(log).toContain("shadowBlur=24");
    expect(log).toContain("shadowOffsetY=12");
    expect(log).toContain("shadowOffsetX=300000");
  });

  it("draws gradient layers last to first, so the first CSS layer is on top", () => {
    const { c, log } = fakeContext();
    const g = (color: string) => ({ angle: 180, stops: [{ color, pos: 0 }, { color, pos: 1 }] });
    paintList(c, list([box({ color: null, gradients: [g("top"), g("under")] })]), 0, 0, 390, 844);
    expect(log.filter((l) => l.startsWith("stop")).map((l) => l.split(" ")[2])).toEqual(["under", "under", "top", "top"]);
  });

  it("draws text at its baseline with the page's font, truncated when marked", () => {
    const { c, log } = fakeContext();
    const t: Item = { k: "text", x: 16, y: 100, text: "Bench press", font: "normal 600 17px system-ui", color: "black", letterSpacing: "normal", maxWidth: 60, shadow: null, ...base };
    paintList(c, list([t]), 0, 0, 390, 844);
    expect(log).toContain("font=normal 600 17px system-ui");
    expect(log).toContain("letterSpacing=0px");
    expect(log).toContain("fillText Bench…,16,100");
  });

  afterEach(() => setColorResolver(null));

  const balanced = (log: string[]) => log.filter((l) => l === "save").length === log.filter((l) => l === "restore").length;

  it("keeps save and restore balanced over every kind of item", () => {
    const { c, log } = fakeContext(2);
    const clip: Clip = { x: 0, y: 0, w: 100, h: 100, radii: [4, 4, 4, 4], fixed: false, parent: null, scroller: null, sx0: 0, sy0: 0 };
    const shadow = { color: "black", x: 0, y: 2, blur: 4, spread: 1, inset: false };
    const img = {} as CanvasImageSource;
    paintList(c, list([
      box({ clip, shadows: [shadow, shadow], border: { w: 1, color: "black" }, gradients: [{ angle: 90, stops: [{ color: "a", pos: 0 }, { color: "b", pos: 1 }] }] }),
      { k: "line", x: 0, y: 0, w: 10, h: 1, color: "grey", ...base },
      { k: "text", x: 0, y: 10, text: "Hi", font: "10px a", color: "black", letterSpacing: "1px", maxWidth: 5, shadow, ...base, clip },
      { k: "image", x: 0, y: 0, w: 10, h: 10, img, tf: { cx: 5, cy: 5, w: 10, h: 10, m: [-1, 0, 0, -1] }, ...base },
      box({ y: 9000 }),
    ]), 0, 0, 390, 844);
    expect(log.filter((l) => l === "save").length).toBeGreaterThan(4);
    expect(balanced(log)).toBe(true);
  });

  it("moves items inside an inner scroller by its scroll since the build, and not the scroller's own clip", () => {
    const { c, log } = fakeContext();
    const rail = { scrollLeft: 100, scrollTop: 0 } as unknown as Element;
    const railClip: Clip = { x: 0, y: 0, w: 200, h: 100, radii: [0, 0, 0, 0], fixed: false, parent: null, scroller: rail, sx0: 40, sy0: 0 };
    const tileClip: Clip = { x: 100, y: 0, w: 80, h: 80, radii: [0, 0, 0, 0], fixed: false, parent: railClip, scroller: null, sx0: 0, sy0: 0 };
    paintList(c, list([box({ x: 120, clip: tileClip })]), 0, 0, 390, 844);
    expect(log.filter((l) => l.startsWith("roundRect"))).toEqual([
      "roundRect 0,0,200,100,[0,0,0,0]",
      "roundRect 40,0,80,80,[0,0,0,0]",
      "roundRect 60,0,10,10,[0,0,0,0]",
    ]);
  });

  it("draws a transformed image about its centre at its untransformed size", () => {
    const { c, log } = fakeContext();
    paintList(c, list([{ k: "image", x: 100, y: 50, w: 10, h: 18, img: {} as CanvasImageSource, tf: { cx: 105, cy: 59, w: 18, h: 10, m: [0, 1, -1, 0] }, ...base }]), 0, 20, 390, 844);
    expect(log).toContain("translate 105,39");
    expect(log).toContain("transform 0,1,-1,0,0,0");
    expect(log.find((l) => l.startsWith("drawImage"))).toMatch(/,-9,-5,18,10$/);
  });

  it("falls back to the parsed rgba when the canvas rejects a colour string", () => {
    setColorResolver((col) => (col.startsWith("oklch") ? [1, 2, 3, 0.5] : null));
    const { c, log } = fakeContext();
    paintList(c, list([box({ color: "oklch(0.5 0.1 30)" })]), 0, 0, 390, 844);
    expect(log).toContain("fillStyle=rgba(1, 2, 3, 0.5)");
  });
});
