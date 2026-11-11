// @vitest-environment node

import { describe, expect, it } from "vitest";
import { blockFor, dayName, parsePowerbuilding3 } from "../powerbuilding3-pdf";
import type { PdfTables } from "../pdf-program";
import { validateProgramJson } from "../../data/programs/schema";
import { parseDose } from "../../../src/lib/recovery/dose";

const META = { name: "Test PB3", description: "d", citation: null, sourceUrl: null };
const header = (w: string) => [`WEEK ${w}`, "EXERCISE", "WARM-UP SETS", "WORKING SETS", "REPS", "%1RM", "RPE", "REST", "SET 1", "SET 2", "SET 3", "SET 4", "NOTES"];
const banner = (text: string) => [text, "", "", "", "", "", "", "", "", "", "", "", ""];
const row = (day: string, name: string, warm: string, sets: string, reps: string, pct: string, rpe: string, rest: string, notes: string) => [day, name, warm, sets, reps, pct, rpe, rest, "", "", "", "", notes];

function weekPage(w: string, tables: string[][][]): PdfTables["pages"][number] {
  return { page: 0, text: [`POWERBUILDING 3.0 - JEFF NIPPARD WEEK ${w}`], tables };
}

/** Ten weeks, one day each, the minimum the contract accepts; week 1 carries the cases. */
function dump(): PdfTables {
  const filler = (w: string, n: number) => [header(w), row(`FULL\nBODY\n${n}`, "BACK SQUAT", "4", "2", "6", "70%", "7-8", "3-5MIN", "")];
  const pages: PdfTables["pages"] = [
    weekPage("1", [
      [
        header("1"),
        row("FULL\nBODY\n1", "BACK SQUAT (TOP SINGLE)", "4", "1", "1", "85-87.5%", "~6-8", "3-5MIN", "TOP SET. FOCUS ON TECHNIQUE AND EXPLOSIVE POWER."),
        row("", "BACK SQUAT", "0", "3", "5", "75-77.5%", "7-8", "3-5MIN", "SIT BACK AND DOWN"),
        row("", "PIN GOOD MORNING (OR 45°\nBACK EXTENSION)", "2", "2", "8-10", "N/A", "6", "2-3MIN", "SET THE PINS HIGH"),
      ],
      [header("1"), row("FULL\nBODY\n2", "BARBELL (OR EZ-BAR) STRICT\nCURL", "1", "4", "6-8", "N/A", "10", "1-2MIN", "LEAN AGAINST WALL")],
    ]),
  ];
  for (let w = 2; w <= 9; w++) {
    const tables = [filler(String(w), 1)];
    if (w === 5 || w === 9) tables[0].unshift(banner(w === 5 ? "SEMI-DELOAD WEEK - AVOID FAILURE" : "TAPER WEEK - LOCK IN TECHNIQUE"));
    pages.push(weekPage(String(w), tables));
  }
  pages.push(weekPage("10A", [[banner("MAX TESTING OPTION A"), header("10A"), row("SQUAT\nTEST:", "BACK SQUAT", "5", "1+", "1", "100-105%", "9.5-10", "4-6MIN", "AIM FOR A NEW PR")]]));
  pages.push(weekPage("10B", [[banner("MAX TESTING OPTION B"), header("10B"), row("SQUAT\nTEST:", "BACK SQUAT", "5", "1", "AMRAP", "90%", "9.5-10", "4-6MIN", "AS MANY REPS AS POSSIBLE.")]]));
  // An example table in the explanatory pages, no week marker: skipped.
  pages.push({ page: 75, text: ["The goal is to select a weight", "WEEK 1 EXERCISE WARM-UP SETS"], tables: [[header("1"), row("FULL\nBODY\n1", "BACK SQUAT", "4", "1", "1", "85%", "8", "3-5MIN", "")]] });
  return { file: "test.pdf", pages };
}

describe("parsePowerbuilding3", () => {
  it("builds the blocks from the PDF's framing, with week 5 and week 9 apart", () => {
    const { program, skipped } = parsePowerbuilding3(dump(), META);
    expect(skipped).toEqual([]);
    expect(program.blocks.map((b) => [b.name, b.weeks.map((w) => w.week)])).toEqual([
      ["Loading", [1, 2, 3, 4]],
      ["Semi-Deload", [5]],
      ["Loading", [6, 7, 8]],
      ["Taper", [9]],
      ["Max Testing", [10]],
    ]);
    expect(() => validateProgramJson(program)).not.toThrow();
  });

  it("loads option B for week 10 and reports option A as omitted", () => {
    const { program, omitted } = parsePowerbuilding3(dump(), META);
    const test = program.blocks[4].weeks[0].days[0];
    expect(test.name).toBe("Squat Test");
    expect(test.exercises[0]).toMatchObject({ dose: "1 x AMRAP", rpe: "9.5-10", notes: "As many reps as possible. Load: 90% 1RM" });
    expect(omitted).toEqual(["Week 10A (max testing option A, heavy singles for competitive powerlifters): 1 table not converted; option B (AMRAP) is the one loaded"]);
  });

  it("drops a banner row above the header", () => {
    const { program } = parsePowerbuilding3(dump(), META);
    expect(program.blocks[1].weeks[0].days.map((d) => d.name)).toEqual(["Full Body 1"]);
    expect(program.blocks[1].weeks[0].days[0].exercises).toHaveLength(1);
  });

  it("maps cells to the contract", () => {
    const { program } = parsePowerbuilding3(dump(), META);
    const [top, back, gm] = program.blocks[0].weeks[0].days[0].exercises;
    expect(top).toMatchObject({ name: "Back Squat", variant: "Top Single", warmUp: "4", dose: "1 x 1", rpe: "6-8", rest: "~3-5 min" });
    expect(top.notes).toBe("Top set. Focus on technique and explosive power. Load: 85-87.5% 1RM. Approximate RPE");
    expect(back).toMatchObject({ name: "Back Squat", variant: null, warmUp: null, dose: "3 x 5", rpe: "7-8" });
    expect(gm).toMatchObject({ name: "Pin Good Morning", sub1: "45° Back Extension", dose: "2 x 8-10" });
    for (const e of program.blocks.flatMap((b) => b.weeks.flatMap((w) => w.days.flatMap((d) => d.exercises)))) expect(parseDose(e.dose)).not.toBeNull();
  });

  it("splits an (OR ...) name into the exercise and its substitution, EZ bar first", () => {
    const { program } = parsePowerbuilding3(dump(), META);
    expect(program.blocks[0].weeks[0].days[1].exercises[0]).toMatchObject({ name: "EZ-Bar Strict Curl", sub1: "Barbell Strict Curl" });
  });

  it("reports an OR name it has no choice for", () => {
    const d = dump();
    d.pages[0].tables[1][1][1] = "CABLE (OR BAND) ROW";
    const { skipped } = parsePowerbuilding3(d, META);
    expect(skipped).toEqual([{ block: "Loading", week: 1, day: "Full Body 2", name: "CABLE (OR BAND) ROW", reason: "an \"OR\" name with no NAME_CHOICES entry" }]);
  });
});

describe("helpers", () => {
  it("names days without the trailing colon", () => {
    expect(dayName("FULL\nBODY\n3")).toBe("Full Body 3");
    expect(dayName("DEADLIFT\nTEST:")).toBe("Deadlift Test");
  });

  it("puts weeks in blocks", () => {
    expect([1, 4, 5, 6, 8, 9, 10].map(blockFor)).toEqual(["Loading", "Loading", "Semi-Deload", "Loading", "Loading", "Taper", "Max Testing"]);
  });
});
