import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInWithOAuth: vi.fn(),
  cookieSet: vi.fn(),
  consoleInfo: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [{ name: "iride-auth", value: "existing-session" }],
    set: mocks.cookieSet,
  })),
}));
vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: vi.fn(async () => ({
    auth: { signInWithOAuth: mocks.signInWithOAuth },
  })),
}));
vi.mock("@/lib/supabase/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/config")>();
  return { ...actual, getAppOrigin: () => "https://iride.test" };
});

import { GET } from "./route";

describe("Google OAuth start", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(mocks.consoleInfo);
    mocks.signInWithOAuth.mockResolvedValue({
      data: {
        url: "https://accounts.google.test/authorize?client_id=public-client",
        flowId: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      },
      error: null,
    });
  });

  it("starts a fresh OAuth flow with an internal callback", async () => {
    const response = await GET(
      new Request("https://iride.test/auth/google/start"),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://accounts.google.test/authorize?client_id=public-client",
    );
    expect(response.headers.get("cache-control")).toBe(
      "private, no-store, max-age=0",
    );

    const call = mocks.signInWithOAuth.mock.calls[0]?.[0];
    expect(call?.provider).toBe("google");
    expect(call?.options?.skipBrowserRedirect).toBe(true);
    const callback = new URL(call?.options?.redirectTo);
    expect(callback.origin).toBe("https://iride.test");
    expect(callback.pathname).toBe("/auth/callback");
    expect(callback.searchParams.get("next")).toBe("/");
    expect(callback.searchParams.get("correlation_id")).toMatch(
      /^[a-zA-Z0-9_-]{8,64}$/,
    );
  });

  it("retains a safe next path and profile intent in the provider callback", async () => {
    await GET(
      new Request(
        "https://iride.test/auth/google/start?next=%2Fgarage%3Ftab%3Dvehicles&intent=profile",
      ),
    );

    const call = mocks.signInWithOAuth.mock.calls[0]?.[0];
    const callback = new URL(call?.options?.redirectTo);
    expect(callback.searchParams.get("next")).toBe("/garage?tab=vehicles");
    expect(callback.searchParams.get("intent")).toBe("profile");
  });

  it("replaces an unsafe next URL before starting OAuth", async () => {
    await GET(
      new Request(
        "https://iride.test/auth/google/start?next=https%3A%2F%2Fevil.example%2Fsteal",
      ),
    );

    const call = mocks.signInWithOAuth.mock.calls[0]?.[0];
    const callback = new URL(call?.options?.redirectTo);
    expect(callback.searchParams.get("next")).toBe("/");
  });

  it("retains retry context and does not clear a valid session when start fails", async () => {
    mocks.signInWithOAuth.mockResolvedValueOnce({
      data: { url: null, flowId: null },
      error: new Error("provider unavailable"),
    });

    const response = await GET(
      new Request(
        "https://iride.test/auth/google/start?next=%2Fgarage&intent=profile",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/login?error=provider&next=%2Fgarage&intent=profile",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("logs only structured start-stage correlation metadata", async () => {
    await GET(
      new Request(
        "https://iride.test/auth/google/start?next=%2Fgarage&intent=profile",
      ),
    );

    expect(mocks.consoleInfo).toHaveBeenCalledWith({
      event: "oauth_start",
      correlation_id: expect.stringMatching(/^[a-zA-Z0-9_-]{8,64}$/),
      outcome: "succeeded",
    });
    expect(JSON.stringify(mocks.consoleInfo.mock.calls)).not.toContain(
      "accounts.google",
    );
  });
});
