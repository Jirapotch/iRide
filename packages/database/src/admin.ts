import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireDatabaseValue, type AdminDatabaseConfig } from "./config";
import type { Database } from "./types";

export function createAdminDatabaseClient(
  config: AdminDatabaseConfig,
): SupabaseClient<Database> {
  return createClient<Database>(
    requireDatabaseValue(config.url, "Supabase URL"),
    requireDatabaseValue(config.serviceRoleKey, "Supabase service-role key"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    },
  );
}
