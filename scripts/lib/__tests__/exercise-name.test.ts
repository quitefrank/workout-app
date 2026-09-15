import { describe, expect, it } from "vitest";
import { exerciseSlug, parseExerciseName, slugCandidates } from "../exercise-name";

describe("parseExerciseName", () => {
  describe("arrow parsing", () => {
    it("captures the upstairs arrow and strips it from the name", () => {
      const r = parseExerciseName("Chest Press ↑");
      expect(r.name).toBe("Chest Press");
      expect(r.machineLocation).toBe("upstairs");
      expect(r.equipmentType).toBe("machine");
    });

    it("captures the downstairs arrow", () => {
      const r = parseExerciseName("Lat Pulldown ↓");
      expect(r.name).toBe("Lat Pulldown");
      expect(r.machineLocation).toBe("downstairs");
      expect(r.equipmentType).toBe("machine");
    });

    it("forces machine when arrow exists even if name lacks the word", () => {
      const r = parseExerciseName("Pec Deck ↑");
      expect(r.equipmentType).toBe("machine");
    });

    it("collapses internal whitespace left by arrow stripping", () => {
      const r = parseExerciseName("Chest Press  ↑  Wide Grip");
      expect(r.name).toBe("Chest Press Wide Grip");
    });

    it("returns null machineLocation when no arrow", () => {
      const r = parseExerciseName("Squat");
      expect(r.machineLocation).toBeNull();
    });

    it("drops parentheses the arrow leaves empty", () => {
      const r = parseExerciseName("Cable Press Around (↑)");
      expect(r.name).toBe("Cable Press Around");
      expect(r.machineLocation).toBe("upstairs");
    });

    it("drops padded empty parentheses too", () => {
      const r = parseExerciseName("Cable Y-Raise ( ↓ )");
      expect(r.name).toBe("Cable Y-Raise");
      expect(r.machineLocation).toBe("downstairs");
    });
  });

  describe("equipment inference - explicit markers", () => {
    it("BB -> barbell", () => {
      expect(parseExerciseName("BB Bench Press").equipmentType).toBe("barbell");
    });

    it("Barbell -> barbell", () => {
      expect(parseExerciseName("Barbell Row").equipmentType).toBe("barbell");
    });

    it("DB -> dumbbell", () => {
      expect(parseExerciseName("DB Bench Press (Flat)").equipmentType).toBe(
        "dumbbell",
      );
    });

    it("Dumbbell -> dumbbell", () => {
      expect(parseExerciseName("Dumbbell Curl").equipmentType).toBe("dumbbell");
    });

    it("Cable -> cable", () => {
      expect(parseExerciseName("Cable Fly").equipmentType).toBe("cable");
    });

    it("Cable Row stays cable, not cardio_machine", () => {
      expect(parseExerciseName("Cable Row").equipmentType).toBe("cable");
    });

    it("DB Row stays dumbbell, not cardio_machine", () => {
      expect(parseExerciseName("DB Row").equipmentType).toBe("dumbbell");
    });

    it("BB Row stays barbell, not cardio_machine", () => {
      expect(parseExerciseName("BB Row").equipmentType).toBe("barbell");
    });

    it("Machine -> machine", () => {
      expect(parseExerciseName("Leg Press Machine").equipmentType).toBe(
        "machine",
      );
    });
  });

  describe("equipment inference - cardio", () => {
    it("Elliptical -> cardio_machine", () => {
      expect(parseExerciseName("Elliptical").equipmentType).toBe(
        "cardio_machine",
      );
    });

    it("plain Row is a pull, not cardio: other", () => {
      expect(parseExerciseName("Row").equipmentType).toBe("other");
    });

    it("Rowing -> cardio_machine", () => {
      expect(parseExerciseName("Rowing").equipmentType).toBe("cardio_machine");
    });

    it("Rowing Machine -> cardio_machine, ahead of the machine rule", () => {
      expect(parseExerciseName("Rowing Machine").equipmentType).toBe("cardio_machine");
    });

    it("Rower -> cardio_machine", () => {
      expect(parseExerciseName("Rower").equipmentType).toBe("cardio_machine");
    });

    it("rowing exercises without an equipment word are other", () => {
      expect(parseExerciseName("Kroc Row").equipmentType).toBe("other");
      expect(parseExerciseName("Pendlay Row").equipmentType).toBe("other");
    });

    it("Machine Low Row -> machine", () => {
      expect(parseExerciseName("Machine Low Row").equipmentType).toBe("machine");
    });
  });

  describe("equipment inference - bodyweight", () => {
    it("Pullup -> bodyweight", () => {
      expect(parseExerciseName("Pullup").equipmentType).toBe("bodyweight");
    });

    it("Pull-up -> bodyweight", () => {
      expect(parseExerciseName("Pull-up").equipmentType).toBe("bodyweight");
    });

    it("Pushup -> bodyweight", () => {
      expect(parseExerciseName("Pushup").equipmentType).toBe("bodyweight");
    });

    it("Dips -> bodyweight", () => {
      expect(parseExerciseName("Dips").equipmentType).toBe("bodyweight");
    });

    it("Plank -> bodyweight", () => {
      expect(parseExerciseName("Side Plank").equipmentType).toBe("bodyweight");
    });
  });

  describe("equipment inference - other (hand-fix bucket)", () => {
    it("Squat with no qualifiers -> other", () => {
      expect(parseExerciseName("Squat").equipmentType).toBe("other");
    });

    it("Lunges -> other", () => {
      expect(parseExerciseName("Lunges").equipmentType).toBe("other");
    });
  });

  describe("real-world Notion samples", () => {
    it("matches the canonical example DB Bench Press (Flat)", () => {
      const r = parseExerciseName("DB Bench Press (Flat)");
      expect(r).toEqual({
        name: "DB Bench Press (Flat)",
        machineLocation: null,
        equipmentType: "dumbbell",
      });
    });

    it("parses an upstairs machine variant", () => {
      const r = parseExerciseName("↑ Chest Press");
      expect(r).toEqual({
        name: "Chest Press",
        machineLocation: "upstairs",
        equipmentType: "machine",
      });
    });
  });
});

describe("exerciseSlug", () => {
  it("lower-cases and hyphenates", () => {
    expect(exerciseSlug("Seated Cable Row", null)).toBe("seated-cable-row");
  });

  it("strips arrows and punctuation", () => {
    expect(exerciseSlug("Leg Press ↑", null)).toBe("leg-press");
    expect(exerciseSlug("Pull-ups (weighted)", null)).toBe("pull-ups-weighted");
  });

  it("collapses runs of separators", () => {
    expect(exerciseSlug("Single-leg  calf raise, sound leg", null)).toBe(
      "single-leg-calf-raise-sound-leg",
    );
  });

  it("suffixes machine location so variants stay distinct", () => {
    expect(exerciseSlug("Chest Press", "upstairs")).toBe("chest-press-upstairs");
    expect(exerciseSlug("Chest Press", "downstairs")).toBe("chest-press-downstairs");
  });

  it("is unchanged for names whose arrow sat inside parentheses", () => {
    expect(exerciseSlug("Cable Press Around (↑)", "upstairs")).toBe(
      "cable-press-around-upstairs",
    );
    expect(exerciseSlug("Cable Y-Raise ( ↓ )", "downstairs")).toBe(
      "cable-y-raise-downstairs",
    );
  });
});

describe("slugCandidates", () => {
  it("puts the exact slug first, then singular or plural, then the abbreviation swaps, then both", () => {
    expect(slugCandidates("pull-up")).toEqual(["pull-up", "pull-ups"]);
    expect(slugCandidates("pull-ups")).toEqual(["pull-ups", "pull-up", "pull-upss"]);
    expect(slugCandidates("db-row")).toEqual(["db-row", "db-rows", "dumbbell-row", "dumbbell-rows"]);
    expect(slugCandidates("dumbbell-rows")).toEqual(["dumbbell-rows", "dumbbell-row", "dumbbell-rowss", "db-rows", "db-row", "db-rowss"]);
    expect(slugCandidates("bb-curl")).toEqual(["bb-curl", "bb-curls", "barbell-curl", "barbell-curls"]);
    expect(slugCandidates("barbell-curl")).toEqual(["barbell-curl", "barbell-curls", "bb-curl", "bb-curls"]);
  });

  it("swaps only whole hyphen-separated tokens", () => {
    expect(slugCandidates("dbz-press")).toEqual(["dbz-press", "dbz-pres", "dbz-presss"]);
    expect(slugCandidates("seated-db-shoulder-press")).toContain("seated-dumbbell-shoulder-press");
    expect(slugCandidates("db")).toEqual(["db", "dbs", "dumbbell", "dumbbells"]);
  });

  it("never repeats a candidate", () => {
    const c = slugCandidates("db-db-row");
    expect(new Set(c).size).toBe(c.length);
    expect(c).toContain("dumbbell-dumbbell-row");
  });
});
