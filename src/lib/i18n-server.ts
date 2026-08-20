import "server-only";

import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, localeStorageKey } from "@/lib/i18n";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import type { Locale } from "@/lib/types";

export async function getLocale(): Promise<Locale> {
  const requestedLocale = (await headers()).get("x-iride-locale");
  if (requestedLocale && isLocale(requestedLocale)) return requestedLocale;
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase.from("profiles").select("locale").eq("id", user.id).maybeSingle();
      if (profile?.locale && isLocale(profile.locale)) return profile.locale;
    }
  }
  const value = (await cookies()).get(localeStorageKey)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}
