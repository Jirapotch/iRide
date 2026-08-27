"use client";

import { createBrowserClient } from "@supabase/ssr";

import type { Database } from "@iride/database/types";

import {
  authCookieOptions,
  getWebSupabaseConfig,
} from "./config";

export function createBrowserSupabaseClient() {
  const config = getWebSupabaseConfig({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return createBrowserClient<Database>(config.url, config.publishableKey, {
    cookieOptions: authCookieOptions(),
  });
}
