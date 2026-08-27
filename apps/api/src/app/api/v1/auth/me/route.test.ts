import {
  AuthenticationError,
  type SupabaseAccessTokenClaims,
} from "@iride/auth";
import { describe, expect, it, vi } from "vitest";

import { handleAuthMe, handleAuthOptions } from "../../../../../lib/auth-me";

const userId = "11111111-1111-4111-8111-111111111111";
const claims = {
  aal: "aal1",
  aud: "authenticated",
  exp: 2_000_000_000,
  iat: 1_900_000_000,
  iss: "https://project.supabase.co/auth/v1",
  role: "authenticated",
  session_id: "22222222-2222-4222-8222-222222222222",
  sub: userId,
  email: "private@example.test",
  user_metadata: { unsafe: "never expose" },
} satisfies SupabaseAccessTokenClaims;

describe("GET /api/v1/auth/me", () => {
  it("returns only the verified user ID for a valid token", async () => {
    const authenticate = vi.fn().mockResolvedValue({
      userId,
      accessTokenClaims: claims,
    });
    const request = new Request("http://localhost:3001/api/v1/auth/me", {
      headers: {
        authorization: "Bearer signed.jwt.token",
        origin: "http://localhost:3000",
      },
    });

    const response = await handleAuthMe(request, {
      authenticate,
      allowedOrigins: "http://localhost:3000,https://iride-ecru.vercel.app",
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("access-control-allow-origin")).toBe(
      "http://localhost:3000",
    );
    const body = await response.json();
    expect(body).toEqual({ data: { userId } });
    expect(JSON.stringify(body)).not.toContain("private@example.test");
    expect(JSON.stringify(body)).not.toContain("signed.jwt.token");
  });

  it.each([
    ["AUTH_REQUIRED", 401],
    ["AUTH_INVALID_TOKEN", 401],
    ["AUTH_PROVIDER_ERROR", 503],
  ] as const)("normalizes %s", async (code, status) => {
    const response = await handleAuthMe(
      new Request("http://localhost:3001/api/v1/auth/me"),
      {
        authenticate: vi.fn().mockRejectedValue(new AuthenticationError(code)),
      },
    );

    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
  });

  it("rejects a disallowed cross-origin request before authentication", async () => {
    const authenticate = vi.fn();
    const response = await handleAuthMe(
      new Request("http://localhost:3001/api/v1/auth/me", {
        headers: { origin: "https://evil.example" },
      }),
      { authenticate, allowedOrigins: "https://iride-ecru.vercel.app" },
    );

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBeNull();
    expect(authenticate).not.toHaveBeenCalled();
  });
});

describe("OPTIONS /api/v1/auth/me", () => {
  it("allows configured origins and rejects other origins", () => {
    const allowed = handleAuthOptions(
      new Request("http://localhost:3001/api/v1/auth/me", {
        method: "OPTIONS",
        headers: { origin: "https://iride-ecru.vercel.app" },
      }),
      "https://iride-ecru.vercel.app",
    );
    const rejected = handleAuthOptions(
      new Request("http://localhost:3001/api/v1/auth/me", {
        method: "OPTIONS",
        headers: { origin: "https://evil.example" },
      }),
      "https://iride-ecru.vercel.app",
    );

    expect(allowed.status).toBe(204);
    expect(allowed.headers.get("access-control-allow-origin")).toBe(
      "https://iride-ecru.vercel.app",
    );
    expect(rejected.status).toBe(403);
  });
});
