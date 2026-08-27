import { validateAccessTokenClaims } from "@iride/auth";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { safeNextPath } from "@/lib/auth-redirect";
import { isLocale } from "@/lib/locale";
import { clearSupabaseAuthCookies } from "@/lib/supabase/cookies";
import {
  getAppOrigin,
  getWebSupabaseConfig,
} from "@/lib/supabase/config";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  request: Request,
  { params }: { readonly params: Promise<{ locale: string }> },
) {
  const { locale } = await params;
  if (!isLocale(locale)) {
    return NextResponse.redirect(new URL("/th/login?error=invalid_request", getAppOrigin()), 303);
  }

  const requestUrl = new URL(request.url);
  const next = safeNextPath(requestUrl.searchParams.get("next"), locale);
  const code = requestUrl.searchParams.get("code");

  if (!code || requestUrl.searchParams.has("error")) {
    await clearAuthCookies();
    return loginError(locale);
  }

  try {
    const supabase = await createServerSupabaseClient();
    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
      await clearAuthCookies();
      return loginError(locale);
    }

    const { data, error } = await supabase.auth.getClaims();
    if (error || !data?.claims) {
      await clearAuthCookies();
      return loginError(locale);
    }

    validateAccessTokenClaims(data.claims, {
      supabaseUrl: getWebSupabaseConfig().url,
    });
    return noStoreRedirect(new URL(next, getAppOrigin()));
  } catch {
    await clearAuthCookies();
    return loginError(locale);
  }
}

async function clearAuthCookies() {
  clearSupabaseAuthCookies(await cookies());
}

function loginError(locale: "th" | "en") {
  return noStoreRedirect(
    new URL(`/${locale}/login?error=provider`, getAppOrigin()),
  );
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url, 303);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  return response;
}
