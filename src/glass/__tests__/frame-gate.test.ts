import { describe, expect, it } from "vitest";
import { makeFrameGate, meshKey, uniformsKey, valueKey } from "../engine/frame-gate";

describe("frame gate", () => {
  it("keys numbers, vectors and colours", () => {
    expect(valueKey(0.123456)).toBe("0.1235");
    expect(valueKey({ x: 1, y: 2 })).toBe("1,2");
    expect(valueKey({ x: 1, y: 2, z: 3 })).toBe("1,2,3");
    expect(valueKey({ r: 1, g: 0, b: 0.5 })).toBe("1,0,0.5");
    expect(valueKey(true)).toBe("1");
  });

  it("changes when any uniform changes, and only then", () => {
    const U: Record<string, unknown> = { a: { value: 1 }, v: { value: { x: 0, y: 0 } }, fn: () => 0, plain: 3 };
    const k1 = uniformsKey(U);
    expect(uniformsKey(U)).toBe(k1);
    (U.a as { value: number }).value = 2;
    expect(uniformsKey(U)).not.toBe(k1);
    const k2 = uniformsKey(U);
    (U.v as { value: { x: number } }).value.x = 0.5;
    expect(uniformsKey(U)).not.toBe(k2);
  });

  it("keys a mesh by visibility and transform", () => {
    const m = { visible: true, position: { x: 1, y: 2, z: 0.1 }, scale: { x: 10, y: 20, z: 1 } };
    const k = meshKey(m);
    m.position.y = 3;
    expect(meshKey(m)).not.toBe(k);
    m.visible = false;
    expect(meshKey(m)).toBe("0");
  });

  it("renders on a new key or when forced, skips a repeat", () => {
    const g = makeFrameGate();
    expect(g.render("a", false)).toBe(true);
    expect(g.render("a", false)).toBe(false);
    expect(g.render("a", true)).toBe(true);
    expect(g.render("b", false)).toBe(true);
    g.reset();
    expect(g.render("b", false)).toBe(true);
  });
});
