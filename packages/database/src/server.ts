import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { requireDatabaseValue, type ServerDatabaseConfig } from "./config";
import type { Database } from "./types";

export function createServerDatabaseClient(
  config: ServerDatabaseConfig,
): SupabaseClient<Database> {
  const accessToken = config.accessToken?.trim();

  return createClient<Database>(
    requireDatabaseValue(config.url, "Supabase URL"),
    requireDatabaseValue(config.publishableKey, "Supabase publishable key"),
    {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
      ...(accessToken
        ? { global: { headers: { Authorization: `Bearer ${accessToken}` } } }
        : {}),
    },
  );
}
