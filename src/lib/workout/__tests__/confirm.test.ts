import { describe, expect, it } from "vitest";
import { deleteAsk, exitAsk, removeAsk } from "../confirm";

describe("exitAsk", () => {
  it("asks with nothing logged, offering only the delete", () => {
    expect(exitAsk(0)).toEqual({
      title: "Exit Workout Early?",
      message: "Nothing is logged yet. The workout and its time are deleted.",
      delete: "Delete Workout",
      complete: null,
    });
  });
  it("offers delete and complete once a set is logged", () => {
    expect(exitAsk(1)).toEqual({
      title: "Exit Workout Early?",
      message: "1 set logged. Complete the workout to keep them.",
      delete: "Delete Workout",
      complete: "Complete Workout",
    });
    expect(exitAsk(6).message).toBe("6 sets logged. Complete the workout to keep them.");
  });
});

describe("deleteAsk", () => {
  it("names the sets that go with the workout", () => {
    expect(deleteAsk(1).message).toBe("Its 1 set goes with it. This cannot be undone.");
    expect(deleteAsk(12).message).toBe("Its 12 sets go with it. This cannot be undone.");
    expect(deleteAsk(0).message).toBe("This cannot be undone.");
  });
});

describe("removeAsk", () => {
  it("always asks, naming the exercise and any logged sets", () => {
    expect(removeAsk("Bench Press", 0)).toEqual({
      title: "Remove Exercise?",
      message: "Bench Press comes out of this workout.",
      remove: "Remove Exercise",
    });
    expect(removeAsk("Bench Press", 3).message).toBe("Bench Press and its 3 sets logged come out of this workout.");
  });
});
