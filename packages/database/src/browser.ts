import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireDatabaseValue, type PublicDatabaseConfig } from "./config";
import type { Database } from "./types";

export function createBrowserDatabaseClient(
  config: PublicDatabaseConfig,
): SupabaseClient<Database> {
  return createClient<Database>(
    requireDatabaseValue(config.url, "Supabase URL"),
    requireDatabaseValue(config.publishableKey, "Supabase publishable key"),
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        persistSession: true,
      },
    },
  );
}
