// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXERCISES } from "../exercises";
import { TEMPLATES } from "../templates";
import { RECOVERY_PROGRAM } from "../program";
import { parseDose } from "../../../../src/lib/recovery/dose";
import { checkExercise, checkSpacing } from "../../../../src/lib/recovery/authoring";
import type { AuthoringExercise, EquipmentItem, RestrictionState } from "../../../../src/lib/recovery/types";

const bySlug = new Map(EXERCISES.map((e) => [e.slug, e]));

/** Library rows the review matched by slug; the seed updates their authoring inputs. */
const MATCHED_LIBRARY_SLUGS = [
  "pull-ups",
  "cable-seated-row",
  "db-curls",
  "hanging-leg-raise",
  "db-bench-press",
  "bench-db-lateral-raise",
  "incline-chest-supported-db-row",
  "cable-curl",
  "dead-bug-kicks",
  "dumbbell-flyes",
  "reverse-cable-flies",
];

/** The muscle_groups names as the Notion seed wrote them. */
const MUSCLE_GROUPS = [
  "Abs",
  "Biceps",
  "Chest",
  "Glutes",
  "Back",
  "Shoulders",
  "Hamstrings",
  "Calves",
  "Quadriceps",
  "Triceps",
  "Stretches",
  "Cardio",
];

/** The example personal file's equipment list, so rule 9 runs in CI. */
const EXAMPLE_EQUIPMENT: EquipmentItem[] = JSON.parse(
  readFileSync(fileURLToPath(new URL("../personal.example.json", import.meta.url)), "utf8"),
).equipmentAvailable;

function toAuthoring(slug: string): AuthoringExercise {
  const e = bySlug.get(slug);
  if (!e) throw new Error(`template references unknown slug ${slug}`);
  return {
    id: e.slug,
    name: e.name,
    supportRequired: e.supportRequired,
    loadDirection: e.loadDirection,
    loadsBootedFoot: e.loadsBootedFoot,
    ankleInvolvement: e.ankleInvolvement,
    floorTransferRequired: e.floorTransferRequired,
    equipmentNeeded: e.equipmentNeeded,
    minHoursBetweenSessions: e.minHoursBetweenSessions,
    maxSessionsPerWeek: e.maxSessionsPerWeek,
  };
}

const BOOT_ON: RestrictionState = {
  clearedLoadPct: 50,
  ankleRomCleared: false,
  bootStatus: "on",
  wedgesRemoved: 0,
  strengthGate: null,
  currentPhaseId: null,
  daysSinceLastClearance: 1,
  isStale: false,
};

describe("exercise seed integrity", () => {
  it("has unique slugs", () => {
    const slugs = EXERCISES.map((e) => e.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("sets every authoring input on every exercise", () => {
    for (const e of EXERCISES) {
      expect(e.supportRequired, e.slug).toBeTruthy();
      expect(e.loadDirection, e.slug).toBeTruthy();
      expect(typeof e.loadsBootedFoot, e.slug).toBe("boolean");
      expect(typeof e.ankleInvolvement, e.slug).toBe("boolean");
      expect(typeof e.floorTransferRequired, e.slug).toBe("boolean");
      expect(Array.isArray(e.equipmentNeeded), e.slug).toBe(true);
    }
  });

  it("writes a video URL only when it was verified, and credits every clip", () => {
    for (const e of EXERCISES) {
      if (e.videoVerifiedAt !== null) {
        expect(e.videoUrl, e.slug).toBeTruthy();
        expect(e.videoCredit, e.slug).toBeTruthy();
      }
    }
  });

  it("attaches all thirteen 416 Physio clips", () => {
    const clips = EXERCISES.filter((e) => e.videoUrl?.includes("player.vimeo.com") && e.videoVerifiedAt);
    expect(clips).toHaveLength(13);
    for (const e of clips) expect(e.videoUrl).toMatch(/^https:\/\/player\.vimeo\.com\/video\/\d+\?h=[0-9a-f]+$/);
  });

  it("caps pull-ups at 72 hours and twice a week", () => {
    const p = bySlug.get("pull-ups");
    expect(p?.minHoursBetweenSessions).toBe(72);
    expect(p?.maxSessionsPerWeek).toBe(2);
  });

  it("points every alternate at a row in this file or a matched library slug", () => {
    const known = new Set([...bySlug.keys(), ...MATCHED_LIBRARY_SLUGS]);
    for (const e of EXERCISES) {
      for (const a of e.alternates) {
        expect(known.has(a.slug), `${e.slug} -> ${a.slug}`).toBe(true);
        expect(a.slug, `${e.slug} lists itself`).not.toBe(e.slug);
      }
    }
  });

  it("uses only the seeded muscle group names", () => {
    for (const e of EXERCISES) {
      if (e.muscleGroup !== null) expect(MUSCLE_GROUPS, `${e.slug}: ${e.muscleGroup}`).toContain(e.muscleGroup);
    }
  });
});

describe("template seed integrity", () => {
  it("every template exercise resolves and every dose parses to exactly one prescription", () => {
    for (const t of TEMPLATES) {
      for (const te of t.exercises) {
        expect(bySlug.has(te.slug), `${t.name}: ${te.slug}`).toBe(true);
        const d = parseDose(te.dose);
        expect(d, `${t.name}: ${te.dose}`).not.toBeNull();
        const kinds = [d!.reps, d!.rir, d!.seconds].filter((x) => x !== null).length;
        expect(kinds, `${t.name}: ${te.dose}`).toBeLessThanOrEqual(1);
      }
    }
  });

  it("names only phases that exist", () => {
    const positions = new Set(RECOVERY_PROGRAM.phases.map((p) => p.position));
    for (const t of TEMPLATES) for (const ph of t.phases) expect(positions.has(ph), t.name).toBe(true);
  });

  it("blocks nothing with the boot on unless the row records an override for that rule, and keeps floor work first", () => {
    for (const t of TEMPLATES) {
      t.exercises.forEach((te, i) => {
        const previous = i === 0 ? null : toAuthoring(t.exercises[i - 1].slug);
        const verdicts = checkExercise(toAuthoring(te.slug), BOOT_ON, EXAMPLE_EQUIPMENT, i + 1, previous);
        for (const v of verdicts) {
          if (v.level === "blocked") {
            expect(te.override?.rule, `${t.name} #${i + 1} ${te.slug}: ${v.reason}`).toBe(v.rule);
            expect(te.override?.reason.length ?? 0, `${t.name} #${i + 1}`).toBeGreaterThan(20);
          }
          expect(v.rule, `${t.name} #${i + 1}: ${v.reason}`).not.toBe(8);
        }
        if (te.override) {
          const rules = verdicts.map((v) => v.rule);
          expect(rules, `${t.name} #${i + 1} overrides rule ${te.override.rule} but it never fired`).toContain(te.override.rule);
        }
      });
    }
  });

  it("spaces the templates that share a capped exercise", () => {
    const v = checkSpacing(
      TEMPLATES.map((t) => ({ name: t.name, spacingNote: t.spacingNote, exercises: t.exercises.map((te) => toAuthoring(te.slug)) })),
    );
    expect(v).toEqual([]);
  });
});
