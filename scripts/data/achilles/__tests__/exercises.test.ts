// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { EXERCISES } from "../exercises";
import { TEMPLATES } from "../templates";
import { RECOVERY_PROGRAM } from "../program";
import { SOURCES } from "../sources";
import { REHAB_MATCHED_LIBRARY_SLUGS } from "../rehab-exercises";
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
  ...REHAB_MATCHED_LIBRARY_SLUGS,
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
    muscleGroup: e.muscleGroup,
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

/**
 * The restriction state the handout implies at the start of a phase:
 * the phase's load (full weight once the ladder ends), ankle range of
 * motion from week 2, the boot on through week 8, weaning in weeks 8
 * to 12 and off after. A template is checked against the earliest
 * phase it is valid in, its most restricted one.
 */
function stateAtPhase(position: number): RestrictionState {
  const phase = RECOVERY_PROGRAM.phases.find((p) => p.position === position);
  if (!phase) throw new Error(`no phase ${position}`);
  return {
    ...BOOT_ON,
    clearedLoadPct: phase.loadPct ?? 100,
    ankleRomCleared: phase.weekFrom >= 2,
    bootStatus: phase.weekFrom < 8 ? "on" : phase.weekFrom < 12 ? "weaning" : "off",
  };
}

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
        if (te.dose === null) continue;
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

  it("blocks nothing in a template's earliest phase unless the row records an override for that rule, and keeps core work last", () => {
    for (const t of TEMPLATES) {
      const state = stateAtPhase(Math.min(...t.phases));
      t.exercises.forEach((te, i) => {
        const previous = i === 0 ? null : toAuthoring(t.exercises[i - 1].slug);
        const verdicts = checkExercise(toAuthoring(te.slug), state, EXAMPLE_EQUIPMENT, i + 1, previous);
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

describe("rehab templates", () => {
  const byName = new Map(TEMPLATES.map((t) => [t.name, t]));

  it("names a real source on every template, and asks for sign-off on everything outside the clinic", () => {
    const keys = new Set(SOURCES.map((s) => s.key));
    const clinic = new Set(["handout", "physio-sheet", "physio416"]);
    for (const t of TEMPLATES) {
      expect(t.sourceKey && keys.has(t.sourceKey), t.name).toBe(true);
      if (!clinic.has(t.sourceKey!)) expect(t.needsSignoff?.length ?? 0, t.name).toBeGreaterThan(20);
    }
  });

  it("has unique template names with no colon, since names become seed keys", () => {
    const names = TEMPLATES.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
    for (const n of names) expect(n).not.toContain(":");
  });

  it("runs the physio's sheet exactly: seven exercises in order, doses as written, blank where none", () => {
    const t = byName.get("Achilles Rehab, Weeks 8-12")!;
    expect(t.sourceKey).toBe("physio-sheet");
    expect(t.needsSignoff).toBeNull();
    expect(t.exercises.map((e) => [e.slug, e.dose])).toEqual([
      ["seated-passive-heel-slide", "3 x 10 sec"],
      ["seated-calf-raise-hold", "45-60 sec"],
      ["toe-spread-and-hold", "10-15 sec"],
      ["towel-scrunch", null],
      ["standing-weight-shift-to-single-leg-stand", "5 sec"],
      ["weight-shift-with-calf-raise", null],
      ["ankle-resistance-band", null],
    ]);
    expect(t.phases).toEqual([7, 8]);
  });

  it("gives every rehab phase of the handout from week 2 on at least one clinic template", () => {
    const clinicPhases = new Set(
      TEMPLATES.filter((t) => t.category === "rehab" && t.needsSignoff === null).flatMap((t) => t.phases),
    );
    for (const p of [2, 3, 4, 5, 6, 7, 8]) expect(clinicPhases.has(p), `phase ${p}`).toBe(true);
  });

  it("writes no em dashes", () => {
    for (const t of TEMPLATES) {
      expect(t.notes, t.name).not.toContain("\u2014");
      for (const e of t.exercises) expect(e.cue ?? "", `${t.name} ${e.slug}`).not.toContain("\u2014");
    }
    for (const e of EXERCISES) expect(e.notes ?? "", e.slug).not.toContain("\u2014");
  });
});
