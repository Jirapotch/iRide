import "server-only";

import { cookies, headers } from "next/headers";
import { defaultLocale, isLocale, localeStorageKey } from "@/lib/i18n";
import type { Locale } from "@/lib/types";

export async function getLocale(): Promise<Locale> {
  const requestedLocale = (await headers()).get("x-iride-locale");
  if (requestedLocale && isLocale(requestedLocale)) return requestedLocale;
  const value = (await cookies()).get(localeStorageKey)?.value;
  return value && isLocale(value) ? value : defaultLocale;
}
