/**
 * Create (or find) the single auth user the seeds write for, and print
 * its id for SEED_USER_ID. Idempotent.
 *
 * Run with:
 *   bun run user:create
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and
 * SEED_USER_EMAIL in .env.local.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const email = process.env.SEED_USER_EMAIL;

if (!url || !key || !email) {
  console.error(
    "Need NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and SEED_USER_EMAIL in .env.local",
  );
  process.exit(1);
}

const sb = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: listed, error: listError } = await sb.auth.admin.listUsers({
  perPage: 1000,
});
if (listError) {
  console.error("listUsers failed:", listError.message);
  process.exit(1);
}

const existing = listed.users.find((u) => u.email === email);
if (existing) {
  console.log(`exists: ${existing.id}`);
  process.exit(0);
}

const { data: created, error: createError } = await sb.auth.admin.createUser({
  email,
  email_confirm: true,
});
if (createError || !created.user) {
  console.error("createUser failed:", createError?.message);
  process.exit(1);
}
console.log(`created: ${created.user.id}`);
