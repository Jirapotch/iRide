"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { clearSupabaseAuthCookies } from "@/lib/supabase/cookies";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
