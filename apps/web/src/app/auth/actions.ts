"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth-redirect";
import { clearSupabaseAuthCookies } from "@/lib/supabase/cookies";
import { getAppOrigin } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function signInWithGoogle(formData: FormData): Promise<never> {
  const nextValue = formData.get("next");
  const next = safeNextPath(
    typeof nextValue === "string" ? nextValue : null,
  );
  const callback = new URL("/auth/callback", getAppOrigin());
  callback.searchParams.set("next", next);
  if (formData.get("intent") === "profile") callback.searchParams.set("intent", "profile");

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
    redirect("/login?error=provider");
  }

  redirect(providerUrl);
}

export async function signOut(): Promise<never> {
  try {
    const supabase = await createServerSupabaseClient();
    await supabase.auth.signOut({ scope: "local" });
  } catch {
    // Clearing the local session is authoritative even if Auth is unavailable.
  }
  clearSupabaseAuthCookies(await cookies());

  redirect("/login?signed_out=1");
}
