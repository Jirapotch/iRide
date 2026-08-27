import { describe, expect, it } from "vitest";

import { isProtectedPath } from "./proxy";
import { clearSupabaseAuthCookies } from "./cookies";

describe("Supabase auth cookies", () => {
  it("clears only the configured auth cookie and chunks", () => {
    const writes: Array<{
      name: string;
      value: string;
      options: Record<string, unknown>;
    }> = [];
    const store = {
      getAll: () => [
        { name: "iride-auth.0", value: "first" },
        { name: "iride-auth.1", value: "second" },
        { name: "theme", value: "dark" },
      ],
      set(name: string, value: string, options: Record<string, unknown>) {
        writes.push({ name, value, options });
      },
    };

    clearSupabaseAuthCookies(store);

    expect(writes.map(({ name }) => name)).toEqual([
      "iride-auth.0",
      "iride-auth.1",
    ]);
    expect(writes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          value: "",
          options: expect.objectContaining({
            httpOnly: true,
            maxAge: 0,
            path: "/",
            sameSite: "lax",
          }),
        }),
      ]),
    );
  });
});

describe("protected web routes", () => {
  it.each(["/account", "/account/security"])(
    "protects %s",
    (pathname) => expect(isProtectedPath(pathname)).toBe(true),
  );

  it.each(["/", "/login", "/th/account", "/en/account", "/accounting"])(
    "does not overmatch %s",
    (pathname) => expect(isProtectedPath(pathname)).toBe(false),
  );
});
