import { describe, expect, it } from "vitest";
import {
  checkExercise,
  checkSpacing,
  checkTemplate,
} from "../authoring";
import type {
  AuthoringExercise,
  EquipmentItem,
  RestrictionState,
} from "../types";

function ex(partial: Partial<AuthoringExercise> & { id: string }): AuthoringExercise {
  return {
    name: partial.id,
    muscleGroup: "Back",
    supportRequired: "seated_supported",
    loadDirection: "vertical",
    loadsBootedFoot: false,
    ankleInvolvement: false,
    floorTransferRequired: false,
    equipmentNeeded: [],
    minHoursBetweenSessions: null,
    maxSessionsPerWeek: null,
    ...partial,
  };
}

const PARTIAL: RestrictionState = {
  clearedLoadPct: 50,
  ankleRomCleared: false,
  bootStatus: "on",
  wedgesRemoved: 0,
  strengthGate: null,
  currentPhaseId: null,
  daysSinceLastClearance: 1,
  isStale: false,
};

const OUT_OF_BOOT: RestrictionState = {
  ...PARTIAL,
  clearedLoadPct: 100,
  ankleRomCleared: true,
  bootStatus: "off",
};

const GYM: EquipmentItem[] = ["cable_tower", "dumbbells", "adjustable_bench", "half_rack", "mat"];

function levels(v: ReturnType<typeof checkExercise>) {
  return v.map((x) => `${x.level}:${x.rule}`);
}

describe("checkExercise, the hard-won rules", () => {
  it("rule 1: loading the booted foot is blocked while the boot is on", () => {
    const v = checkExercise(ex({ id: "leg press", loadsBootedFoot: true }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("blocked:1");
  });

  it("rule 1: still blocked at 100% load while the boot is on", () => {
    const v = checkExercise(ex({ id: "step up", loadsBootedFoot: true }), { ...PARTIAL, clearedLoadPct: 100 }, GYM, 1);
    expect(levels(v)).toContain("blocked:1");
  });

  it("rule 1: still blocked while weaning off the boot at full load", () => {
    const v = checkExercise(ex({ id: "step up", loadsBootedFoot: true }), { ...PARTIAL, bootStatus: "weaning", clearedLoadPct: 100 }, GYM, 1);
    expect(levels(v)).toContain("blocked:1");
  });

  it("rule 1: blocked out of the boot while load is still partial", () => {
    const v = checkExercise(ex({ id: "step up", loadsBootedFoot: true }), { ...PARTIAL, bootStatus: "off", clearedLoadPct: 75 }, GYM, 1);
    expect(levels(v)).toContain("blocked:1");
  });

  it("rule 2: ankle involvement is blocked until range of motion is cleared", () => {
    const v = checkExercise(ex({ id: "ankle pumps", ankleInvolvement: true }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("blocked:2");
    const ok = checkExercise(ex({ id: "ankle pumps", ankleInvolvement: true }), OUT_OF_BOOT, GYM, 1);
    expect(ok.every((x) => x.level === "ok")).toBe(true);
  });

  it("rule 3: a standing band row is blocked on one leg", () => {
    const v = checkExercise(
      ex({ id: "standing band row", supportRequired: "standing_supported", loadDirection: "sagittal", equipmentNeeded: ["resistance_band"] }),
      PARTIAL,
      [...GYM, "resistance_band"],
      1,
    );
    expect(levels(v)).toContain("blocked:3");
  });

  it("rule 3: standing free against a lateral load is blocked and also warns", () => {
    const v = checkExercise(ex({ id: "standing pallof", supportRequired: "standing_free", loadDirection: "lateral" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["blocked:3", "warn:4"]);
  });

  it("rule 4: standing free during partial weight-bearing warns even with a vertical load", () => {
    const v = checkExercise(ex({ id: "standing curl", supportRequired: "standing_free", loadDirection: "vertical" }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:4");
  });

  it("rule 5: the seated Pallof press is blocked", () => {
    const v = checkExercise(ex({ id: "seated pallof press", supportRequired: "seated_supported", loadDirection: "lateral" }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("blocked:5");
  });

  it("rule 6: the seated cable row passes", () => {
    const v = checkExercise(ex({ id: "seated cable row", supportRequired: "seated_supported", loadDirection: "sagittal" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["ok:6"]);
  });

  it("rule 7: a vertical load into the seat passes", () => {
    const v = checkExercise(ex({ id: "seated db curl", supportRequired: "seated_supported", loadDirection: "vertical" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["ok:7"]);
  });

  it("rule 7: a vertical load with a hand on the rack passes", () => {
    const v = checkExercise(ex({ id: "sound-leg calf raise", supportRequired: "standing_supported", loadDirection: "vertical" }), PARTIAL, GYM, 1);
    expect(levels(v)).toEqual(["ok:7"]);
  });

  it("rule 7 does not claim a standing-free vertical load at full weight", () => {
    const v = checkExercise(ex({ id: "standing curl", supportRequired: "standing_free", loadDirection: "vertical" }), OUT_OF_BOOT, GYM, 1);
    expect(levels(v)).toEqual(["ok:0"]);
  });

  it("rule 8: a non-core exercise after core work warns on the non-core row", () => {
    const deadBug = ex({ id: "dead bug", muscleGroup: "Abs", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true });
    const row = ex({ id: "seated row", loadDirection: "sagittal" });
    expect(levels(checkExercise(row, PARTIAL, GYM, 2, deadBug))).toContain("warn:8");
  });

  it("rule 8: core work in slot 1 does not warn by itself", () => {
    const deadBug = ex({ id: "dead bug", muscleGroup: "Abs", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true });
    expect(levels(checkExercise(deadBug, PARTIAL, GYM, 1))).toEqual(["ok:0"]);
  });

  it("rule 8: core after core passes, and core after a non-core row passes", () => {
    const plank = ex({ id: "front plank", muscleGroup: "Abs", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true });
    const deadBug = ex({ id: "dead bug", muscleGroup: "Abs", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true });
    const row = ex({ id: "seated row", loadDirection: "sagittal" });
    expect(checkExercise(deadBug, PARTIAL, GYM, 2, plank).map((x) => x.rule)).not.toContain(8);
    expect(checkExercise(plank, PARTIAL, GYM, 2, row).map((x) => x.rule)).not.toContain(8);
  });

  it("rule 8: floor work anywhere in the template is not an ordering fault", () => {
    const squat = ex({ id: "sit to stand", muscleGroup: "Quadriceps", supportRequired: "standing_supported" });
    const bridge = ex({ id: "glute bridge", muscleGroup: "Glutes", supportRequired: "lying", loadDirection: "vertical", floorTransferRequired: true });
    expect(checkExercise(bridge, PARTIAL, GYM, 3, squat).map((x) => x.rule)).not.toContain(8);
    expect(checkExercise(bridge, PARTIAL, GYM, 5).map((x) => x.rule)).not.toContain(8);
  });

  it("rule 9: missing equipment warns and names it", () => {
    const v = checkExercise(ex({ id: "calf machine", equipmentNeeded: ["calf_machine"] }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:9");
    expect(v.find((x) => x.rule === 9)?.reason).toMatch(/calf_machine/);
  });

  it("rule 9: skips the equipment check when no inventory is known", () => {
    const v = checkExercise(ex({ id: "calf machine", equipmentNeeded: ["calf_machine"] }), PARTIAL, null, 1);
    expect(levels(v)).not.toContain("warn:9");
  });

  it("rule 10: an unrated exercise warns", () => {
    const v = checkExercise(ex({ id: "mystery", supportRequired: null }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:10");
  });

  it("rule 10: a missing muscle group is unrated too, since rule 8 cannot place it", () => {
    const v = checkExercise(ex({ id: "mystery", muscleGroup: null }), PARTIAL, GYM, 1);
    expect(levels(v)).toContain("warn:10");
  });

  it("rejects a position that is not a whole number from 1", () => {
    expect(() => checkExercise(ex({ id: "x" }), PARTIAL, GYM, 0)).toThrow(/whole number/);
    expect(() => checkExercise(ex({ id: "x" }), PARTIAL, GYM, 1.5)).toThrow(/whole number/);
  });

  it("returns every triggered rule, not just the first", () => {
    const v = checkExercise(
      ex({ id: "standing calf raise, injured side", supportRequired: "standing_free", loadDirection: "vertical", loadsBootedFoot: true, ankleInvolvement: true }),
      PARTIAL,
      GYM,
      1,
    );
    expect(levels(v)).toEqual(["blocked:1", "blocked:2", "warn:4"]);
  });
});

describe("checkTemplate", () => {
  it("reports per-exercise verdicts and the worst level", () => {
    const t = {
      name: "Pull",
      spacingNote: null,
      exercises: [
        ex({ id: "dead bug", muscleGroup: "Abs", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true }),
        ex({ id: "pull-ups", supportRequired: "hanging" }),
      ],
    };
    const r = checkTemplate(t, PARTIAL, GYM);
    expect(r.perExercise).toHaveLength(2);
    expect(r.perExercise[1].map((v) => v.rule)).toContain(8);
    expect(r.worst).toBe("warn");
  });

  it("is ok when nothing triggers", () => {
    const t = { name: "Push", spacingNote: null, exercises: [ex({ id: "seated press" })] };
    expect(checkTemplate(t, PARTIAL, GYM).worst).toBe("ok");
  });

  it("rule 8: a core block at the end passes; core in the middle warns on the row after it only", () => {
    const core = (id: string) =>
      ex({ id, muscleGroup: "Abs", supportRequired: "lying", loadDirection: "none", floorTransferRequired: true });
    const seated = (id: string) => ex({ id, muscleGroup: "Quadriceps" });
    const block = {
      name: "Legs",
      spacingNote: null,
      exercises: [seated("sit to stand"), seated("leg extension"), core("dead bug"), core("front plank")],
    };
    const r = checkTemplate(block, PARTIAL, GYM);
    expect(r.perExercise.flat().map((v) => v.rule)).not.toContain(8);
    expect(r.worst).toBe("ok");

    const early = { ...block, exercises: [seated("sit to stand"), core("dead bug"), seated("leg extension"), core("front plank")] };
    const r2 = checkTemplate(early, PARTIAL, GYM);
    r2.perExercise.forEach((verdicts, i) => {
      const rules = verdicts.map((v) => v.rule);
      if (i === 2) expect(rules).toContain(8);
      else expect(rules).not.toContain(8);
    });
    expect(r2.worst).toBe("warn");
  });
});

describe("checkSpacing (rule 11)", () => {
  const pullUps = ex({ id: "pull-ups", supportRequired: "hanging", minHoursBetweenSessions: 72, maxSessionsPerWeek: 2 });

  it("warns when two templates share a spaced exercise and neither carries a note", () => {
    const v = checkSpacing([
      { name: "Workout 1", spacingNote: null, exercises: [pullUps] },
      { name: "Workout 4", spacingNote: null, exercises: [pullUps] },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ level: "warn", rule: 11 });
    expect(v[0].reason).toMatch(/pull-ups/);
  });

  it("passes when both templates carry a spacing note", () => {
    const v = checkSpacing([
      { name: "Workout 1", spacingNote: "72 hours before Workout 4", exercises: [pullUps] },
      { name: "Workout 4", spacingNote: "72 hours after Workout 1", exercises: [pullUps] },
    ]);
    expect(v).toEqual([]);
  });

  it("ignores exercises with no spacing requirement", () => {
    const row = ex({ id: "row" });
    expect(checkSpacing([
      { name: "A", spacingNote: null, exercises: [row] },
      { name: "B", spacingNote: null, exercises: [row] },
    ])).toEqual([]);
  });

  it("treats a blank note as missing and names every template", () => {
    const v = checkSpacing([
      { name: "Workout 1", spacingNote: "  ", exercises: [pullUps] },
      { name: "Workout 4", spacingNote: null, exercises: [pullUps] },
      { name: "Workout 6", spacingNote: "72 hours after Workout 4", exercises: [pullUps] },
    ]);
    expect(v).toHaveLength(1);
    expect(v[0].reason).toMatch(/Workout 1, Workout 4, Workout 6/);
    expect(v[0].reason).toMatch(/no spacing note on Workout 1, Workout 4/);
  });
});
