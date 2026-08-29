import { validateAccessTokenClaims } from "@iride/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth-redirect";
import { clearSupabaseAuthCookies } from "@/lib/supabase/cookies";
import {
  getAppOrigin,
  getWebSupabaseConfig,
} from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/profile-api";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");

  if (!code || requestUrl.searchParams.has("error")) {
    await clearAuthCookies();
    return loginError();
  }

  try {
    const supabase = await createServerSupabaseClient();
    const flowId = requestUrl.searchParams.get("sb_flow_id");
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code,
      flowId ? { flowId } : undefined,
    );
    if (exchangeError) {
      await clearAuthCookies();
      return loginError();
    }

    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) {
      await clearAuthCookies();
      return loginError();
    }

    validateAccessTokenClaims(data.claims, {
      supabaseUrl: getWebSupabaseConfig().url,
    });
    if (requestUrl.searchParams.get("intent") === "profile") {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      const profile = accessToken ? await getOwnProfile(accessToken).catch(() => null) : null;
      return noStoreRedirect(new URL(profile?.username ? `/users/${profile.username}` : "/onboarding", getAppOrigin()));
    }
    return noStoreRedirect(new URL(next, getAppOrigin()));
  } catch {
    await clearAuthCookies();
    return loginError();
  }
}

async function clearAuthCookies() {
  clearSupabaseAuthCookies(await cookies());
}

function loginError() {
  return noStoreRedirect(
    new URL("/login?error=provider", getAppOrigin()),
  );
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
