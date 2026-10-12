import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

/**
 * The app has one user and no sign-in, so every read and write goes
 * through the server with the service-role key and the user id fixed
 * from the environment. The key never reaches the browser: this module
 * is server-only, and the browser only ever calls server actions.
 */

let client: SupabaseClient<Database> | null = null;

export function db(): SupabaseClient<Database> {
  if (client) return client;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}

/** The one user every per-user row belongs to. */
export function userId(): string {
  const id = process.env.APP_USER_ID ?? process.env.SEED_USER_ID;
  if (!id) throw new Error("Set APP_USER_ID (the id `bun run user:create` prints).");
  return id;
}

/**
 * The settings the app cannot run without, by name, so a fresh deploy
 * can say what is missing instead of failing with a bare server error.
 * Names only: values never leave the server.
 */
export function missingConfig(): string[] {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (!process.env.APP_USER_ID && !process.env.SEED_USER_ID) missing.push("APP_USER_ID");
  return missing;
}

export function timeZone(): string {
  return process.env.APP_TIME_ZONE ?? "America/New_York";
}

/**
 * PostgREST caps a response at 1000 rows. Page through with range()
 * until a short page comes back.
 */
export async function selectAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
  size = 1000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += size) {
    const { data, error } = await page(from, from + size - 1);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < size) return out;
  }
}
