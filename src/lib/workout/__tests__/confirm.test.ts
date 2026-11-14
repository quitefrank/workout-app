import { describe, expect, it } from "vitest";
import { deleteAsk, exitAsk, removeAsk } from "../confirm";

describe("exitAsk", () => {
  it("asks with nothing logged", () => {
    expect(exitAsk(0)).toEqual({
      title: "Exit Workout Early?",
      message: "Nothing is logged yet. The workout and its time are deleted.",
      action: "Delete",
    });
  });
  it("names the sets that go", () => {
    expect(exitAsk(1).message).toBe("The workout and its 1 set logged are deleted. This cannot be undone.");
    expect(exitAsk(6).message).toBe("The workout and its 6 sets logged are deleted. This cannot be undone.");
  });
  it("keeps the action short enough for the alert's side-by-side capsule", () => {
    expect(exitAsk(3).action.length).toBeLessThanOrEqual(9);
    expect(removeAsk("Bench Press", 0).action.length).toBeLessThanOrEqual(9);
  });
});

describe("deleteAsk", () => {
  it("names the sets that go with the workout", () => {
    expect(deleteAsk(1).message).toBe("Its 1 set goes with it. This cannot be undone.");
    expect(deleteAsk(12).message).toBe("Its 12 sets go with it. This cannot be undone.");
    expect(deleteAsk(0).message).toBe("This cannot be undone.");
    expect(deleteAsk(0).action).toBe("Delete Workout");
  });
});

describe("removeAsk", () => {
  it("always asks, naming the exercise and any logged sets", () => {
    expect(removeAsk("Bench Press", 0)).toEqual({
      title: "Remove Exercise?",
      message: "Bench Press comes out of this workout.",
      action: "Remove",
    });
    expect(removeAsk("Bench Press", 3).message).toBe("Bench Press and its 3 sets logged come out of this workout.");
  });
});
