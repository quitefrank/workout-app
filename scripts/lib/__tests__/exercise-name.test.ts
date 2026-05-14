import { describe, expect, it } from "vitest";
import { parseExerciseName } from "../exercise-name";

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

    it("plain Row -> cardio_machine (rowing machine assumption)", () => {
      expect(parseExerciseName("Row").equipmentType).toBe("cardio_machine");
    });

    it("Rowing -> cardio_machine", () => {
      expect(parseExerciseName("Rowing").equipmentType).toBe("cardio_machine");
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
