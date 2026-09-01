#!/usr/bin/env node
/* global console, process, URL */
import { createRequire } from "node:module";

import { promoteWithSaga } from "./admin-promotion.mjs";

const defaultUsername = "jirapotch";
const username = process.argv[2] ?? defaultUsername;

if (username === "--help" || username === "-h") {
  console.log(`Usage: pnpm admin:promote [username]\n\nPromotes an existing profile to an active administrator. Defaults to ${defaultUsername}.\nRequires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in the environment.`);
  process.exit(0);
}

if (!/^[a-z0-9_]{3,30}$/.test(username)) {
  console.error("Username must contain 3–30 lowercase letters, digits, or underscores.");
  process.exit(1);
}

const url = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!url || !serviceRoleKey) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
  process.exit(1);
}

const require = createRequire(new URL("../packages/database/package.json", import.meta.url));
const { createClient } = require("@supabase/supabase-js");
const admin = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
});
const { data: profile, error: profileError } = await admin
  .from("profiles")
  .select("id,username")
  .eq("username", username)
  .maybeSingle();
if (profileError) throw profileError;
if (!profile) {
  console.error(`No profile exists for @${username}; no changes were made.`);
  process.exit(1);
}

await promoteWithSaga({
  async begin(userId) {
    const { data, error } = await admin
      .rpc("begin_bootstrap_account_promotion", { target_user_id: userId })
      .single();
    if (error) throw error;
    return { token: data.transition_token, previousStatus: data.previous_status };
  },
  async getState(userId) {
    const { data, error } = await admin
      .from("account_access")
      .select("role,status,transition_id,transition_action")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    return data ? { role: data.role, status: data.status, transitionId: data.transition_id, action: data.transition_action } : null;
  },
  async finalize({ userId, token }) {
    const { error } = await admin.rpc("finalize_account_access_transition", {
      target_user_id: userId,
      actor_id: userId,
      transition_token: token,
    });
    if (error) throw error;
  },
  async setBan(userId, banDuration) {
    const { error } = await admin.auth.admin.updateUserById(userId, { ban_duration: banDuration });
    if (error) throw error;
  },
}, profile.id);

console.log(`Promoted @${profile.username} to active administrator.`);
