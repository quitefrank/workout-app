// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parsePpl1 } from "../ppl1-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const HEADER = (day: string) => [day, "SETS", "REPS", "RPE/%1RM", "REST", "1", "2", "3", "4", "NOTES", "LSRPE"];
const META = { name: "Test PPL", description: "d", citation: null, sourceUrl: null };

function cover(block: number): PdfTables["pages"][number] {
  return { page: 0, text: [`B L O C K ${block}`, "L E G S / P U S H / P U L L", "PROGRAM"], tables: [[["", `B L O C K ${block}`]], [["W E E K"], ["1"]]] };
}

const DUMP: PdfTables = {
  file: "test.pdf",
  pages: [
    cover(1),
    {
      page: 2,
      text: ["LEGS/PUSH/PULL HYPERTROPHY PROGRAM", "WEEK 1: DAYS 1-4", "BLOCK 1"],
      tables: [
        [HEADER("LEGS #1"), ["BACK SQUAT", "4", "5", "70%", "3-4MIN", "", "", "", "", "SIT BACK AND DOWN", ""], ["A1: LEG EXTENSION", "3", "15", "7", "0 MIN", "", "", "", "", "SQUEEZE", ""], ["A2: SEATED LEG CURL", "3", "15", "7", "1-2MIN", "", "", "", "", "", ""]],
        [HEADER("PUSH #1"), ["DUMBBELL ISOLATERAL SKULL\nCRUSHER", "3", "12", "8", "1-2MIN", "", "", "", "", "USE 1 DUMBBELL\nIN EACH HAND", ""], ["PLANK", "3", "30SEC", "7", "1-2MIN", "", "", "", "", "", ""]],
      ],
    },
    {
      page: 3,
      text: ["PULL #1 SETS REPS RPE/%1RM REST 1 2 3 4 NOTES LSRPE"],
      tables: [[HEADER("PULL #1"), ["REVERSE PEC DECK", "3", "15/15", "7", "1-2MIN", "", "", "", "", "", ""], ["DUMBBELL WALKING LUNGE", "2", "20 EACH LEG", "7", "1-2MIN", "", "", "", "", "", ""]]],
    },
    cover(1),
    {
      page: 5,
      text: ["LEGS/PUSH/PULL HYPERTROPHY PROGRAM", "WEEK 2: DAYS 1-4"],
      tables: [[HEADER("LEGS #1"), ["BACK SQUAT", "4", "5", "72.50%", "3-4MIN", "", "", "", "", "", ""]]],
    },
    cover(2),
    {
      page: 7,
      text: ["LEGS/PUSH/PULL HYPERTROPHY PROGRAM", "WEEK 1: DAYS 1-3"],
      tables: [[HEADER("LEGS #1"), ["DEADLIFT", "` 1", "RPE 9 TEST", "9", "3-4MIN", "", "", "", "", "", ""], ["MYSTERY MOVE", "3", "SEE NOTES", "7", "1-2MIN", "", "", "", "", "", ""]]],
    },
  ],
};

describe("parsePpl1", () => {
  it("builds blocks, global weeks and days from the page markers", () => {
    const { program } = parsePpl1(DUMP, META);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([
      ["Block 1", [1, 2]],
      ["Block 2", [3]],
    ]);
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Legs #1", "Push #1", "Pull #1"]);
  });

  it("maps cells to the contract", () => {
    const { program } = parsePpl1(DUMP, META);
    const legs = program.blocks[0].weeks[0].days[0].exercises;
    expect(legs[0]).toMatchObject({ name: "Back Squat", variant: null, dose: "4 x 5", rpe: null, rest: "~3-4 min", warmUp: null, sub1: null, sub2: null });
    expect(legs[0].notes).toBe("Sit back and down. Load: 70% 1RM");
    expect(legs[1]).toMatchObject({ name: "Leg Extension", dose: "3 x 15", rpe: "7", rest: "0 min" });
    expect(legs[1].notes).toBe("Superset A. Squeeze");
    expect(legs[2].notes).toBe("Superset A");
    const push = program.blocks[0].weeks[0].days[1].exercises;
    expect(push[0]).toMatchObject({ name: "Dumbbell Isolateral Skull Crusher", notes: "Use 1 dumbbell in each hand" });
    expect(push[1]).toMatchObject({ dose: "3 x 30 sec" });
    const pull = program.blocks[0].weeks[0].days[2].exercises;
    expect(pull[0]).toMatchObject({ dose: "3 x 15", notes: "15 per side" });
    expect(pull[1]).toMatchObject({ dose: "2 x 20", notes: "As written: 20 each leg" });
    expect(program.blocks[0].weeks[1].days[0].exercises[0].notes).toBe("Load: 72.5% 1RM");
  });

  it("reports rows it cannot dose and never drops them", () => {
    const { program, skipped } = parsePpl1(DUMP, META);
    expect(skipped).toEqual([{ block: "Block 2", week: 3, day: "Legs #1", name: "MYSTERY MOVE", reason: expect.stringContaining("no dose") }]);
    expect(program.blocks[1].weeks[0].days[0].exercises[0]).toMatchObject({ name: "Deadlift", dose: "1 x 1", notes: "As written: RPE 9 TEST" });
  });

  it("produces a valid programme whose doses all parse", () => {
    const { program } = parsePpl1(DUMP, META);
    const valid = validateProgramJson(program);
    for (const b of valid.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) expect(parseDose(e.dose), e.name).not.toBeNull();
  });
});
