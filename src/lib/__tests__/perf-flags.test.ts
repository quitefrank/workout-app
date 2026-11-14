import { describe, expect, it } from "vitest";
import { applyParam, describe as describeFlags, minimal, parseStored, PERF_LEVERS, resolve } from "../perf-flags";

describe("perf flags", () => {
  it("defaults every lever", () => {
    const r = resolve({});
    for (const d of PERF_LEVERS) expect(r[d.key]).toBe(d.on);
    expect(r.idle).toBe(true);
    expect(r.msaa).toBe(false);
  });

  it("reads a ?perf= value over what was stored", () => {
    expect(applyParam("-idle,msaa", {})).toEqual({ idle: false, msaa: true });
    expect(applyParam("dpr2", { idle: false })).toEqual({ idle: false, dpr2: true });
    expect(applyParam("idle", { idle: false })).toEqual({});
  });

  it("reset clears before the rest applies", () => {
    expect(applyParam("reset", { idle: false, msaa: true })).toEqual({});
    expect(applyParam("reset,-gpu", { idle: false })).toEqual({ gpu: false });
  });

  it("ignores unknown names and blanks", () => {
    expect(applyParam("bogus,,-nope, msaa ", {})).toEqual({ msaa: true });
  });

  it("drops stored junk", () => {
    expect(parseStored('{"idle":false,"bogus":true,"msaa":"yes"}')).toEqual({ idle: false });
    expect(parseStored("not json")).toEqual({});
    expect(parseStored(null)).toEqual({});
  });

  it("keeps only overrides that differ from the default", () => {
    expect(minimal({ idle: true, gpu: false })).toEqual({ gpu: false });
  });

  it("describes a setup as a ?perf= value that round-trips", () => {
    const o = { idle: false, msaa: true };
    expect(describeFlags(o)).toBe("-idle,msaa");
    expect(applyParam(describeFlags(o), {})).toEqual(o);
  });
});
