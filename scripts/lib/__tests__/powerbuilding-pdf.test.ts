// @vitest-environment node

import { describe, expect, it } from "vitest";
import { parsePowerbuilding } from "../powerbuilding-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const HEADER = ["WORKOUT", "EXERCISE", "WARM-UP SETS", "WORKING SETS", "REPS", "%1RM", "RPE", "REST", "SET 1", "SET 2", "SET 3", "SET 4", "NOTES"];
const META = { name: "Test PB", description: "d", citation: null, sourceUrl: null };
const row = (workout: string, name: string, warm: string, sets: string, reps: string, pct: string, rpe: string, rest: string, notes: string) => [workout, name, warm, sets, reps, pct, rpe, rest, "", "", "", "", notes];

function weekPage(n: string, tables: string[][][]): PdfTables["pages"][number] {
  return { page: 0, text: [`JEFF NIPPARD'S - POWERBUILDING SYSTEM WEEK ${n}`], tables };
}

const DUMP: PdfTables = {
  file: "test.pdf",
  pages: [
    { page: 1, text: ["W E E K 1", "POWERBUILDING", "SYSTEM"], tables: [] },
    weekPage("1", [
      [HEADER, row("FULL\nBODY 1:\nSQUAT,\nOHP", "BACK SQUAT", "4", "1", "5", "75-80%", "7.5", "3-4 MIN", "FOCUS ON TECHNIQUE"), row("", "BACK SQUAT", "0", "2", "8", "70%", "N/A", "3-4 MIN", "")],
      [HEADER, row("FULL\nBODY 2:\nDEADLIFT,\nBENCH\nPRESS", "CHEST-SUPPORTED T-BAR ROW\nOR PENDLAY ROW", "1", "3", "10", "N/A", "7", "1-2 MIN", "STAY LIGHT")],
    ]),
    weekPage("2", [[HEADER, row("LOWER # 2", "LEG PRESS", "1", "3", "12/12", "N/A", "8", "1-2 MIN", "")]]),
    weekPage("10A", [[HEADER, row("SQUAT\nTEST", "BACK SQUAT", "4", "1", "AMRAP", "90%", "9.5", "4-5 MIN", "AIM TO 3+ REPS")]]),
    weekPage("10B", [[HEADER, row("SQUAT\nMAX", "BACK SQUAT", "4", "1", "1", "100-105%", "NO REPS", "4-5 MIN", "")]]),
    weekPage("11", [[HEADER, row("LOWER #1", "BACK SQUAT", "2", "2", "5", "60%", "N/A", "3-4 MIN", "")]]),
    { page: 9, text: ["JEFF NIPPARD'S - POWERBUILDING SYSTEM OPTIONAL DAY", "ARM & HYPERTROPHY DAY: OPTIONALLY RUN THIS DAY ON THE ODD WEEKS"], tables: [[HEADER, row("FULL\nBODY 5:\nARM &\nPUMP DAY", "A1. BARBELL OR EZ BAR CURL", "1", "3", "12", "N/A", "8", "30SEC", "MINIMIZE MOMENTUM."), row("", "B1. INCLINE DUMBBELL CURL\n(REVERSE 21'S)", "0", "3", "21", "N/A", "10", "30SEC", "")]] },
    { page: 10, text: ["TABLE 1: RESISTANCE TRAINING-SPECIFIC RIR-BASED RPE SCALE"], tables: [[HEADER, row("EXAMPLE", "BACK SQUAT", "4", "1", "5", "75-80%", "8", "3-4 MIN", "TOP SET")]] },
  ],
};

describe("parsePowerbuilding", () => {
  it("builds the three blocks, keeps option A for week 10 and reports option B as omitted", () => {
    const { program, omitted } = parsePowerbuilding(DUMP, META);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([
      ["Powerbuilding", [1, 2]],
      ["Max Testing", [3]],
      ["Deload", [4]],
    ]);
    expect(omitted).toEqual(["Week 10B (max testing option B, competitive powerlifters): 1 table not converted; option A is the one loaded"]);
  });

  it("names days from the WORKOUT cell without a colon", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    expect(program.blocks[0].weeks[0].days.map((d) => d.name)).toEqual(["Full Body 1 (Squat, OHP)", "Full Body 2 (Deadlift, Bench Press)", "Optional Arm and Pump Day"]);
    expect(program.blocks[0].weeks[1].days.map((d) => d.name)).toEqual(["Lower #2"]);
    expect(program.blocks[1].weeks[0].days.map((d) => d.name)).toEqual(["Squat Test"]);
  });

  it("maps cells to the contract", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const fb1 = program.blocks[0].weeks[0].days[0].exercises;
    expect(fb1[0]).toMatchObject({ name: "Back Squat", warmUp: "4", dose: "1 x 5", rpe: "7.5", rest: "~3-4 min", notes: "Focus on technique. Load: 75-80% 1RM" });
    expect(fb1[1]).toMatchObject({ name: "Back Squat", warmUp: null, dose: "2 x 8", rpe: null, notes: "Load: 70% 1RM" });
    const fb2 = program.blocks[0].weeks[0].days[1].exercises;
    expect(fb2[0]).toMatchObject({ name: "Chest-Supported T-Bar Row", sub1: "Pendlay Row", sub2: null, dose: "3 x 10", rpe: "7" });
    expect(program.blocks[0].weeks[1].days[0].exercises[0]).toMatchObject({ dose: "3 x 12", notes: "12 per side" });
    expect(program.blocks[1].weeks[0].days[0].exercises[0]).toMatchObject({ dose: "1 x AMRAP", rpe: "9.5", notes: "Aim to 3+ reps. Load: 90% 1RM" });
  });

  it("puts the optional day last on odd weeks only, with its arm-curl choice as a substitution", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const optional = program.blocks[0].weeks[0].days[2].exercises;
    expect(optional[0]).toMatchObject({ name: "EZ Bar Curl", sub1: "Barbell Curl", rest: "30 sec", notes: "Superset A. Minimize momentum." });
    expect(optional[1]).toMatchObject({ name: "Incline Dumbbell Curl", variant: "Reverse 21's", dose: "3 x 21", notes: "Superset B" });
    expect(program.blocks[0].weeks[1].days.some((d) => d.name.startsWith("Optional"))).toBe(false);
  });

  it("skips example tables on pages without a week marker", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const all = program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days.map((d) => d.name)));
    expect(all).not.toContain("Example");
  });

  it("produces a valid programme whose doses all parse", () => {
    const { program } = parsePowerbuilding(DUMP, META);
    const valid = validateProgramJson(program);
    for (const b of valid.blocks) for (const w of b.weeks) for (const d of w.days) for (const e of d.exercises) expect(parseDose(e.dose), e.name).not.toBeNull();
  });
});
