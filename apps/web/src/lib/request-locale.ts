import "server-only";

import { cookies, headers } from "next/headers";

import {
  LOCALE_COOKIE_MAX_AGE,
  LOCALE_COOKIE_NAME,
  resolveLocale,
  type Locale,
} from "./locale";

export async function getRequestLocale(): Promise<Locale> {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()]);
  return resolveLocale(
    cookieStore.get(LOCALE_COOKIE_NAME)?.value,
    headerStore.get("accept-language"),
  );
}

export async function persistLocale(locale: Locale): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE_NAME, locale, {
    httpOnly: true,
    maxAge: LOCALE_COOKIE_MAX_AGE,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
}
