/**
 * Validate the env vars the seed script needs before doing any work.
 * Bun auto-loads .env.local; this just enforces shape.
 */

type RequiredKey =
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "SUPABASE_SERVICE_ROLE_KEY"
  | "NOTION_API_KEY"
  | "NOTION_MUSCLE_GROUPS_DB"
  | "NOTION_EXERCISES_DB"
  | "NOTION_WORKOUTS_DB"
  | "NOTION_SESSIONS_DB"
  | "SEED_USER_ID";

const REQUIRED_KEYS: RequiredKey[] = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "NOTION_API_KEY",
  "NOTION_MUSCLE_GROUPS_DB",
  "NOTION_EXERCISES_DB",
  "NOTION_WORKOUTS_DB",
  "NOTION_SESSIONS_DB",
  "SEED_USER_ID",
];

export type SeedEnv = Record<RequiredKey, string>;

export function loadSeedEnv(): SeedEnv {
  const missing: string[] = [];
  const env: Partial<SeedEnv> = {};
  for (const key of REQUIRED_KEYS) {
    const value = process.env[key];
    if (!value) missing.push(key);
    else env[key] = value;
  }
  if (missing.length > 0) {
    console.error("Missing required env vars:");
    for (const k of missing) console.error(`  - ${k}`);
    console.error("\nFill in .env.local using .env.local.example as a template.");
    process.exit(1);
  }
  return env as SeedEnv;
}
