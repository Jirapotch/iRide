import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth-redirect";
import { getAppOrigin } from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"));
  const intent = requestUrl.searchParams.get("intent") === "profile";
  const correlationId = crypto.randomUUID();
  const callback = new URL("/auth/callback", getAppOrigin());
  callback.searchParams.set("next", next);
  callback.searchParams.set("correlation_id", correlationId);
  if (intent) callback.searchParams.set("intent", "profile");

  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: callback.toString(),
        skipBrowserRedirect: true,
      },
    });

    if (error || !data.url) {
      logOAuthStart(correlationId, "failed");
      return loginError(next, intent);
    }

    logOAuthStart(correlationId, "succeeded");
    return noStoreRedirect(data.url);
  } catch {
    logOAuthStart(correlationId, "failed");
    return loginError(next, intent);
  }
}

function loginError(next: string, intent: boolean) {
  const url = new URL("/login", getAppOrigin());
  url.searchParams.set("error", "provider");
  url.searchParams.set("next", next);
  if (intent) url.searchParams.set("intent", "profile");
  return noStoreRedirect(url);
}

function noStoreRedirect(url: string | URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function logOAuthStart(correlationId: string, outcome: "succeeded" | "failed") {
  console.info({
    event: "oauth_start",
    correlation_id: correlationId,
    outcome,
  });
}
