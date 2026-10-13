import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { svgImage } from "../paint/svg";

/** jsdom never decodes images; this stand-in lets a test finish or fail the decode by hand. */
class FakeImage {
  static made: FakeImage[] = [];
  complete = false;
  naturalWidth = 0;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = "";
  constructor() { FakeImage.made.push(this); }
  finish() { this.complete = true; this.naturalWidth = 24; this.onload?.(); }
  fail() { this.complete = true; this.onerror?.(); }
}

describe("svgImage", () => {
  let n = 0;
  const svg = () => {
    // a distinct svg per test, so the module cache never answers for another test
    document.body.innerHTML = `<svg width="24" height="24"><circle cx="12" cy="12" r="${++n}"/></svg>`;
    return document.querySelector("svg")!;
  };

  beforeEach(() => { FakeImage.made = []; vi.stubGlobal("Image", FakeImage); vi.spyOn(console, "warn").mockImplementation(() => {}); });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("is loading until the image decodes, then returns it", () => {
    const el = svg();
    const onLoad = vi.fn();
    expect(svgImage(el, onLoad)).toEqual({ img: null, loading: true });
    expect(svgImage(el, onLoad)).toEqual({ img: null, loading: true });
    FakeImage.made[0].finish();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(svgImage(el, onLoad)).toEqual({ img: FakeImage.made[0], loading: false });
  });

  it("stops loading when the decode fails, and asks for a rebuild", () => {
    const el = svg();
    const onLoad = vi.fn();
    svgImage(el, onLoad);
    FakeImage.made[0].fail();
    expect(onLoad).toHaveBeenCalledTimes(1);
    expect(svgImage(el, onLoad)).toEqual({ img: null, loading: false });
    expect(FakeImage.made).toHaveLength(1); // not retried
  });
});
