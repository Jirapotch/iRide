import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@iride/database/types";

import {
  authCookieOptions,
  authCookieSerializeOptions,
  getWebSupabaseConfig,
} from "./config";

export async function createServerSupabaseClient() {
  const config = getWebSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(config.url, config.publishableKey, {
    cookieOptions: authCookieOptions(),
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, {
              ...options,
              ...authCookieSerializeOptions(),
            });
          });
        } catch {
          // Server Components are read-only; proxy.ts persists refreshes.
        }
      },
    },
  });
}
