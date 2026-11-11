// @vitest-environment node

/**
 * Runs migration 0009's merge against fake library rows: the migration applies with an empty library and drops the old
 * exercise floor column, so that column comes back here and the merge part runs again over rows inserted afterwards.
 * Every row is fake.
 */

import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createSupabaseLikeDb } from "../lib/pglite-supabase";

const MIGRATION = new URL("../../supabase/migrations/0009_merge_floor_exercises.sql", import.meta.url);
const merge = () => readFileSync(MIGRATION, "utf8").split("-- FLOOR AND MERGE\n")[1];

let pg: PGlite;
const ids: Record<string, string> = {};

async function exercise(slug: string, location: "upstairs" | "downstairs" | null): Promise<string> {
  const { rows } = await pg.query<{ id: string }>(
    "insert into exercises (name, slug, equipment_type, machine_location) values ($1, $2, 'cable', $3) returning id",
    [slug, slug, location],
  );
  ids[slug] = rows[0].id;
  return rows[0].id;
}

const alternates = async (id: string) =>
  (
    await pg.query<{ alternate_exercise_id: string; position: number }>(
      "select alternate_exercise_id, position from exercise_alternates where exercise_id = $1 order by position",
      [id],
    )
  ).rows;

describe("migration 0009 merges floor variants", () => {
  let logged: { up: string; down: string };
  let templateRow: string;

  beforeAll(async () => {
    pg = (await createSupabaseLikeDb()).pg;
    await pg.exec("alter table exercises add column machine_location machine_location");
    await exercise("cable-crunch-downstairs", "downstairs"); // kept
    await exercise("cable-crunch-upstairs", "upstairs");
    await exercise("cable-crunch", null);
    await exercise("other-a", null);
    await exercise("other-b", null);
    await exercise("other-c", null);
    await exercise("pointer-both", null);

    const alt = (owner: string, target: string, position: number) =>
      pg.query("insert into exercise_alternates (exercise_id, alternate_exercise_id, position) values ($1, $2, $3)", [ids[owner], ids[target], position]);
    await alt("cable-crunch-downstairs", "other-a", 1);
    await alt("cable-crunch-upstairs", "other-a", 1); // already on the kept row: not repeated
    await alt("cable-crunch-upstairs", "other-b", 2); // fills the free slot
    await alt("cable-crunch", "other-c", 1); // no slot left: dropped
    await alt("cable-crunch", "cable-crunch-downstairs", 2); // would point at itself: dropped
    await alt("pointer-both", "cable-crunch-upstairs", 1);
    await alt("pointer-both", "cable-crunch-downstairs", 2); // both floors collapse to one

    const user = (await pg.query<{ id: string }>("insert into auth.users (id) values (gen_random_uuid()) returning id")).rows[0].id;
    const workout = (await pg.query<{ id: string }>("insert into workouts (user_id) values ($1) returning id", [user])).rows[0].id;
    const we = async (slug: string, position: number) =>
      (await pg.query<{ id: string }>("insert into workout_exercises (workout_id, exercise_id, position) values ($1, $2, $3) returning id", [workout, ids[slug], position])).rows[0].id;
    logged = { up: await we("cable-crunch-upstairs", 1), down: await we("cable-crunch-downstairs", 2) };
    for (const [id, weight] of [[logged.up, 40], [logged.down, 130]] as const) {
      await pg.query("insert into sets (workout_exercise_id, set_number, weight, reps) values ($1, 1, $2, 10)", [id, weight]);
    }
    const template = (await pg.query<{ id: string }>("insert into templates (name, category) values ('t', 'abs') returning id")).rows[0].id;
    templateRow = (await pg.query<{ id: string }>("insert into template_exercises (template_id, exercise_id, position) values ($1, $2, 1) returning id", [template, ids["cable-crunch"]])).rows[0].id;

    await pg.exec(merge());
  }, 60_000); // PGlite replays every migration; under the full suite's load that passes 10 s.

  afterAll(async () => {
    await pg.close();
  });

  const keep = () => ids["cable-crunch-downstairs"];

  it("leaves one exercise with the plain slug, marked as having floors", async () => {
    const { rows } = await pg.query<{ id: string; slug: string; has_floors: boolean }>("select id, slug, has_floors from exercises where slug like 'cable-crunch%'");
    expect(rows).toEqual([{ id: keep(), slug: "cable-crunch", has_floors: true }]);
  });

  it("removes the floor from the exercise itself", async () => {
    const { rows } = await pg.query("select 1 from information_schema.columns where table_name = 'exercises' and column_name = 'machine_location'");
    expect(rows).toHaveLength(0);
  });

  it("keeps a top set per floor when one workout did both", async () => {
    const { rows } = await pg.query<{ machine_location: string }>(
      "select machine_location from v_workout_exercise_top_set where exercise_id = $1 order by machine_location",
      [keep()],
    );
    expect(rows.map((r) => r.machine_location).sort()).toEqual(["downstairs", "upstairs"]);
  });

  it("moves history to it and remembers each session's floor", async () => {
    const { rows } = await pg.query<{ id: string; exercise_id: string; machine_location: string }>("select id, exercise_id, machine_location from workout_exercises");
    expect(rows.find((r) => r.id === logged.up)).toMatchObject({ exercise_id: keep(), machine_location: "upstairs" });
    expect(rows.find((r) => r.id === logged.down)).toMatchObject({ exercise_id: keep(), machine_location: "downstairs" });
  });

  it("moves template rows to it", async () => {
    const { rows } = await pg.query<{ exercise_id: string }>("select exercise_id from template_exercises where id = $1", [templateRow]);
    expect(rows[0].exercise_id).toBe(keep());
  });

  it("keeps its alternates and fills free slots without repeats or itself", async () => {
    expect(await alternates(keep())).toEqual([
      { alternate_exercise_id: ids["other-a"], position: 1 },
      { alternate_exercise_id: ids["other-b"], position: 2 },
    ]);
  });

  it("collapses another exercise's alternates at both floors into one", async () => {
    expect(await alternates(ids["pointer-both"])).toEqual([{ alternate_exercise_id: keep(), position: 2 }]);
  });

  it("does nothing when run again", async () => {
    await pg.exec("alter table exercises add column machine_location machine_location");
    await pg.exec(merge());
    expect((await pg.query("select 1 from exercises where slug = 'cable-crunch'")).rows).toHaveLength(1);
    expect((await pg.query<{ machine_location: string }>("select machine_location from workout_exercises where id = $1", [logged.up])).rows[0].machine_location).toBe("upstairs");
  });
});
