import { describe, expect, it } from "vitest";
import { workoutIcon } from "../icons";

describe("workoutIcon", () => {
  it("follows Notion's workout page icons", () => {
    expect(workoutIcon("push")).toBe("hand");
    expect(workoutIcon("pull")).toBe("dumbbell");
    expect(workoutIcon("legs")).toBe("pants");
    expect(workoutIcon("full_body")).toBe("figure");
    expect(workoutIcon("cardio")).toBe("shoe");
    expect(workoutIcon("abs")).toBe("shirt");
  });

  it("gives the categories Notion never had an icon", () => {
    expect(workoutIcon("arms")).toBe("dumbbell");
    expect(workoutIcon("rehab")).toBe("figure");
  });

  it("falls back to the dumbbell", () => {
    expect(workoutIcon(null)).toBe("dumbbell");
    expect(workoutIcon(undefined)).toBe("dumbbell");
    expect(workoutIcon("something-new")).toBe("dumbbell");
  });
});
