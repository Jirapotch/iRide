"use server";

import { redirect } from "next/navigation";

import { safeReturnPath } from "@/lib/auth-redirect";
import { isLocale } from "@/lib/locale";
import { persistLocale } from "@/lib/request-locale";

export async function setLocale(formData: FormData): Promise<never> {
  const returnToValue = formData.get("returnTo");
  const returnTo = safeReturnPath(
    typeof returnToValue === "string" ? returnToValue : null,
  );
  const localeValue = formData.get("locale");
  const locale =
    typeof localeValue === "string" && isLocale(localeValue)
      ? localeValue
      : null;

  if (!locale) {
    redirect(returnTo);
  }

  await persistLocale(locale);
  redirect(returnTo);
}
