import { describe, expect, it } from "vitest";
import { deleteAsk, exitAsk } from "../confirm";

describe("exitAsk", () => {
  it("exits without asking when nothing is logged", () => {
    expect(exitAsk(0)).toBeNull();
  });
  it("offers delete and complete once a set is logged", () => {
    expect(exitAsk(1)).toEqual({
      title: "Exit Workout Early?",
      message: "1 set logged. Complete the workout to keep them.",
      delete: "Delete Workout",
      complete: "Complete Workout",
    });
    expect(exitAsk(6)?.message).toBe("6 sets logged. Complete the workout to keep them.");
  });
});

describe("deleteAsk", () => {
  it("names the sets that go with the workout", () => {
    expect(deleteAsk(1).message).toBe("Its 1 set goes with it. This cannot be undone.");
    expect(deleteAsk(12).message).toBe("Its 12 sets go with it. This cannot be undone.");
    expect(deleteAsk(0).message).toBe("This cannot be undone.");
  });
});
