import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  exchangeCodeForSession: vi.fn(),
  getClaims: vi.fn(),
  getSession: vi.fn(),
  getOwnProfile: vi.fn(),
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
    auth: {
      exchangeCodeForSession: mocks.exchangeCodeForSession,
      getClaims: mocks.getClaims,
      getSession: mocks.getSession,
    },
  })),
}));
vi.mock("@/lib/supabase/config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase/config")>();
  return {
    ...actual,
    getAppOrigin: () => "https://iride.test",
    getWebSupabaseConfig: () => ({
      url: "https://project.supabase.co",
      publishableKey: "public-key",
    }),
  };
});
vi.mock("@/lib/profile-api", () => ({
  getOwnProfile: mocks.getOwnProfile,
}));

import { GET } from "./route";

describe("Google OAuth callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "info").mockImplementation(mocks.consoleInfo);
    mocks.exchangeCodeForSession.mockResolvedValue({ error: null });
    mocks.getClaims.mockResolvedValue({
      data: {
        claims: {
          aal: "aal1",
          aud: "authenticated",
          exp: 4_102_444_800,
          iss: "https://project.supabase.co/auth/v1",
          role: "authenticated",
          sub: "00000000-0000-4000-8000-000000000001",
        },
      },
      error: null,
    });
    mocks.getSession.mockResolvedValue({
      data: { session: { access_token: "session-access-token" } },
    });
    mocks.getOwnProfile.mockResolvedValue({ username: "rider" });
  });

  it("rejects a malformed flow id before exchanging a code", async () => {
    const response = await GET(
      new Request(
        "https://iride.test/auth/callback?code=secret-code&sb_flow_id=bad&next=%2Fgarage&intent=profile",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/login?error=invalid_request&next=%2Fgarage&intent=profile",
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("preserves a safe next path and profile intent when the provider returns an error", async () => {
    const response = await GET(
      new Request(
        "https://iride.test/auth/callback?error=access_denied&next=%2Fgarage%3Ftab%3Dvehicles&intent=profile",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/login?error=provider&next=%2Fgarage%3Ftab%3Dvehicles&intent=profile",
    );
    expect(mocks.exchangeCodeForSession).not.toHaveBeenCalled();
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("rejects an unsafe next path when routing a callback error", async () => {
    const response = await GET(
      new Request(
        "https://iride.test/auth/callback?error=access_denied&next=https%3A%2F%2Fevil.example%2Fsteal",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/login?error=provider&next=%2F",
    );
  });

  it("keeps concurrent callbacks bound to their own validated flow ids", async () => {
    const firstFlowId = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const secondFlowId = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    const [first, second] = await Promise.all([
      GET(
        new Request(
          `https://iride.test/auth/callback?code=first-code&sb_flow_id=${firstFlowId}&next=%2Fgarage`,
        ),
      ),
      GET(
        new Request(
          `https://iride.test/auth/callback?code=second-code&sb_flow_id=${secondFlowId}&next=%2Fcreate`,
        ),
      ),
    ]);

    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("first-code", {
      flowId: firstFlowId,
    });
    expect(mocks.exchangeCodeForSession).toHaveBeenCalledWith("second-code", {
      flowId: secondFlowId,
    });
    expect(first.headers.get("location")).toBe("https://iride.test/garage");
    expect(second.headers.get("location")).toBe("https://iride.test/create");
  });

  it("preserves profile intent on success and correlates each callback stage", async () => {
    const correlationId = "cccccccccccccccccccccccccccccccc";
    const response = await GET(
      new Request(
        `https://iride.test/auth/callback?code=secret-code&sb_flow_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&next=%2Fgarage&intent=profile&correlation_id=${correlationId}`,
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/users/rider",
    );
    expect(mocks.consoleInfo.mock.calls).toEqual([
      [
        {
          event: "code_exchange",
          correlation_id: correlationId,
          outcome: "succeeded",
        },
      ],
      [
        {
          event: "claims_validation",
          correlation_id: correlationId,
          outcome: "succeeded",
        },
      ],
      [
        {
          event: "profile_redirect",
          correlation_id: correlationId,
          outcome: "existing_profile",
        },
      ],
    ]);
    expect(JSON.stringify(mocks.consoleInfo.mock.calls)).not.toContain(
      "secret-code",
    );
    expect(JSON.stringify(mocks.consoleInfo.mock.calls)).not.toContain(
      "session-access-token",
    );
  });

  it("records profile lookup failure while preserving the onboarding fallback", async () => {
    const correlationId = "dddddddddddddddddddddddddddddddd";
    mocks.getOwnProfile.mockRejectedValueOnce(new Error("profile unavailable"));

    const response = await GET(
      new Request(
        `https://iride.test/auth/callback?code=secret-code&sb_flow_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&intent=profile&correlation_id=${correlationId}`,
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/onboarding",
    );
    expect(mocks.consoleInfo).toHaveBeenLastCalledWith({
      event: "profile_redirect",
      correlation_id: correlationId,
      outcome: "profile_lookup_failed",
    });
  });

  it("retains retry context when code exchange fails", async () => {
    mocks.exchangeCodeForSession.mockResolvedValueOnce({
      error: new Error("expired verifier"),
    });

    const response = await GET(
      new Request(
        "https://iride.test/auth/callback?code=secret-code&sb_flow_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa&next=%2Fgarage&intent=profile",
      ),
    );

    expect(response.headers.get("location")).toBe(
      "https://iride.test/login?error=provider&next=%2Fgarage&intent=profile",
    );
    expect(mocks.cookieSet).not.toHaveBeenCalled();
  });

  it("attributes an exchange exception to the code-exchange stage", async () => {
    mocks.exchangeCodeForSession.mockRejectedValueOnce(
      new Error("auth service unavailable"),
    );

    await GET(
      new Request(
        "https://iride.test/auth/callback?code=secret-code&sb_flow_id=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      ),
    );

    expect(mocks.consoleInfo).toHaveBeenCalledTimes(1);
    expect(mocks.consoleInfo).toHaveBeenCalledWith({
      event: "code_exchange",
      correlation_id: expect.stringMatching(/^[a-zA-Z0-9_-]{8,64}$/),
      outcome: "failed",
    });
  });
});
