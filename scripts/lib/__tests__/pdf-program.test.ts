// @vitest-environment node

import { describe, expect, it } from "vitest";
import { cellText, doseFromPdf, percentOrRpe, restFromPdf, SUPERSET_RE, titleCaseName } from "../pdf-program";

describe("cellText", () => {
  it("collapses line breaks and blanks", () => {
    expect(cellText("CLOSE GRIP BENCH\nPRESS")).toBe("CLOSE GRIP BENCH PRESS");
    expect(cellText("  ")).toBeNull();
    expect(cellText("-")).toBeNull();
    expect(cellText("N/A")).toBeNull();
    expect(cellText(null)).toBeNull();
  });
});

describe("titleCaseName", () => {
  it("title-cases an all-caps name and keeps the known acronyms", () => {
    expect(titleCaseName("BARBELL BENCH PRESS")).toBe("Barbell Bench Press");
    expect(titleCaseName("REVERSE GRIP EZ BAR CURL")).toBe("Reverse Grip EZ Bar Curl");
    expect(titleCaseName("CHEST-SUPPORTED T-BAR ROW W/ BAND")).toBe("Chest-Supported T-Bar Row w/ Band");
    expect(titleCaseName("1-ARM OVERHEAD CABLE EXTENSION")).toBe("1-Arm Overhead Cable Extension");
    expect(titleCaseName("INCLINE DUMBBELL CURL (REVERSE 21'S)")).toBe("Incline Dumbbell Curl (Reverse 21's)");
    expect(titleCaseName("BARBELL OR EZ BAR CURL")).toBe("Barbell or EZ Bar Curl");
    expect(titleCaseName("ROUND-BACK DUMBBELL 45° HYPEREXTENSION")).toBe("Round-Back Dumbbell 45° Hyperextension");
    expect(titleCaseName("MILITARY PRESS / PUSH PRESS COMPLEX")).toBe("Military Press / Push Press Complex");
    expect(titleCaseName("NECK FLEXION/EXTENSION")).toBe("Neck Flexion/Extension");
  });
});

describe("SUPERSET_RE", () => {
  it("matches colon and dot prefixes", () => {
    expect("A1: LEG EXTENSION".replace(SUPERSET_RE, "")).toBe("LEG EXTENSION");
    expect("B2. TRICEPS PRESSDOWN".replace(SUPERSET_RE, "")).toBe("TRICEPS PRESSDOWN");
    expect(SUPERSET_RE.exec("C3. STANDING CALF RAISE")?.[1]).toBe("C");
  });
});

describe("restFromPdf", () => {
  it("normalises the PDF spellings to what the seed parses", () => {
    expect(restFromPdf("3-4MIN")).toBe("~3-4 min");
    expect(restFromPdf("1-2 MIN")).toBe("~1-2 min");
    expect(restFromPdf("0MIN")).toBe("0 min");
    expect(restFromPdf("0 MIN")).toBe("0 min");
    expect(restFromPdf("30SEC")).toBe("30 sec");
    expect(restFromPdf("3.0")).toBe("3 min");
    expect(restFromPdf("1.5")).toBe("90 sec");
    expect(restFromPdf("1.0")).toBe("1 min");
    expect(restFromPdf(null)).toBeNull();
  });
});

describe("percentOrRpe", () => {
  it("keeps an RPE and turns a percentage into a load note", () => {
    expect(percentOrRpe("7")).toEqual({ rpe: "7", loadNote: null });
    expect(percentOrRpe("7.5")).toEqual({ rpe: "7.5", loadNote: null });
    expect(percentOrRpe("8-9")).toEqual({ rpe: "8-9", loadNote: null });
    expect(percentOrRpe("70%")).toEqual({ rpe: null, loadNote: "Load: 70% 1RM" });
    expect(percentOrRpe("65.00%")).toEqual({ rpe: null, loadNote: "Load: 65% 1RM" });
    expect(percentOrRpe("72.5-77.5%")).toEqual({ rpe: null, loadNote: "Load: 72.5-77.5% 1RM" });
    expect(percentOrRpe("90 %")).toEqual({ rpe: null, loadNote: "Load: 90% 1RM" });
    expect(percentOrRpe("N/A")).toEqual({ rpe: null, loadNote: null });
    expect(percentOrRpe("NO REPS")).toEqual({ rpe: null, loadNote: "RPE as written: NO REPS" });
  });
});

describe("doseFromPdf", () => {
  it("passes plain sets and reps through", () => {
    expect(doseFromPdf("3", "8-10")).toEqual({ dose: "3 x 8-10", note: null });
    expect(doseFromPdf("1-3", "5")).toEqual({ dose: "1-3 x 5", note: null });
    expect(doseFromPdf("` 1", "AMRAP")).toEqual({ dose: "1 x AMRAP", note: null });
    expect(doseFromPdf("3", "30SEC")).toEqual({ dose: "3 x 30 sec", note: null });
    expect(doseFromPdf("1", "10-SEC")).toEqual({ dose: "1 x 10 sec", note: null });
  });

  it("keeps per-side and each-leg counts as a note", () => {
    expect(doseFromPdf("3", "15/15")).toEqual({ dose: "3 x 15", note: "15 per side" });
    expect(doseFromPdf("2", "20 EACH LEG")).toEqual({ dose: "2 x 20", note: "As written: 20 each leg" });
    expect(doseFromPdf("2", "12 STEPS\nEACH LEG")).toEqual({ dose: "2 x 12", note: "As written: 12 steps each leg" });
  });

  it("sums a rep-scheme cell and keeps the scheme", () => {
    expect(doseFromPdf("2", "7+7+7")).toEqual({ dose: "2 x 21", note: "Reps: 7 + 7 + 7" });
    expect(doseFromPdf("2", "10+5+5")).toEqual({ dose: "2 x 20", note: "Reps: 10 + 5 + 5" });
    expect(doseFromPdf("3", "4, 4")).toEqual({ dose: "3 x 4-4", note: "Reps per set: 4, 4" });
  });

  it("treats an RPE test cell as one rep and refuses what it cannot dose", () => {
    expect(doseFromPdf("1", "RPE 9 TEST")).toEqual({ dose: "1 x 1", note: "As written: RPE 9 TEST" });
    expect(doseFromPdf("0", "0")).toBeNull();
    expect(doseFromPdf("3", "")).toBeNull();
    expect(doseFromPdf("3", "SEE NOTES")).toBeNull();
  });
});
