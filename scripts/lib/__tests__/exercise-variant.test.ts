// @vitest-environment node

import { describe, expect, it } from "vitest";
import { splitCompound, splitVariant } from "../exercise-variant";

describe("splitVariant", () => {
  it("moves a known set-type parenthetical onto the variant", () => {
    expect(splitVariant("Bench Press (Top Set)")).toEqual({ name: "Bench Press", variant: "Top Set", dropped: null });
    expect(splitVariant("Bench Press (Back Off AMRAP)")).toEqual({ name: "Bench Press", variant: "Back Off AMRAP", dropped: null });
    expect(splitVariant("Pause Squat (Back off)")).toEqual({ name: "Pause Squat", variant: "Back off", dropped: null });
    expect(splitVariant("Lat Pulldown (Feeder Sets)")).toEqual({ name: "Lat Pulldown", variant: "Feeder Sets", dropped: null });
    expect(splitVariant("Lat Pulldown (Failure Set)")).toEqual({ name: "Lat Pulldown", variant: "Failure Set", dropped: null });
    expect(splitVariant("EZ-Bar Curl (Heavy)")).toEqual({ name: "EZ-Bar Curl", variant: "Heavy", dropped: null });
  });

  it("leaves a parenthetical that is not a set type alone", () => {
    expect(splitVariant("Cross-Body Cable Y-Raise (Side Delt)")).toEqual({ name: "Cross-Body Cable Y-Raise (Side Delt)", variant: null, dropped: null });
    expect(splitVariant("Bench Press (Flat)")).toEqual({ name: "Bench Press (Flat)", variant: null, dropped: null });
  });

  it("drops a rep hint or a seconds suffix, which the dose already carries", () => {
    expect(splitVariant("Triceps Pressdown (12-15 reps)")).toEqual({ name: "Triceps Pressdown", variant: null, dropped: "12-15 reps" });
    expect(splitVariant("DB Skull Crusher (12-15 reps)")).toEqual({ name: "DB Skull Crusher", variant: null, dropped: "12-15 reps" });
    expect(splitVariant("Pec Static Stretch 30s")).toEqual({ name: "Pec Static Stretch", variant: null, dropped: "30s" });
    expect(splitVariant("Side Delt Static Stretch (30s)")).toEqual({ name: "Side Delt Static Stretch", variant: null, dropped: "30s" });
  });

  it("turns a trailing scheme word into the variant", () => {
    expect(splitVariant("Cable Crossover Ladder")).toEqual({ name: "Cable Crossover", variant: "Ladder", dropped: null });
    expect(splitVariant("DB Curl 21's")).toEqual({ name: "DB Curl", variant: "21's", dropped: null });
    expect(splitVariant("Cable Curl 21's")).toEqual({ name: "Cable Curl", variant: "21's", dropped: null });
  });

  it("reads a bare 21s as the scheme, not as seconds", () => {
    expect(splitVariant("DB Curl 21s")).toEqual({ name: "DB Curl", variant: "21's", dropped: null });
    expect(splitVariant("Pec Static Stretch 30s")).toEqual({ name: "Pec Static Stretch", variant: null, dropped: "30s" });
  });

  it("joins a leading tempo word with its parenthetical", () => {
    expect(splitVariant("Slow Seated Leg Curl (3 up, 3 down)")).toEqual({ name: "Seated Leg Curl", variant: "Slow (3 up, 3 down)", dropped: null });
    expect(splitVariant("Slow Eccentric Curl")).toEqual({ name: "Eccentric Curl", variant: "Slow", dropped: null });
  });

  it("moves a squeeze-only or stretch-only prefix onto the variant", () => {
    expect(splitVariant("Squeeze-Only Triceps Pressdown")).toEqual({ name: "Triceps Pressdown", variant: "Squeeze-only", dropped: null });
    expect(splitVariant("Stretch-Only Overhead Triceps Extension")).toEqual({ name: "Overhead Triceps Extension", variant: "Stretch-only", dropped: null });
  });

  it("applies the explicit aliases first", () => {
    expect(splitVariant("EZ-Bar Modified Bicep 21's")).toEqual({ name: "EZ-Bar Curl", variant: "Modified 21's", dropped: null });
    expect(splitVariant("Squat or Machine Squat")).toEqual({ name: "Squat", variant: null, dropped: null });
  });

  it("keeps a plain name unchanged", () => {
    expect(splitVariant("Hammer Cheat Curl")).toEqual({ name: "Hammer Cheat Curl", variant: null, dropped: null });
    expect(splitVariant("Pause Squat")).toEqual({ name: "Pause Squat", variant: null, dropped: null });
    expect(splitVariant("  Kroc Row  ")).toEqual({ name: "Kroc Row", variant: null, dropped: null });
  });
});

describe("splitCompound", () => {
  it("splits an A + B superset cell into two names", () => {
    expect(splitCompound("Squeeze-Only Triceps Pressdown + Stretch-Only Overhead Triceps Extension")).toEqual([
      "Squeeze-Only Triceps Pressdown",
      "Stretch-Only Overhead Triceps Extension",
    ]);
  });

  it("returns every part of a three-way cell", () => {
    expect(splitCompound("Plank + Side Plank + Reverse Plank")).toEqual(["Plank", "Side Plank", "Reverse Plank"]);
  });

  it("returns a single name otherwise", () => {
    expect(splitCompound("Bench Press")).toEqual(["Bench Press"]);
    expect(splitCompound("DB Curl 21's")).toEqual(["DB Curl 21's"]);
  });
});
