import { validateAccessTokenClaims } from "@iride/auth";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth-redirect";
import { getAppOrigin, getWebSupabaseConfig } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getOwnProfile } from "@/lib/profile-api";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const code = requestUrl.searchParams.get("code");
  const intent = requestUrl.searchParams.get("intent") === "profile";
  const correlationId = getCorrelationId(requestUrl.searchParams);

  if (!code || requestUrl.searchParams.has("error")) {
    logOAuthEvent("code_exchange", correlationId, "provider_error");
    return loginError("provider", next, intent);
  }

  const flowId = validFlowId(requestUrl.searchParams.get("sb_flow_id"));
  if (!flowId) {
    logOAuthEvent("code_exchange", correlationId, "invalid_flow_id");
    return loginError("invalid_request", next, intent);
  }

  let supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>;
  try {
    supabase = await createServerSupabaseClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(
      code,
      { flowId },
    );
    if (exchangeError) {
      logOAuthEvent("code_exchange", correlationId, "failed");
      return loginError("provider", next, intent);
    }
    logOAuthEvent("code_exchange", correlationId, "succeeded");
  } catch {
    logOAuthEvent("code_exchange", correlationId, "failed");
    return loginError("provider", next, intent);
  }

  try {
    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) {
      logOAuthEvent("claims_validation", correlationId, "failed");
      return loginError("provider", next, intent);
    }

    validateAccessTokenClaims(data.claims, {
      supabaseUrl: getWebSupabaseConfig().url,
    });
    logOAuthEvent("claims_validation", correlationId, "succeeded");
  } catch {
    logOAuthEvent("claims_validation", correlationId, "failed");
    return loginError("provider", next, intent);
  }

  if (intent) {
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      let profile: Awaited<ReturnType<typeof getOwnProfile>> | null = null;
      let profileLookupFailed = false;
      if (accessToken) {
        try {
          profile = await getOwnProfile(accessToken);
        } catch {
          profileLookupFailed = true;
        }
      }
      const profilePath = profile?.username
        ? `/users/${profile.username}`
        : "/onboarding";
      logOAuthEvent(
        "profile_redirect",
        correlationId,
        profile?.username
          ? "existing_profile"
          : profileLookupFailed
            ? "profile_lookup_failed"
            : "onboarding",
      );
      return noStoreRedirect(new URL(profilePath, getAppOrigin()));
    } catch {
      logOAuthEvent("profile_redirect", correlationId, "failed");
      return loginError("provider", next, intent);
    }
  }

  return noStoreRedirect(new URL(next, getAppOrigin()));
}

function validFlowId(value: string | null): string | null {
  return value && /^[a-zA-Z0-9_-]{8,64}$/.test(value) ? value : null;
}

function getCorrelationId(searchParams: URLSearchParams): string {
  const value = searchParams.get("correlation_id");
  return value && /^[a-zA-Z0-9_-]{8,64}$/.test(value)
    ? value
    : crypto.randomUUID();
}

function loginError(
  error: "provider" | "invalid_request",
  next: string,
  profileIntent: boolean,
) {
  const url = new URL("/login", getAppOrigin());
  url.searchParams.set("error", error);
  url.searchParams.set("next", next);
  if (profileIntent) url.searchParams.set("intent", "profile");
  return noStoreRedirect(url);
}

function logOAuthEvent(
  event: "code_exchange" | "claims_validation" | "profile_redirect",
  correlationId: string,
  outcome: string,
): void {
  console.info({ event, correlation_id: correlationId, outcome });
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
