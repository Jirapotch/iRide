import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import type { Database } from "@iride/database/types";

import { safeNextPath } from "../auth-redirect";
import { clearSupabaseAuthCookies } from "./cookies";
import {
  authCookieOptions,
  authCookieSerializeOptions,
  getWebSupabaseConfig,
} from "./config";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  let config;

  try {
    config = getWebSupabaseConfig();
  } catch {
    return response;
  }

  const supabase = createServerClient<Database>(
    config.url,
    config.publishableKey,
    {
      cookieOptions: authCookieOptions(),
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headersToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, {
              ...options,
              ...authCookieSerializeOptions(),
            });
          });
          Object.entries(headersToSet).forEach(([name, value]) =>
            response.headers.set(name, value),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.getClaims();
  if (error && isInvalidSessionError(error)) {
    clearSupabaseAuthCookies(response.cookies);
  }

  if (isProtectedPath(request.nextUrl.pathname) && !data?.claims?.sub) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      safeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    );

    const redirect = NextResponse.redirect(loginUrl, 307);
    copySessionResponse(response, redirect);
    return redirect;
  }

  return response;
}

export function isProtectedPath(pathname: string): boolean {
  return /^\/(?:account|onboarding|profile\/edit)(?:\/|$)/.test(pathname);
}

function isInvalidSessionError(error: {
  readonly name?: string | undefined;
  readonly status?: number | undefined;
}): boolean {
  return (
    error.name === "AuthInvalidJwtError" ||
    error.name === "AuthSessionMissingError" ||
    error.status === 400 ||
    error.status === 401 ||
    error.status === 403
  );
}

function copySessionResponse(source: NextResponse, target: NextResponse): void {
  source.cookies.getAll().forEach((cookie) => target.cookies.set(cookie));
  for (const name of ["cache-control", "expires", "pragma"]) {
    const value = source.headers.get(name);
    if (value) {
      target.headers.set(name, value);
    }
  }
}
