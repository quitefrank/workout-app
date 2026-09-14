import { describe, expect, it } from "vitest";
import {
  isEmptyText,
  parseRange,
  parseRestSeconds,
} from "../parse-prescription";

describe("isEmptyText", () => {
  it("a bare dash is empty", () => {
    expect(isEmptyText("-")).toBe(true);
  });

  it("whitespace only is empty", () => {
    expect(isEmptyText("  ")).toBe(true);
  });

  it("a negative-looking value is not empty", () => {
    expect(isEmptyText("-5")).toBe(false);
  });
});

describe("parseRange", () => {
  it("parses a bare integer as min=max", () => {
    expect(parseRange("3")).toEqual({ min: 3, max: 3 });
  });

  it("parses hyphen-separated range", () => {
    expect(parseRange("3-5")).toEqual({ min: 3, max: 5 });
  });

  it("parses en-dash and em-dash ranges", () => {
    expect(parseRange("3–5")).toEqual({ min: 3, max: 5 });
    expect(parseRange("3—5")).toEqual({ min: 3, max: 5 });
  });

  it("tolerates whitespace around tokens", () => {
    expect(parseRange("  3 - 5  ")).toEqual({ min: 3, max: 5 });
  });

  it("returns null for empty input", () => {
    expect(parseRange("")).toBeNull();
    expect(parseRange("   ")).toBeNull();
    expect(parseRange(null)).toBeNull();
    expect(parseRange(undefined)).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseRange("abc")).toBeNull();
    expect(parseRange("3-5-7")).toBeNull();
    expect(parseRange("3 to 5")).toBeNull();
  });

  it("returns null when max < min", () => {
    expect(parseRange("5-3")).toBeNull();
  });
});

describe("parseRestSeconds", () => {
  it("parses minutes", () => {
    expect(parseRestSeconds("3 mins")).toBe(180);
    expect(parseRestSeconds("3 min")).toBe(180);
    expect(parseRestSeconds("3min")).toBe(180);
    expect(parseRestSeconds("3 minute")).toBe(180);
    expect(parseRestSeconds("3 minutes")).toBe(180);
    expect(parseRestSeconds("3m")).toBe(180);
  });

  it("parses minute range as midpoint", () => {
    expect(parseRestSeconds("3-4 mins")).toBe(210);
  });

  it("parses seconds", () => {
    expect(parseRestSeconds("90 sec")).toBe(90);
    expect(parseRestSeconds("90 seconds")).toBe(90);
    expect(parseRestSeconds("90s")).toBe(90);
  });

  it("infers minutes for small unitless values", () => {
    expect(parseRestSeconds("3")).toBe(180);
    expect(parseRestSeconds("5")).toBe(300);
  });

  it("infers seconds for larger unitless values", () => {
    expect(parseRestSeconds("30")).toBe(30);
    expect(parseRestSeconds("90")).toBe(90);
    expect(parseRestSeconds("180")).toBe(180);
  });

  it("returns null for empty input", () => {
    expect(parseRestSeconds("")).toBeNull();
    expect(parseRestSeconds(null)).toBeNull();
    expect(parseRestSeconds(undefined)).toBeNull();
  });

  it("returns null for malformed input", () => {
    expect(parseRestSeconds("rest as needed")).toBeNull();
    expect(parseRestSeconds("--")).toBeNull();
  });
});
