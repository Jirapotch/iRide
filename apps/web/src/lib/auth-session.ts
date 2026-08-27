import "server-only";

import { validateAccessTokenClaims } from "@iride/auth";

import { createServerSupabaseClient } from "./supabase/server";
import { getWebSupabaseConfig } from "./supabase/config";

export interface VerifiedWebSession {
  readonly userId: string;
  readonly accessToken: string;
}

export async function getVerifiedWebSession(): Promise<VerifiedWebSession | null> {
  const supabase = await createServerSupabaseClient();
  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims) {
    return null;
  }

  let context;
  try {
    context = validateAccessTokenClaims(claimsData.claims, {
      supabaseUrl: getWebSupabaseConfig().url,
    });
  } catch {
    return null;
  }

  const { data: sessionData, error: sessionError } =
    await supabase.auth.getSession();
  const accessToken = sessionData.session?.access_token;

  if (sessionError || !accessToken) {
    return null;
  }

  return { userId: context.userId, accessToken };
}
