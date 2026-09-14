/**
 * An in-process Postgres (PGlite, Postgres compiled to WASM) shaped like a
 * Supabase project: the three API roles, an auth schema with auth.users
 * and auth.uid(), and the default privileges Supabase grants on public.
 * Every file in supabase/migrations/ is applied in filename order.
 *
 * Used by the migration test so schema mistakes fail locally before
 * `supabase db push`. No Docker, no local Postgres.
 *
 * Two systematic gaps, so a green run is not over-read. PGlite 0.5.8 is
 * PostgreSQL 18 while Supabase hosts 15 or 17, so PG18-only syntax passes
 * here and fails there. PGlite's session is a true superuser while
 * Supabase's postgres role is not, so superuser-only DDL passes here and
 * fails there.
 */

import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const MIGRATIONS_DIR = fileURLToPath(
  new URL("../../supabase/migrations/", import.meta.url),
);

// Mirrors what a fresh Supabase project has before any migration runs.
// PGlite runs as superuser, so `set role` to these nologin roles is enough
// to exercise grants and RLS.
const SUPABASE_STUB = `
  create role anon nologin noinherit;
  create role authenticated nologin noinherit;
  create role service_role nologin noinherit bypassrls;

  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid
    language sql stable
    as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;

  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public
    grant all on sequences to anon, authenticated, service_role;
  grant all on auth.users to service_role;
`;

export type SupabaseLikeDb = {
  pg: PGlite;
  migrationFiles: string[];
};

export function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort();
}

export async function createSupabaseLikeDb(): Promise<SupabaseLikeDb> {
  const pg = await PGlite.create({ extensions: { pgcrypto } });
  await pg.exec(SUPABASE_STUB);

  const migrationFiles = listMigrationFiles();
  for (const file of migrationFiles) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
    try {
      await pg.exec("begin;");
      await pg.exec(sql);
      await pg.exec("commit;");
    } catch (error) {
      await pg.exec("rollback;").catch(() => {});
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`Migration ${file} failed: ${reason}`);
    }
  }

  return { pg, migrationFiles };
}

/**
 * Act as a signed-in user, the way PostgREST does: the `authenticated`
 * role with the JWT subject claim set so auth.uid() returns it.
 */
export async function asUser(pg: PGlite, userId: string): Promise<void> {
  await pg.exec("reset role;");
  await pg.query("select set_config('request.jwt.claim.sub', $1, false);", [
    userId,
  ]);
  await pg.exec("set role authenticated;");
}

/**
 * Act as an anonymous caller: the `anon` role with no subject claim.
 */
export async function asAnon(pg: PGlite): Promise<void> {
  await pg.exec("reset role;");
  await pg.exec("select set_config('request.jwt.claim.sub', '', false);");
  await pg.exec("set role anon;");
}

/**
 * Act as the service role, the way a server-side client with the
 * service-role key does: bypasses RLS, holds the grants Supabase gives
 * service_role, and nothing more, plus insert on auth.users so tests can
 * create fixture users. auth.uid() returns null.
 */
export async function asService(pg: PGlite): Promise<void> {
  await pg.exec("reset role;");
  await pg.exec("select set_config('request.jwt.claim.sub', '', false);");
  await pg.exec("set role service_role;");
}
