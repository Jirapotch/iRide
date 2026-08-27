import {
  AUTH_COOKIE_NAME,
  authCookieSerializeOptions,
} from "./config";

export interface AuthCookieStore {
  getAll(): Array<{ name: string; value: string }>;
  set(
    name: string,
    value: string,
    options: Record<string, unknown>,
  ): unknown;
}

export function clearSupabaseAuthCookies(store: AuthCookieStore): void {
  for (const cookie of store.getAll()) {
    if (
      cookie.name === AUTH_COOKIE_NAME ||
      cookie.name.startsWith(`${AUTH_COOKIE_NAME}.`)
    ) {
      store.set(cookie.name, "", {
        ...authCookieSerializeOptions(),
        expires: new Date(0),
        maxAge: 0,
      });
    }
  }
}
