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

  it("carries an optional variant on an exercise, defaulting to null", () => {
    const base = structuredClone(example);
    base.blocks[0].weeks[0].days[0].exercises[0].variant = "Top Set";
    delete base.blocks[0].weeks[0].days[0].exercises[1].variant;
    const p = validateProgramJson(base);
    expect(p.blocks[0].weeks[0].days[0].exercises[0].variant).toBe("Top Set");
    expect(p.blocks[0].weeks[0].days[0].exercises[1].variant).toBeNull();
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

  it("returns trimmed strings", () => {
    const padded = structuredClone(example);
    padded.name = "  Padded  ";
    padded.blocks[0].weeks[0].days[0].exercises[0].notes = "  keep it  ";
    const p = validateProgramJson(padded);
    expect(p.name).toBe("Padded");
    expect(p.blocks[0].weeks[0].days[0].exercises[0].notes).toBe("keep it");
  });

  it("rejects a colon in programme, block and day names, which become seed keys", () => {
    const badName = structuredClone(example);
    badName.name = "Test: programme";
    expect(() => validateProgramJson(badName)).toThrow(/^name: must not contain ":"/);
    const badBlock = structuredClone(example);
    badBlock.blocks[0].name = "Block: one";
    expect(() => validateProgramJson(badBlock)).toThrow(/^blocks\[0\]\.name: must not contain ":"/);
    const badDay = structuredClone(example);
    badDay.blocks[0].weeks[0].days[0].name = "Day: one";
    expect(() => validateProgramJson(badDay)).toThrow(/^blocks\[0\]\.weeks\[0\]\.days\[0\]\.name: must not contain ":"/);
    const okExercise = structuredClone(example);
    okExercise.blocks[0].weeks[0].days[0].exercises[0].name = "Squat: paused";
    expect(() => validateProgramJson(okExercise)).not.toThrow();
  });

  it("rejects a duplicate day name inside a week and names the path", () => {
    const bad = structuredClone(example);
    bad.blocks[0].weeks[0].days[1].name = "Push";
    expect(() => validateProgramJson(bad)).toThrow(
      /blocks\[0\]\.weeks\[0\]\.days\[1\]\.name: duplicate day "Push" in week 1/,
    );
  });

  it("shows the week value with its type when it is not the expected number", () => {
    const bad = structuredClone(example);
    bad.blocks[0].weeks[0].week = "1";
    expect(() => validateProgramJson(bad)).toThrow(/expected 1, got "1"/);
  });
});
