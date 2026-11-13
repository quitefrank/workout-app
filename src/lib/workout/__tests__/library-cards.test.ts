import { describe, expect, it } from "vitest";
import { cardFor, libraryCards } from "../library-cards";

const names = ["Abs", "Biceps", "Chest", "Glutes", "Back", "Shoulders", "Hamstrings", "Calves", "Quadriceps", "Triceps", "Stretches", "Cardio", "Forearms", "Neck"];
const groups = names.map((name) => ({ id: name.toLowerCase(), name }));

describe("libraryCards", () => {
  it("turns the fourteen groups into twelve cards, four full rows of three", () => {
    const cards = libraryCards(groups);
    expect(cards).toHaveLength(12);
    expect(cards.length % 3).toBe(0);
  });

  it("folds Forearms into Biceps and Neck into Shoulders, the card's own group first", () => {
    const cards = libraryCards(groups);
    expect(cards.find((c) => c.name === "Biceps")?.members.map((m) => m.name)).toEqual(["Biceps", "Forearms"]);
    expect(cards.find((c) => c.name === "Shoulders")?.members.map((m) => m.name)).toEqual(["Shoulders", "Neck"]);
    expect(cards.map((c) => c.name)).not.toContain("Forearms");
    expect(cards.map((c) => c.name)).not.toContain("Neck");
  });

  it("keeps the groups' order", () => {
    expect(libraryCards(groups).map((c) => c.name)).toEqual(names.filter((n) => n !== "Forearms" && n !== "Neck"));
  });

  it("leaves a group its own card when its parent is missing", () => {
    const cards = libraryCards(groups.filter((g) => g.name !== "Biceps"));
    expect(cards.find((c) => c.name === "Forearms")?.members.map((m) => m.name)).toEqual(["Forearms"]);
  });
});

describe("cardFor", () => {
  it("opens a folded group's parent card", () => {
    expect(cardFor(groups, "forearms")?.name).toBe("Biceps");
    expect(cardFor(groups, "chest")?.members).toHaveLength(1);
    expect(cardFor(groups, "nope")).toBeUndefined();
  });
});
