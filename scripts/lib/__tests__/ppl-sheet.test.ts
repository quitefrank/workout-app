// @vitest-environment node

import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";
import { decodeRangeCell, doseFromSheet, formatSkippedRow, parsePplWorkbook, parsePplRows } from "../ppl-sheet";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const HEADER = ["Week 1", "Exercise", "Warm-up Sets", "Working Sets", "Reps", "Load", "RPE", "Rest", "Substitution Option 1", "Substitution Option 2", "Notes"];

const PHASE_ONE: unknown[][] = [
  ["Test Program"],
  [null, null, null, null, null, null, null, null, null, null, "Copyright line"],
  ["Phase 1 - Block One (Test)"],
  HEADER,
  ["Legs #1", "Example Squat", 44624, 1, "2-4", "Example load cue", 44782, "~3-4 min", "Example Hack Squat", "Example Split Squat", "Sit back and down"],
  [null, "Example Walk", "5mins", 1, "45mins", null, null, null, null, null, null],
  ["Push #2", "A1. Example Press-Around", 1, 2, "12-15", null, 44814, "0 min", "Example Flye", "N/A", "Brace"],
  [null, "A2: Example Stretch 30s", 0, 2, "30s HOLD", null, "N/A", "0 min", "N/A", "N/A", "Hold"],
  [null, "Example Finisher", 0, 1, "AMRAP", null, 10, "0 min", "N/A", "N/A", null],
  ["Mandatory 1-2 Rest Days"],
  ["EXAMPLE DELOAD WEEK: TRAIN LIGHTER THIS WEEK"],
  ["Week 2", "Exercise", "Warm-up Sets", "Working Sets", "Reps", "Load", "RPE", "Rest", "Substitution Option 1", "Substitution Option 2", "Notes"],
  ["Legs #1", "Example Squat", 44624, 1, "3-5", null, 44782, "~3-4 min", "Example Hack Squat", "Example Split Squat", "Sit back and down"],
];

const PHASE_TWO: unknown[][] = [
  ["Test Program"],
  [null],
  ["Phase 2 - Block Two (Test)"],
  HEADER,
  ["Pull #1", "Example Row", 2, 3, "8, 5, 12", null, 44782, "~2-3 min", null, null, "Three set schemes"],
  [null, "Example Pulldown", 0, 1, "10+5", null, "See Notes", "~2-3 min", null, null, "Drop set"],
];

describe("decodeRangeCell", () => {
  it("turns Excel date serials back into month-day ranges and leaves everything else alone", () => {
    expect(decodeRangeCell(44624)).toBe("3-4");
    expect(decodeRangeCell(44782)).toBe("8-9");
    expect(decodeRangeCell(44814)).toBe("9-10");
    expect(decodeRangeCell(44595)).toBe("2-3");
    expect(decodeRangeCell(3)).toBe("3");
    expect(decodeRangeCell("3-4")).toBe("3-4");
    expect(decodeRangeCell(null)).toBeNull();
    expect(decodeRangeCell("N/A")).toBeNull();
  });
});

describe("doseFromSheet", () => {
  it("maps the sheet idioms to parseDose strings and notes", () => {
    expect(doseFromSheet(1, "2-4")).toEqual({ dose: "1 x 2-4", note: null });
    expect(doseFromSheet(1, "45mins")).toEqual({ dose: "1 x 45 min", note: null });
    expect(doseFromSheet(2, "30s HOLD")).toEqual({ dose: "2 x 30 sec hold", note: null });
    expect(doseFromSheet(1, "AMRAP")).toEqual({ dose: "1 x AMRAP", note: null });
    expect(doseFromSheet(3, "8, 5, 12")).toEqual({ dose: "3 x 5-12", note: "Reps per set: 8, 5, 12" });
    expect(doseFromSheet(1, "10+5")).toEqual({ dose: "1 x 10", note: "Then a drop set of 5" });
    expect(doseFromSheet(3, "8 + 8")).toEqual({ dose: "3 x 8", note: "8 + 8" });
    expect(doseFromSheet("3", 10)).toEqual({ dose: "3 x 10", note: null });
  });

  it("maps the shapes the real workbook adds to the plan's list", () => {
    expect(doseFromSheet(1, "30s")).toEqual({ dose: "1 x 30 sec", note: null });
    expect(doseFromSheet(2, "8, 5")).toEqual({ dose: "2 x 5-8", note: "Reps per set: 8, 5" });
    expect(doseFromSheet(6, 3)).toEqual({ dose: "6 x 3", note: null });
  });

  it("returns null for a shape it cannot map", () => {
    expect(doseFromSheet(3, "banana")).toBeNull();
    expect(doseFromSheet("-", "10")).toBeNull();
    expect(doseFromSheet(null, "10")).toBeNull();
  });
});

const META = { name: "Test programme", description: "d", citation: null, sourceUrl: null };

describe("parsePplRows", () => {
  const { program: p, skipped } = parsePplRows([PHASE_ONE, PHASE_TWO], META);

  it("skips nothing in a clean fixture", () => {
    expect(skipped).toEqual([]);
  });

  it("groups weeks into blocks with global week numbers", () => {
    expect(p.blocks.map((b) => b.name)).toEqual(["Block One", "Block Two"]);
    expect(p.blocks[0].weeks.map((w) => w.week)).toEqual([1, 2]);
    expect(p.blocks[1].weeks.map((w) => w.week)).toEqual([3]);
  });

  it("carries the day forward through merged cells, strips the day number, and skips rest and deload banners", () => {
    const w1 = p.blocks[0].weeks[0];
    expect(w1.days.map((d) => d.name)).toEqual(["Legs", "Push"]);
    expect(w1.days[0].exercises.map((e) => e.name)).toEqual(["Example Squat", "Example Walk"]);
    expect(w1.days[1].exercises.map((e) => e.name)).toEqual(["Example Press-Around", "Example Stretch", "Example Finisher"]);
  });

  it("decodes date-serial ranges, strips superset prefixes into notes, and turns N/A into null", () => {
    const squat = p.blocks[0].weeks[0].days[0].exercises[0];
    expect(squat.warmUp).toBe("3-4");
    expect(squat.rpe).toBe("8-9");
    expect(squat.rest).toBe("~3-4 min");
    expect(squat.sub1).toBe("Example Hack Squat");
    const walk = p.blocks[0].weeks[0].days[0].exercises[1];
    expect(walk.notes).toBeNull();
    const pa = p.blocks[0].weeks[0].days[1].exercises[0];
    expect(pa.notes).toBe("Superset A. Brace");
    expect(pa.rpe).toBe("9-10");
    expect(pa.sub2).toBeNull();
    const stretch = p.blocks[0].weeks[0].days[1].exercises[1];
    expect(stretch.name).toBe("Example Stretch");
    expect(stretch.variant).toBeNull();
    expect(stretch.rpe).toBeNull();
    expect(stretch.notes).toBe("Superset A. Hold");
  });

  it("pushes lossy rep idioms into notes and drops the RPE placeholder", () => {
    const row = p.blocks[1].weeks[0].days[0].exercises[0];
    expect(row.dose).toBe("3 x 5-12");
    expect(row.notes).toBe("Three set schemes. Reps per set: 8, 5, 12");
    const drop = p.blocks[1].weeks[0].days[0].exercises[1];
    expect(drop.rpe).toBeNull();
    expect(drop.notes).toBe("Drop set. Then a drop set of 5");
  });

  it("keeps a Load cell in the notes after the sheet's note text", () => {
    const squat = p.blocks[0].weeks[0].days[0].exercises[0];
    expect(squat.notes).toBe("Sit back and down. Load: Example load cue");
  });

  it("produces doses parseDose accepts and a programme the validator accepts", () => {
    for (const b of p.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) {
      expect(parseDose(e.dose), `${d.name}: ${e.name} ${e.dose}`).not.toBeNull();
    }
    expect(() => validateProgramJson(p)).not.toThrow();
  });

  it("folds set-type names onto the row variant and keeps the base name", () => {
    const rows: unknown[][] = [
      ["Test Program"],
      ["Phase 1 - Block One (Test)"],
      HEADER,
      ["Push #1", "Bench Press (Top Set)", 2, 1, "2-4", null, 44782, "~3-4 min", "DB Bench Press", "Machine Chest Press", "Explode"],
      [null, "Bench Press (Back Off AMRAP)", 0, 1, "AMRAP", "~60%", 10, "~3-4 min", "DB Bench Press", "Machine Chest Press", null],
      [null, "Pec Static Stretch 30s", 0, 2, "30s HOLD", null, "N/A", "0 min", "N/A", "N/A", "Hold"],
      [null, "Triceps Pressdown", 0, 3, "8", null, 9, "~1-2 min", "Triceps Pressdown (12-15 reps)", "DB Skull Crusher (12-15 reps)", null],
    ];
    const { program, skipped } = parsePplRows([rows], META);
    expect(skipped).toEqual([]);
    const ex = program.blocks[0].weeks[0].days[0].exercises;
    expect(ex.map((e) => [e.name, e.variant])).toEqual([
      ["Bench Press", "Top Set"],
      ["Bench Press", "Back Off AMRAP"],
      ["Pec Static Stretch", null],
      ["Triceps Pressdown", null],
    ]);
    expect(ex[3].sub1).toBe("Triceps Pressdown");
    expect(ex[3].sub2).toBe("DB Skull Crusher");
  });

  it("splits an A + B superset cell into two rows sharing the prescription", () => {
    const rows: unknown[][] = [
      ["Test Program"],
      ["Phase 1 - Block One (Test)"],
      HEADER,
      ["Push #1", "A1. Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension", 0, 3, "8 + 8", null, "9-10", "~1-2 min", "Triceps Pressdown (12-15 reps)", "DB Skull Crusher (12-15 reps)", "Do the squeeze then the stretch"],
    ];
    const { program, skipped } = parsePplRows([rows], META);
    expect(skipped).toEqual([]);
    const ex = program.blocks[0].weeks[0].days[0].exercises;
    expect(ex).toHaveLength(2);
    expect(ex[0]).toMatchObject({ name: "Triceps Pressdown", variant: "Squeeze-only", dose: "3 x 8", sub1: "Triceps Pressdown", sub2: null });
    expect(ex[1]).toMatchObject({ name: "Overhead Triceps Extension", variant: "Stretch-only", dose: "3 x 8", sub1: "DB Skull Crusher", sub2: null });
    expect(ex[0].notes).toContain("Superset A");
    expect(ex[0].notes).toContain("8 + 8");
    expect(ex[1].notes).toContain("8 + 8");
    expect(ex[1].notes).toContain("Do the squeeze then the stretch");
  });
});

describe("parsePplRows reports what it cannot place", () => {
  const ORPHANS: unknown[][] = [
    ["Test Program"],
    ["Phase 1 - Block One (Test)"],
    HEADER,
    [null, "Example Orphan Under Header", 0, 1, "10", null, null, null, null, null, null],
    ["Legs #1", "Example Squat", 1, 1, "2-4", null, 8, "~3-4 min", null, null, null],
    [null, "Example Mystery", 1, 3, "banana", null, null, null, null, null, null],
    ["Mandatory 1-2 Rest Days"],
    [null, "Example Orphan Under Banner", 0, 1, "10", null, null, null, null, null, null],
  ];
  const { program, skipped } = parsePplRows([ORPHANS], META);

  it("lists an exercise row with no day above it, with a reason, instead of dropping it", () => {
    const orphans = skipped.filter((s) => s.day === null);
    expect(orphans.map((s) => s.name)).toEqual(["Example Orphan Under Header", "Example Orphan Under Banner"]);
    for (const s of orphans) {
      expect(s.block).toBe("Block One");
      expect(s.week).toBe(1);
      expect(s.reason).toMatch(/no day/);
    }
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Legs"]);
    expect(program.blocks[0].weeks[0].days[0].exercises.map((e) => e.name)).toEqual(["Example Squat"]);
  });

  it("lists a row whose reps it cannot map, under its day", () => {
    const mystery = skipped.find((s) => s.name === "Example Mystery");
    expect(mystery).toMatchObject({ block: "Block One", week: 1, day: "Legs" });
    expect(mystery?.reason).toMatch(/no dose/);
    expect(formatSkippedRow(mystery!)).toBe(`Block One W1 Legs: Example Mystery: ${mystery!.reason}`);
    expect(skipped).toHaveLength(3);
  });
});

describe("parsePplWorkbook", () => {
  it("throws naming the sheets when none matches the phase pattern", () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["nothing"]]), "Cover");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["nothing"]]), "Notes");
    expect(() => parsePplWorkbook(wb, META)).toThrow(/Cover, Notes/);
  });
});

describe("the real workbook, when present", () => {
  const path = fileURLToPath(new URL("../../data/programs/sources/nippard-ultimate-ppl-4x.xlsx", import.meta.url));
  it.skipIf(!existsSync(path))("converts with every dose parsing, 13 weeks in 3 blocks, four days a week", () => {
    const { program: p, skipped } = parsePplWorkbook(XLSX.readFile(path), { name: "x", description: "x", citation: null, sourceUrl: null });
    expect(skipped).toEqual([]);
    expect(p.blocks).toHaveLength(3);
    expect(p.blocks.reduce((n, b) => n + b.weeks.length, 0)).toBe(13);
    const bad: string[] = [];
    for (const b of p.blocks) for (const w of b.weeks) {
      expect(w.days.map((d) => d.name), `week ${w.week}`).toEqual(["Legs", "Push", "Pull", "Full Body"]);
      for (const d of w.days) for (const e of d.exercises) {
        if (!parseDose(e.dose)) bad.push(`${b.name} W${w.week} ${d.name}: ${e.name} -> ${e.dose}`);
        expect(e.warmUp === null || /^\d+(-\d+)?$/.test(e.warmUp), `${e.name} warmUp ${e.warmUp}`).toBe(true);
        expect(e.rpe === null || /^\d+(-\d+)?$/.test(e.rpe), `${e.name} rpe ${e.rpe}`).toBe(true);
      }
    }
    expect(bad).toEqual([]);
  });
});
