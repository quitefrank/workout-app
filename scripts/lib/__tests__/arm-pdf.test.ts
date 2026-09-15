// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parseArm } from "../arm-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const META = { name: "Test Arms", description: "d", citation: null, sourceUrl: null };
const HEAD = (day: string) => [day, "SETS", "REPS", "TEMPO", "APE", "REST", "1", "2", "3", "4", "NOTES"];
const row = (name: string, sets: string, reps: string, tempo: string, rpe: string, rest: string, notes: string) => [name, sets, reps, tempo, rpe, rest, "", "", "", "", notes];

function weekPage(block: string, week: number, tables: string[][][]): PdfTables["pages"][number] {
  return { page: 0, text: ["ARM HYPERTROPHY", "BLOCK", block, `PROGRAM: WEEK ${week}`], tables: [[["BLOCK"], [block]], ...tables, [["JEFF NIPPARD", "ARM HYPERTROPHY PROGRAM", "7"]]] };
}

const DUMP: PdfTables = {
  file: "test.pdf",
  pages: [
    weekPage("1", 1, [
      [["ARM DAY", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 1"), row("CLOSE GRIP BENCH\nPRESS", "3", "6-8", "2:1:1:1", "8", "3.0", "SHOULDER WIDTH GRIP"), row("FOREARM WRIST\nCURL", "3", "15-20", "2:0:1:0", "9", "1.0", "OPTIONAL, BRACED")],
      [["SUPPLEMENTAL A", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 2"), row("INCLINE DUMBBELL\nCURL REVERSE 21'S", "2", "7+7+7", "-", "9", "1.5", "BOTH ARMS AT ONCE")],
      [["SUPPLEMENTAL B", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 3"), row("HEAVY NEGATIVE\nCONCENTRATION\nCURLS", "0", "0", "-", "10", "1.5", "CONTROL THE NEGATIVE"), row("FARMERS WALKS", "3", "40", "-", "", "1.0", "40 TOTAL STRIDES"), ["WEEKLY BICEP VOLUME", "19", "", "", "", "", "", "", "", "", ""], ["WEEKLY TRICEP VOLUME", "19", "", "", "", "", "", "", "", "", ""]],
    ]),
    weekPage("2", 5, [
      [["ARM DAY", "", "", "", "", "", "", "", "", "", ""], HEAD("DAY 1"), row("STANDING EZ BAR\nCURL (DESCENDING\nROM)", "2", "10+5+5", "-", "9", "1.5", "")],
    ]),
  ],
};

describe("parseArm", () => {
  it("builds blocks and weeks from the page markers", () => {
    const { program } = parseArm(DUMP, META);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([["Block 1", [1]], ["Block 2", [2]]]);
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Arm Day", "Supplemental A", "Supplemental B"]);
  });

  it("maps cells, tempo and decimal rest to the contract", () => {
    const { program } = parseArm(DUMP, META);
    const arm = program.blocks[0].weeks[0].days[0].exercises;
    expect(arm[0]).toMatchObject({ name: "Close Grip Bench Press", dose: "3 x 6-8", rpe: "8", rest: "3 min", notes: "Shoulder width grip. Tempo 2:1:1:1" });
    expect(arm[1]).toMatchObject({ name: "Forearm Wrist Curl", rest: "1 min", notes: "Optional, braced. Tempo 2:0:1:0" });
    const a = program.blocks[0].weeks[0].days[1].exercises;
    expect(a[0]).toMatchObject({ name: "Incline Dumbbell Curl", variant: "Reverse 21's", dose: "2 x 21", rest: "90 sec", notes: "Both arms at once. Reps: 7 + 7 + 7" });
    const b = program.blocks[0].weeks[0].days[2].exercises;
    expect(b[1]).toMatchObject({ name: "Farmers Walks", dose: "3 x 40", rpe: null, rest: "1 min" });
    expect(b.map((e) => e.name)).not.toContain("Weekly Bicep Volume");
    expect(program.blocks[1].weeks[0].days[0].exercises[0]).toMatchObject({ name: "Standing EZ Bar Curl", variant: "Descending ROM", dose: "2 x 20", notes: "Reps: 10 + 5 + 5" });
  });

  it("applies the open-ended set override and reports nothing else", () => {
    const { program, skipped } = parseArm(DUMP, META);
    expect(skipped).toEqual([]);
    const b = program.blocks[0].weeks[0].days[2].exercises;
    expect(b[0]).toMatchObject({ name: "Heavy Negative Concentration Curls", dose: "1 x AMRAP", notes: "Control the negative. Sets and reps as written: 0 / 0, an open-ended set; see the notes" });
  });

  it("produces a valid programme whose doses all parse", () => {
    const { program } = parseArm(DUMP, META);
    const valid = validateProgramJson(program);
    for (const bl of valid.blocks) for (const w of bl.weeks) for (const d of w.days) for (const e of d.exercises) expect(parseDose(e.dose), e.name).not.toBeNull();
  });
});
