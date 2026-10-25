import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDisplayList, cornerRadii } from "../paint/display-list";

describe("display list helpers", () => {
  it("reads px and % radii and scales overlapping corners together", () => {
    expect(cornerRadii(["10px", "10px", "10px", "10px"], 100, 50)).toEqual([10, 10, 10, 10]);
    expect(cornerRadii(["9999px", "9999px", "9999px", "9999px"], 100, 40)).toEqual([20, 20, 20, 20]);
    expect(cornerRadii(["50%", "50%", "50%", "50%"], 40, 40)).toEqual([20, 20, 20, 20]);
    // one big corner squeezes its neighbours by the same factor: 60 + 20 on a 40 tall side gives 0.5
    expect(cornerRadii(["60px", "0px", "0px", "20px"], 200, 40)).toEqual([30, 0, 0, 10]);
    expect(cornerRadii(["10px 4px", "0px", "0px", "0px"], 100, 100)).toEqual([4, 0, 0, 0]);
    expect(cornerRadii(["0px", "0px", "0px", "0px"], 0, 0)).toEqual([0, 0, 0, 0]);
  });
});

describe("buildDisplayList (jsdom, stubbed geometry)", () => {
  const rect = (x: number, y: number, w: number, h: number) => new DOMRect(x, y, w, h);
  let root: HTMLElement;

  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
    document.body.innerHTML = "";
    root = document.createElement("div");
    document.body.appendChild(root);
  });
  afterEach(() => vi.restoreAllMocks());

  const place = (el: Element, r: DOMRect) => { (el as HTMLElement).getBoundingClientRect = () => r; };

  it("paints backgrounds, multiplies opacity, skips glass, live, hidden and transparent elements", () => {
    root.innerHTML = `
      <div id="card" style="background-color: rgb(255, 0, 0); opacity: 0.5"><div id="inner" style="background-color: rgb(0, 0, 255); opacity: 0.5"></div></div>
      <div class="glass" style="background-color: rgb(0, 255, 0)"><div style="background-color: rgb(0, 255, 0)"></div></div>
      <div data-live style="background-color: rgb(0, 255, 0)"></div>
      <div style="display: none; background-color: rgb(0, 255, 0)"></div>
      <div style="opacity: 0; background-color: rgb(0, 255, 0)"></div>
      <div id="clear"></div>`;
    for (const el of Array.from(root.querySelectorAll("div"))) place(el, rect(10, 20, 100, 50));
    const list = buildDisplayList(root, () => {});
    const boxes = list.items.filter((i) => i.k === "box");
    expect(boxes.map((b) => (b.k === "box" ? [b.color, b.alpha] : null))).toEqual([
      ["rgb(255, 0, 0)", 0.5],
      ["rgb(0, 0, 255)", 0.25],
    ]);
  });

  it("offsets by the scroll, except fixed elements", () => {
    root.innerHTML = `<div id="a" style="background-color: rgb(1, 1, 1)"></div><div id="b" style="position: fixed; background-color: rgb(2, 2, 2)"></div>`;
    place(root.querySelector("#a")!, rect(0, 10, 50, 50));
    place(root.querySelector("#b")!, rect(0, 10, 50, 50));
    vi.spyOn(window, "scrollY", "get").mockReturnValue(300);
    const [a, b] = buildDisplayList(root, () => {}).items;
    expect([a.y, a.fixed]).toEqual([310, false]);
    expect([b.y, b.fixed]).toEqual([10, true]);
  });

  it("paints a scrim that is on over the viewport and nothing for one that is off", () => {
    root.innerHTML = `<div data-scrim="on"><p>hidden</p></div><div data-scrim="off"></div>`;
    const items = buildDisplayList(root, () => {}).items;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ k: "box", x: 0, y: 0, w: window.innerWidth, h: window.innerHeight, color: "rgba(0, 0, 0, 0.2)", fixed: true });
  });

  it("chains overflow clips inside the padding box, with radii less the border", () => {
    root.innerHTML = `<div id="outer" style="overflow-x: hidden; overflow-y: hidden; border-top-left-radius: 12px; border-top-right-radius: 12px; border-bottom-right-radius: 12px; border-bottom-left-radius: 12px"><div id="rail" style="overflow-x: auto; border: 2px solid rgb(0, 0, 0); border-top-left-radius: 10px; border-top-right-radius: 10px; border-bottom-right-radius: 10px; border-bottom-left-radius: 10px"><div id="tile" style="background-color: rgb(9, 9, 9)"></div></div></div>`;
    place(root.querySelector("#outer")!, rect(0, 0, 200, 100));
    place(root.querySelector("#rail")!, rect(10, 10, 180, 80));
    place(root.querySelector("#tile")!, rect(20, 20, 300, 40));
    const tile = buildDisplayList(root, () => {}).items.find((i) => i.k === "box" && i.color === "rgb(9, 9, 9)")!;
    expect(tile.clip).toMatchObject({ x: 12, y: 12, w: 176, h: 76, radii: [8, 8, 8, 8] });
    expect(tile.clip!.parent).toMatchObject({ x: 0, y: 0, w: 200, h: 100, radii: [12, 12, 12, 12], parent: null });
  });

  it("turns inset hairline shadows and one-sided borders into lines", () => {
    root.innerHTML = `<div id="row" style="box-shadow: inset 0 0.5px 0 rgba(60, 60, 67, 0.29)"></div><div id="sep" style="border-bottom: 1px solid rgb(200, 200, 200)"></div>`;
    place(root.querySelector("#row")!, rect(0, 40, 300, 44));
    place(root.querySelector("#sep")!, rect(0, 100, 300, 20));
    const lines = buildDisplayList(root, () => {}).items.filter((i) => i.k === "line");
    expect(lines.map((l) => [l.x, l.y, l.w, l.h])).toEqual([
      [0, 40, 300, 0.5],
      [0, 119, 300, 1],
    ]);
  });

  it("places text at its range rect with the page's font and colour", () => {
    root.innerHTML = `<span id="t" style="color: rgb(10, 20, 30); font-size: 10px; text-transform: uppercase">  bench press </span>`;
    place(root.querySelector("#t")!, rect(0, 0, 100, 20));
    const ranges: [number, number][] = [];
    // jsdom has no Range geometry
    Range.prototype.getClientRects = function (this: Range) {
      ranges.push([this.startOffset, this.endOffset]);
      return [rect(4, 100, 60, 20)] as unknown as DOMRectList;
    };
    const [t] = buildDisplayList(root, () => {}).items;
    // the range covers the trimmed text, so its left is where the first visible letter starts
    expect(ranges).toEqual([[2, 13]]);
    expect(t).toMatchObject({ k: "text", text: "BENCH PRESS", x: 4, y: 113, color: "rgb(10, 20, 30)", maxWidth: null });
  });

  afterEach(() => {
    delete (Range.prototype as Partial<Range>).getClientRects;
    delete (Range.prototype as Partial<Range>).getBoundingClientRect;
  });

  /** A fake text layout: each UTF-16 unit is 10px wide, `lineOf(i)` puts it on a 22px line. Records every range. */
  function layout(lineOf: (i: number) => number, leftOf: (i: number) => number) {
    const seen: [number, number][] = [];
    const rects = (r: Range) => {
      seen.push([r.startOffset, r.endOffset]);
      const by = new Map<number, number[]>();
      for (let i = r.startOffset; i < r.endOffset; i++) by.set(lineOf(i), [...(by.get(lineOf(i)) ?? []), leftOf(i)]);
      return [...by].map(([ln, ls]) => rect(Math.min(...ls), ln * 22, Math.max(...ls) + 10 - Math.min(...ls), 20));
    };
    Range.prototype.getClientRects = function (this: Range) { return rects(this) as unknown as DOMRectList; };
    Range.prototype.getBoundingClientRect = function (this: Range) {
      const q = rects(this);
      if (!q.length) return rect(0, 0, 0, 0);
      const l = Math.min(...q.map((v) => v.left)), t = Math.min(...q.map((v) => v.top));
      return rect(l, t, Math.max(...q.map((v) => v.right)) - l, Math.max(...q.map((v) => v.bottom)) - t);
    };
    return seen;
  }
  const texts = (items: ReturnType<typeof buildDisplayList>["items"]) => items.flatMap((i) => (i.k === "text" ? [[i.text, i.x, i.y]] : []));

  it("wraps text with an emoji without splitting its surrogate pair", () => {
    root.innerHTML = `<span style="font-size: 10px">a\u{1F4AA}b c</span>`;
    // a=0, the emoji=1..2, b=3, space=4, c=5 on the next line
    const seen = layout((i) => (i >= 5 ? 1 : 0), (i) => (i >= 5 ? (i - 5) * 10 : i * 10));
    expect(texts(buildDisplayList(root, () => {}).items)).toEqual([["a\u{1F4AA}b", 0, 13], ["c", 0, 35]]);
    expect(seen.flat()).not.toContain(2);
  });

  it("measures a long wrapped node by binary search, not per character", () => {
    const words = "press ".repeat(40).trim(); // 239 characters, wrapped at 120
    root.innerHTML = `<span style="font-size: 10px">${words}</span>`;
    const seen = layout((i) => (i >= 120 ? 1 : 0), (i) => (i >= 120 ? i - 120 : i) * 10);
    const out = texts(buildDisplayList(root, () => {}).items);
    expect(out.map((t) => t[0])).toEqual([words.slice(0, 119), words.slice(120)]);
    expect(seen.length).toBeLessThan(30);
  });

  it("places tabular figures one character at a time, and long tabular text as one run", () => {
    root.innerHTML = `<span style="font-size: 10px; font-variant-numeric: tabular-nums">1:05</span>`;
    layout(() => 0, (i) => i * 12);
    expect(texts(buildDisplayList(root, () => {}).items)).toEqual([["1", 0, 13], [":", 12, 13], ["0", 24, 13], ["5", 36, 13]]);
    root.innerHTML = `<span style="font-size: 10px; font-variant-numeric: tabular-nums">${"1".repeat(33)}</span>`;
    expect(texts(buildDisplayList(root, () => {}).items)).toEqual([["1".repeat(33), 0, 13]]);
  });

  it("gives truncated text a max width up to the parent's content box", () => {
    root.innerHTML = `<span id="t" style="font-size: 10px; text-overflow: ellipsis; padding-right: 8px">Bench press</span>`;
    const t = root.querySelector("#t")!;
    place(t, rect(0, 0, 100, 20));
    Object.defineProperty(t, "scrollWidth", { value: 300 });
    Object.defineProperty(t, "clientWidth", { value: 92 });
    layout(() => 0, (i) => 4 + i * 10);
    expect(buildDisplayList(root, () => {}).items[0]).toMatchObject({ k: "text", x: 4, maxWidth: 88 });
  });

  it("flags sticky only when the sticky subtree paints something", () => {
    root.innerHTML = `<div style="position: sticky"><div class="glass" style="background-color: rgb(0, 0, 0)"></div></div>`;
    expect(buildDisplayList(root, () => {}).sticky).toBe(false);
    root.innerHTML = `<div id="s" style="position: sticky; background-color: rgb(0, 0, 0)"></div>`;
    place(root.querySelector("#s")!, rect(0, 0, 10, 10));
    expect(buildDisplayList(root, () => {}).sticky).toBe(true);
  });

  it("records an inner scroller and its scroll on the clip, so a swipe needs no rebuild", () => {
    root.innerHTML = `<div id="rail" style="overflow-x: auto"><div id="tile" style="background-color: rgb(9, 9, 9)"></div></div><div id="cut" style="overflow-x: clip"><div></div></div>`;
    const rail = root.querySelector("#rail")!;
    Object.defineProperty(rail, "scrollLeft", { value: 40 });
    place(rail, rect(0, 0, 200, 100));
    place(root.querySelector("#tile")!, rect(-20, 0, 120, 100));
    const tile = buildDisplayList(root, () => {}).items[0];
    expect(tile.clip).toMatchObject({ scroller: rail, sx0: 40, sy0: 0 });
    expect(tile.x).toBe(-20);
  });

  it("paints a live input at rest with its own box and its value, clipped to its content box", () => {
    root.innerHTML = `<input id="w" data-live value="80" style="background-color: rgb(9, 9, 9); padding: 4px 8px; font-size: 20px; color: rgb(255, 255, 255)">`;
    const w = root.querySelector("#w")!;
    place(w, rect(10, 100, 80, 36));
    const items = buildDisplayList(root, () => {}).items;
    expect(items[0]).toMatchObject({ k: "box", x: 10, y: 100, w: 80, h: 36, color: "rgb(9, 9, 9)" });
    // no metrics in jsdom: the baseline estimate, centred in the 28px tall content box
    expect(items[1]).toMatchObject({ k: "text", text: "80", x: 18, y: 104 + 14 + 6, color: "rgb(255, 255, 255)", clip: { x: 18, y: 104, w: 64, h: 28 } });
  });

  it("paints an empty input's placeholder in the placeholder token, and nothing for an empty one without", () => {
    document.documentElement.style.setProperty("--ink-3", "rgba(235, 235, 245, 0.3)");
    root.innerHTML = `<input id="r" data-live placeholder="8-10" style="color: rgb(255, 255, 255)"><input id="e" data-live>`;
    place(root.querySelector("#r")!, rect(0, 0, 60, 30));
    place(root.querySelector("#e")!, rect(0, 40, 60, 30));
    const texts = buildDisplayList(root, () => {}).items.filter((i) => i.k === "text");
    expect(texts).toHaveLength(1);
    expect(texts[0]).toMatchObject({ text: "8-10", color: "rgba(235, 235, 245, 0.3)" });
    document.documentElement.style.removeProperty("--ink-3");
  });

  it("leaves the focused input, a live select and other live elements to the HTML", () => {
    root.innerHTML = `<input id="f" data-live value="5" style="background-color: rgb(9, 9, 9)"><select data-live style="background-color: rgb(9, 9, 9)"><option>2 min</option></select><pre data-live style="background-color: rgb(9, 9, 9)">debug</pre>`;
    for (const el of Array.from(root.children)) place(el, rect(0, 0, 60, 30));
    (root.querySelector("#f") as HTMLInputElement).focus();
    expect(buildDisplayList(root, () => {}).items).toEqual([]);
  });

  it("gives a rotated image its untransformed size, centre and matrix", () => {
    root.innerHTML = `<img id="chev" style="width: 18px; height: 18px">`;
    const chev = root.querySelector("#chev")!;
    // the bounding rect of a 18 x 10 image turned 90deg
    place(chev, rect(100, 50, 10, 18));
    for (const [k, v] of Object.entries({ complete: true, naturalWidth: 18, offsetWidth: 18, offsetHeight: 10 })) Object.defineProperty(chev, k, { value: v });
    const real = window.getComputedStyle;
    vi.spyOn(window, "getComputedStyle").mockImplementation((el: Element) => {
      const cs = real(el);
      if (el !== chev) return cs;
      return new Proxy(cs, { get: (t, k) => (k === "getPropertyValue" ? (p: string) => (p === "rotate" ? "90deg" : t.getPropertyValue(p)) : Reflect.get(t, k)) });
    });
    const [img] = buildDisplayList(root, () => {}).items;
    expect(img).toMatchObject({ k: "image", x: 100, y: 50, w: 10, h: 18, tf: { cx: 105, cy: 59, w: 18, h: 10 } });
    expect(img.k === "image" && img.tf!.m.map((v) => Math.round(v))).toEqual([0, 1, -1, 0]);
  });
});
