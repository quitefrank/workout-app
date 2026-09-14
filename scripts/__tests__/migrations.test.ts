// @vitest-environment node

/**
 * Applies every file in supabase/migrations/ to an in-process Postgres
 * with Supabase's roles stubbed, then asserts the behaviours the recovery
 * design depends on: partial uniqueness, named check constraints, the
 * insert-only clearance log, restrict-on-delete for phases, and library
 * visibility by role.
 *
 * Every row here is fake: user ids from gen_random_uuid(), dates in 2000.
 */

import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  asAnon,
  asService,
  asUser,
  createSupabaseLikeDb,
} from "../lib/pglite-supabase";

let pg: PGlite;
let migrationFiles: string[];

type IdRow = { id: string };
type CountRow = { n: number };

async function newUser(): Promise<string> {
  const { rows } = await pg.query<IdRow>(
    "insert into auth.users (id) values (gen_random_uuid()) returning id",
  );
  return rows[0].id;
}

async function newProgram(name: string): Promise<string> {
  const { rows } = await pg.query<IdRow>(
    "insert into programs (name, kind) values ($1, 'recovery') returning id",
    [name],
  );
  return rows[0].id;
}

async function newPhase(programId: string, position: number): Promise<string> {
  const { rows } = await pg.query<IdRow>(
    `insert into program_phases (program_id, position, label, week_from, week_to)
     values ($1, $2, 'Phase', 0, 2) returning id`,
    [programId, position],
  );
  return rows[0].id;
}

async function newRecovery(userId: string, programId: string): Promise<string> {
  const { rows } = await pg.query<IdRow>(
    `insert into recoveries (user_id, program_id, label, side, injury_date)
     values ($1, $2, 'Test recovery', 'left', '2000-01-01') returning id`,
    [userId, programId],
  );
  return rows[0].id;
}

async function newClearance(
  recoveryId: string,
  phaseId: string | null = null,
): Promise<string> {
  const { rows } = await pg.query<IdRow>(
    `insert into clearances (recovery_id, effective_from, kind, source, phase_id)
     values ($1, '2000-02-01', 'ankle_rom', 'clinic', $2) returning id`,
    [recoveryId, phaseId],
  );
  return rows[0].id;
}

describe("supabase migrations on PGlite", () => {
  beforeAll(async () => {
    const db = await createSupabaseLikeDb();
    pg = db.pg;
    migrationFiles = db.migrationFiles;
  });

  afterEach(async () => {
    await asService(pg);
  });

  it("applies every migration in order", () => {
    expect(migrationFiles).toEqual([
      "0001_initial_schema.sql",
      "0002_analytics_views.sql",
      "0003_exercise_authoring.sql",
      "0004_programs.sql",
      "0005_recovery.sql",
    ]);
  });

  it("exercises.slug is unique among non-null values", async () => {
    await pg.query(
      "insert into exercises (name) values ('no slug one'), ('no slug two')",
    );
    await pg.query(
      "insert into exercises (name, slug) values ('slugged', 'shared-slug')",
    );
    await expect(
      pg.query(
        "insert into exercises (name, slug) values ('slugged again', 'shared-slug')",
      ),
    ).rejects.toThrow(/exercises_slug_idx/);
  });

  it("program_phases enforces the week range and names the constraint", async () => {
    const programId = await newProgram("Week range program");
    await expect(
      pg.query(
        `insert into program_phases (program_id, position, label, week_from, week_to)
         values ($1, 1, 'Bad', 4, 4)`,
        [programId],
      ),
    ).rejects.toThrow(/program_phases_week_range_check/);
    await pg.query(
      `insert into program_phases (program_id, position, label, week_from, week_to)
       values ($1, 2, 'Open ended', 4, null)`,
      [programId],
    );
  });

  it("weight-bearing clearances must carry a percentage", async () => {
    const userId = await newUser();
    const programId = await newProgram("Weight bearing program");
    const recoveryId = await newRecovery(userId, programId);

    await expect(
      pg.query(
        `insert into clearances (recovery_id, effective_from, kind, value_pct, source)
         values ($1, '2000-02-01', 'weight_bearing', null, 'clinic')`,
        [recoveryId],
      ),
    ).rejects.toThrow(/clearances_weight_bearing_needs_pct/);
    await pg.query(
      `insert into clearances (recovery_id, effective_from, kind, value_pct, source)
       values ($1, '2000-02-01', 'weight_bearing', 25, 'clinic')`,
      [recoveryId],
    );
    await pg.query(
      `insert into clearances (recovery_id, effective_from, kind, value_pct, source)
       values ($1, '2000-02-01', 'ankle_rom', null, 'clinic')`,
      [recoveryId],
    );
  });

  it("clearances are insert-only for the owner", async () => {
    const programId = await newProgram("Ownership program");
    const userA = await newUser();
    const userB = await newUser();
    const recoveryA = await newRecovery(userA, programId);
    const recoveryB = await newRecovery(userB, programId);
    const clearanceA = await newClearance(recoveryA);
    const clearanceB = await newClearance(recoveryB);

    await asUser(pg, userA);

    const visible = await pg.query<IdRow>("select id from clearances");
    expect(visible.rows.map((row) => row.id)).toEqual([clearanceA]);

    await pg.query(
      `insert into clearances (recovery_id, effective_from, kind, source)
       values ($1, '2000-03-01', 'ankle_rom', 'self')`,
      [recoveryA],
    );
    await expect(
      pg.query(
        `insert into clearances (recovery_id, effective_from, kind, source)
         values ($1, '2000-03-01', 'ankle_rom', 'self')`,
        [recoveryB],
      ),
    ).rejects.toThrow(/row-level security/);

    await expect(
      pg.query("update clearances set note = 'edited' where id = $1", [
        clearanceA,
      ]),
    ).rejects.toThrow(/permission denied/);
    await expect(
      pg.query("delete from clearances where id = $1", [clearanceA]),
    ).rejects.toThrow(/permission denied/);

    const voided = await pg.query(
      "update clearances set voided_at = now() where id = $1",
      [clearanceA],
    );
    expect(voided.affectedRows).toBe(1);

    const unvoided = await pg.query(
      "update clearances set voided_at = null where id = $1",
      [clearanceA],
    );
    expect(unvoided.affectedRows).toBe(0);

    const crossUser = await pg.query(
      "update clearances set voided_at = now() where id = $1",
      [clearanceB],
    );
    expect(crossUser.affectedRows).toBe(0);
  });

  it("deleting a phase with a live clearance is refused", async () => {
    const programId = await newProgram("Phase delete program");
    const phaseId = await newPhase(programId, 1);
    const userId = await newUser();
    const recoveryId = await newRecovery(userId, programId);
    await newClearance(recoveryId, phaseId);

    await expect(
      pg.query("delete from program_phases where id = $1", [phaseId]),
    ).rejects.toThrow(/clearances_phase_id_fkey/);
  });

  it("library tables are readable by authenticated and invisible to anon", async () => {
    await pg.query("insert into templates (name) values ('Library template')");
    const userId = await newUser();

    await asUser(pg, userId);
    const asAuthenticated = await pg.query<CountRow>(
      "select count(*)::int as n from templates",
    );
    expect(asAuthenticated.rows[0].n).toBeGreaterThan(0);

    await asAnon(pg);
    const templatesAsAnon = await pg.query<CountRow>(
      "select count(*)::int as n from templates",
    );
    expect(templatesAsAnon.rows[0].n).toBe(0);
    const recoveriesAsAnon = await pg.query<CountRow>(
      "select count(*)::int as n from recoveries",
    );
    expect(recoveriesAsAnon.rows[0].n).toBe(0);
  });
});
