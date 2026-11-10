import { describe, expect, it } from "vitest";
import { stretchPairs, supersetOf } from "../pairs";

const row = (id: string, measure: "weight_reps" | "hold" | "reps", notes: string | null) => ({ id, notes, exercises: { measure } });

describe("supersetOf", () => {
  it("reads the letter a note opens with", () => {
    expect(supersetOf("Superset A. Brace with your non-working arm")).toBe("A");
    expect(supersetOf("superset b. Do both arms")).toBe("B");
    expect(supersetOf("Keep your pelvis tilted")).toBeNull();
    expect(supersetOf(null)).toBeNull();
    expect(supersetOf("Top Set · Superset C. Arc the dumbbells")).toBe("C");
    expect(supersetOf("Do not superset this")).toBeNull();
  });
});

describe("stretchPairs", () => {
  it("pairs a lift with the static stretch after it in the same superset", () => {
    const { stretchOf, liftOf } = stretchPairs([
      row("bench", "weight_reps", null),
      row("press-around", "weight_reps", "Superset A. Brace with your non-working arm"),
      row("pec", "hold", "Superset A. Hold a pec stretch for 30 seconds"),
      row("y-raise", "weight_reps", null),
    ]);
    expect([...stretchOf]).toEqual([["press-around", "pec"]]);
    expect([...liftOf]).toEqual([["pec", "press-around"]]);
  });

  it("leaves two lifts in a superset, a stretch from another superset and an unlabelled stretch alone", () => {
    const { stretchOf } = stretchPairs([
      row("curl", "weight_reps", "Superset B. Barbell or EZ"),
      row("pressdown", "weight_reps", "Superset B. Do both arms"),
      row("raise", "weight_reps", "Superset A. Lean into a bench"),
      row("delt", "hold", "Superset C. Hold a side delt stretch"),
      row("row", "weight_reps", "Superset D."),
      row("lat", "hold", null),
    ]);
    expect(stretchOf.size).toBe(0);
  });
});
