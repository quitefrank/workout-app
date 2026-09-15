// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { programWeeks, validateProgramJson } from "../schema";
import { parseDose } from "../../../../src/lib/recovery/dose";

const example = JSON.parse(readFileSync(fileURLToPath(new URL("../example.json", import.meta.url)), "utf8"));

describe("validateProgramJson", () => {
  it("accepts the committed example and counts its weeks", () => {
    const p = validateProgramJson(example);
    expect(programWeeks(p)).toBe(2);
    expect(p.blocks[1].weeks[0].days[0].exercises[1].dose).toBe("1 x AMRAP");
  });

  it("every dose in the example parses", () => {
    const p = validateProgramJson(example);
    for (const b of p.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) {
      expect(parseDose(e.dose), `${d.name}: ${e.name}`).not.toBeNull();
    }
  });

  it("rejects weeks that do not run 1..n across blocks", () => {
    const bad = structuredClone(example);
    bad.blocks[1].weeks[0].week = 5;
    expect(() => validateProgramJson(bad)).toThrow(/blocks\[1\]\.weeks\[0\]\.week: expected 2/);
  });

  it("rejects a day with no exercises and names the path", () => {
    const bad = structuredClone(example);
    bad.blocks[0].weeks[0].days[0].exercises = [];
    expect(() => validateProgramJson(bad)).toThrow(/days\[0\]\.exercises/);
  });

  it("rejects the wrong kind", () => {
    expect(() => validateProgramJson({ ...example, kind: "recovery" })).toThrow(/kind/);
  });
});
