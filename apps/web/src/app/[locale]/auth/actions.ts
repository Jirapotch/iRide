"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth-redirect";
import { isLocale } from "@/lib/locale";
import { clearSupabaseAuthCookies } from "@/lib/supabase/cookies";
import { getAppOrigin } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signInWithGoogle(formData: FormData): Promise<never> {
  const localeValue = formData.get("locale");
  const locale = typeof localeValue === "string" ? localeValue : "";
  if (!isLocale(locale)) {
    redirect("/th/login?error=invalid_request");
  }

  const nextValue = formData.get("next");
  const next = safeNextPath(
    typeof nextValue === "string" ? nextValue : null,
    locale,
  );
  const callback = new URL(`/${locale}/auth/callback`, getAppOrigin());
  callback.searchParams.set("next", next);

  let providerUrl: string | null = null;
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });
    if (!error) {
      providerUrl = data.url;
    }
  } catch {
    providerUrl = null;
  }

  if (!providerUrl) {
    redirect(`/${locale}/login?error=provider`);
  }

  redirect(providerUrl);
}

export async function signOut(formData: FormData): Promise<never> {
  const localeValue = formData.get("locale");
  const locale =
    typeof localeValue === "string" && isLocale(localeValue)
      ? localeValue
      : "th";

  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Clearing the local session is authoritative even if Auth is unavailable.
  }
  clearSupabaseAuthCookies(await cookies());

  redirect(`/${locale}/login?signed_out=1`);
}
