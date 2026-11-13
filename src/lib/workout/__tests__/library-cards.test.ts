import { describe, expect, it } from "vitest";
import { cardFor, isSecondary, libraryCards, partLabel, primaryPart } from "../library-cards";

const names = ["Abs", "Biceps", "Chest", "Glutes", "Back", "Shoulders", "Hamstrings", "Calves", "Quadriceps", "Triceps", "Stretches", "Cardio", "Forearms", "Neck"];
const groups = names.map((name) => ({ id: name.toLowerCase(), name }));
const card = (slug: string) => libraryCards(groups).find((c) => c.slug === slug)!;
const item = (name: string, group: string, movement: string | null = null, secondaryGroups: string[] = []) => ({ name, group, movement, secondaryGroups });

describe("libraryCards", () => {
  it("makes twelve cards from the fourteen groups, four full rows of three, in the grid's order", () => {
    expect(libraryCards(groups).map((c) => c.name)).toEqual([
      "Core", "Biceps", "Chest", "Glutes", "Lats", "Upper Back", "Shoulders", "Hamstrings", "Calves", "Quadriceps", "Triceps", "Stretches",
    ]);
  });

  it("folds Forearms into Biceps and Neck into Shoulders, and gives Cardio no card", () => {
    expect(card("biceps").parts.map((p) => p.group)).toEqual(["Biceps", "Forearms"]);
    expect(card("shoulders").parts.map((p) => p.group)).toEqual(["Shoulders", "Neck"]);
    expect(libraryCards(groups).some((c) => c.parts.some((p) => p.group === "Cardio"))).toBe(false);
  });

  it("shows Abs as Core with the Abs drawing", () => {
    expect(card("core")).toMatchObject({ name: "Core", art: "Abs" });
    expect(partLabel(card("core").parts[0])).toBe("Core");
  });

  it("drops a part whose group is missing, and gives a group no card names a card of its own", () => {
    const some = libraryCards([...groups.filter((g) => g.name !== "Forearms"), { id: "x", name: "Adductors" }]);
    expect(some.find((c) => c.slug === "biceps")?.parts.map((p) => p.group)).toEqual(["Biceps"]);
    expect(some.at(-1)).toMatchObject({ slug: "adductors", name: "Adductors" });
  });
});

describe("the Back split", () => {
  it("puts the pulldown and pull-up families on Lats and the rest of Back on Upper Back", () => {
    for (const m of ["Lat Pulldown", "Pull-Up", "Chin-Up", "Lat Pull-Over"]) {
      expect(primaryPart(card("lats"), item("x", "Back", m))).toBeTruthy();
      expect(primaryPart(card("upper-back"), item("x", "Back", m))).toBeUndefined();
    }
    for (const m of ["Row", "Shrug"]) {
      expect(primaryPart(card("upper-back"), item("x", "Back", m))).toBeTruthy();
      expect(primaryPart(card("lats"), item("x", "Back", m))).toBeUndefined();
    }
  });

  it("matches a row with no family by its name", () => {
    expect(primaryPart(card("lats"), item("Muscle Up", "Back"))).toBeTruthy();
    expect(primaryPart(card("lats"), item("1-Arm Lat Pull-In", "Back"))).toBeTruthy();
  });

  it("lists a Back secondary on Upper Back only", () => {
    const deadlift = item("Deadlift", "Hamstrings", "Deadlift", ["Glutes", "Back"]);
    expect(isSecondary(card("upper-back"), deadlift)).toBe(true);
    expect(isSecondary(card("lats"), deadlift)).toBe(false);
  });
});

describe("isSecondary", () => {
  it("lists a back lift under Biceps when Biceps is its secondary", () => {
    expect(isSecondary(card("biceps"), item("Row", "Back", "Row", ["Biceps", "Shoulders"]))).toBe(true);
  });

  it("never lists an exercise as secondary on the card it is primary on", () => {
    expect(isSecondary(card("biceps"), item("Curl", "Biceps", "Curl", ["Forearms"]))).toBe(false);
  });

  it("lists cardio under the leg cards it names", () => {
    const run = item("Treadmill Run", "Cardio", null, ["Quadriceps", "Hamstrings", "Glutes", "Calves"]);
    for (const slug of ["quadriceps", "hamstrings", "glutes", "calves"]) expect(isSecondary(card(slug), run)).toBe(true);
    expect(isSecondary(card("chest"), run)).toBe(false);
  });
});

describe("cardFor", () => {
  it("finds a card by slug", () => {
    expect(cardFor(groups, "upper-back")?.name).toBe("Upper Back");
  });

  it("opens an old link to a group id on the card that shows it", () => {
    expect(cardFor(groups, "forearms")?.name).toBe("Biceps");
    expect(cardFor(groups, "back")?.name).toBe("Lats");
  });

  it("shows a hidden group alone, and nothing for an unknown key", () => {
    expect(cardFor(groups, "cardio")).toMatchObject({ name: "Cardio", parts: [{ group: "Cardio" }] });
    expect(cardFor(groups, "nope")).toBeUndefined();
  });
});
