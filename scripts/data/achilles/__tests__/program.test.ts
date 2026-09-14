// @vitest-environment node

import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { RECOVERY_PROGRAM } from "../program";
import { SOURCES } from "../sources";
import { EQUIPMENT_LABELS } from "../equipment";

/** Every phase boundary as the handout prints it: weekFrom, weekTo, loadPct. */
const HANDOUT_LADDER: [number, number | null, number | null][] = [
  [0, 2, 0], [2, 3, 25], [3, 4, 50], [4, 5, 75], [5, 6, 100], [6, 8, 100], [8, 12, 100],
  [12, 16, null], [16, 26, null], [26, 52, null], [52, null, null],
];

describe("recovery program phases", () => {
  it("has eleven phases in order with contiguous weeks", () => {
    const p = RECOVERY_PROGRAM.phases;
    expect(p).toHaveLength(11);
    p.forEach((ph, i) => {
      expect(ph.position).toBe(i + 1);
      if (i > 0) expect(ph.weekFrom).toBe(p[i - 1].weekTo);
    });
    expect(p[10].weekTo).toBeNull();
  });

  it("matches the handout's weight-bearing ladder and every later boundary as printed", () => {
    expect(HANDOUT_LADDER).toHaveLength(RECOVERY_PROGRAM.phases.length);
    HANDOUT_LADDER.forEach(([from, to, pct], i) => {
      const ph = RECOVERY_PROGRAM.phases[i];
      expect(ph.weekFrom, ph.label).toBe(from);
      expect(ph.weekTo, ph.label).toBe(to);
      expect(ph.loadPct, ph.label).toBe(pct);
    });
  });

  it("carries the two strength gates", () => {
    expect(RECOVERY_PROGRAM.phases[9].gate).toBe("80% strength");
    expect(RECOVERY_PROGRAM.phases[10].gate).toBe("100% strength");
  });

  it("points every flag source at a real source key", () => {
    const keys = new Set(SOURCES.map((s) => s.key));
    for (const ph of RECOVERY_PROGRAM.phases) {
      if (ph.flagSourceKey !== null) expect(keys.has(ph.flagSourceKey)).toBe(true);
    }
    expect(keys.has(RECOVERY_PROGRAM.sourceKey ?? "")).toBe(true);
    expect(keys.has("physio416")).toBe(true);
  });

  it("has unique source keys and citations", () => {
    const keys = SOURCES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
    const cites = SOURCES.map((s) => s.citation);
    expect(new Set(cites).size).toBe(cites.length);
  });

  it("labels every equipment item", () => {
    expect(Object.keys(EQUIPMENT_LABELS)).toHaveLength(26);
  });
});

describe("committed seed data carries no patient detail", () => {
  const dir = fileURLToPath(new URL("../", import.meta.url));
  const tsFiles = readdirSync(dir).filter((f) => f.endsWith(".ts"));
  const examplePath = dir + "personal.example.json";

  it("has no 2026 dates, no imaging words, no side words in the TypeScript data", () => {
    for (const f of tsFiles) {
      const text = readFileSync(dir + f, "utf8");
      expect(text, f).not.toMatch(/\b20\d\d-\d\d-\d\d\b/);
      expect(text, f).not.toMatch(/ultrasound|tendinosis|thromboprophylaxis/i);
      expect(text, f).not.toMatch(/\b(left|right)\b/i);
    }
  });

  // personal.example.json arrives with Task 4; until then this case skips.
  it.skipIf(!existsSync(examplePath))("keeps the personal example on placeholder dates", () => {
    const text = readFileSync(examplePath, "utf8");
    expect(text).not.toMatch(/\b202\d-\d\d-\d\d\b/);
  });
});
