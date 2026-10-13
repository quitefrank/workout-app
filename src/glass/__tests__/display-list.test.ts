import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { baselineOf, buildDisplayList, cornerRadii, groupLines, transformText } from "../paint/display-list";

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

  it("puts the baseline at the content area's ascent, centred in the box", () => {
    // a range rect whose height is the content area: baseline = top + ascent
    expect(baselineOf(100, 20, { ascent: 15.6, descent: 4.4 }, 17)).toBe(116);
    // a 22px line box around a 20px content area: 1px of half-leading above
    expect(baselineOf(100, 22, { ascent: 15.6, descent: 4.4 }, 17)).toBe(117);
    // no canvas: the 0.3 em estimate from the line box centre
    expect(baselineOf(100, 20, null, 10)).toBe(113);
  });

  it("groups character boxes into lines, whitespace never starting or ending one", () => {
    const b = (left: number, top: number) => ({ left, top, height: 20 });
    // "ab cd" wrapped after the space: a b _ c d
    expect(groupLines([b(0, 0), b(8, 0), null, b(0, 22), b(8, 22)])).toEqual([
      { start: 0, end: 2, left: 0, top: 0, height: 20 },
      { start: 3, end: 5, left: 0, top: 22, height: 20 },
    ]);
    // a glyph sitting a pixel higher (a fallback font) stays on its line
    expect(groupLines([b(0, 0), { left: 8, top: -1, height: 22 }, b(16, 0)])).toHaveLength(1);
    expect(groupLines([null, null])).toEqual([]);
  });

  it("applies text-transform", () => {
    expect(transformText("bench press", "uppercase")).toBe("BENCH PRESS");
    expect(transformText("Bench", "lowercase")).toBe("bench");
    expect(transformText("bench press day", "capitalize")).toBe("Bench Press Day");
    expect(transformText("as is", "none")).toBe("as is");
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

  afterEach(() => { delete (Range.prototype as Partial<Range>).getClientRects; });

  it("flags sticky elements so the stage knows to rebuild on scroll", () => {
    root.innerHTML = `<div style="position: sticky"></div>`;
    expect(buildDisplayList(root, () => {}).sticky).toBe(true);
  });
});
