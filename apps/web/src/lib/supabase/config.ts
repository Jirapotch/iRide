export const AUTH_COOKIE_NAME = "iride-auth";

export interface WebSupabaseConfig {
  readonly url: string;
  readonly publishableKey: string;
}

export function getWebSupabaseConfig(
  input: Record<string, string | undefined> = process.env,
): WebSupabaseConfig {
  const url = input.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey =
    input.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim();

  if (!url || !publishableKey) {
    throw new Error("Supabase authentication is not configured.");
  }

  return { url: new URL(url).toString().replace(/\/$/, ""), publishableKey };
}

export function getAppOrigin(
  input: Record<string, string | undefined> = process.env,
): string {
  const value = input.NEXT_PUBLIC_APP_URL?.trim() ?? "http://localhost:3000";
  return new URL(value).origin;
}

export function authCookieOptions() {
  return {
    name: AUTH_COOKIE_NAME,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
}

export function authCookieSerializeOptions() {
  const options = authCookieOptions();
  return {
    httpOnly: options.httpOnly,
    path: options.path,
    sameSite: options.sameSite,
    secure: options.secure,
  };
}
