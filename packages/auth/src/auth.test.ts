import type { JwtPayload } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";

import {
  authenticateRequest,
  AuthenticationError,
  parseBearerToken,
  toAuthErrorBody,
  validateAccessTokenClaims,
} from "./index";

const userId = "11111111-1111-4111-8111-111111111111";
const now = Date.UTC(2026, 7, 27, 0, 0, 0);

function claims(overrides: Partial<JwtPayload> = {}): JwtPayload {
  return {
    aal: "aal1",
    aud: "authenticated",
    exp: Math.floor(now / 1000) + 3600,
    iat: Math.floor(now / 1000),
    iss: "https://project.supabase.co/auth/v1",
    role: "authenticated",
    session_id: "22222222-2222-4222-8222-222222222222",
    sub: userId,
    ...overrides,
  };
}

describe("parseBearerToken", () => {
  it("accepts a single case-insensitive Bearer token", () => {
    expect(parseBearerToken("bearer signed.jwt.token")).toBe(
      "signed.jwt.token",
    );
  });

  it.each([null, undefined, "", "Basic abc", "Bearer", "Bearer a b"])(
    "rejects missing or malformed authorization: %s",
    (value) => {
      expect(() => parseBearerToken(value)).toThrow(AuthenticationError);
    },
  );
});

describe("validateAccessTokenClaims", () => {
  const config = {
    supabaseUrl: "https://project.supabase.co/",
    now: () => now,
  };

  it("returns the internal auth context for valid claims", () => {
    expect(validateAccessTokenClaims(claims(), config)).toEqual({
      userId,
      accessTokenClaims: claims(),
    });
  });

  it.each([
    { iss: "https://other.supabase.co/auth/v1" },
    { aud: "anon" },
    { aud: ["anon", "service_role"] },
    { sub: "client-provided-user-id" },
    { exp: Math.floor(now / 1000) },
  ])("rejects invalid trusted claims: %o", (overrides) => {
    expect(() =>
      validateAccessTokenClaims(claims(overrides), config),
    ).toThrowError(
      expect.objectContaining({ code: "AUTH_INVALID_TOKEN", status: 401 }),
    );
  });
});

describe("authenticateRequest", () => {
  const config = {
    supabaseUrl: "https://project.supabase.co",
    publishableKey: "publishable-key",
    now: () => now,
  };
  const request = new Request("https://api.example.test/api/v1/auth/me", {
    headers: { authorization: "Bearer signed.jwt.token" },
  });

  it("uses verified claims instead of a client-provided user ID", async () => {
    const verifier = {
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: { claims: claims(), header: {}, signature: new Uint8Array() },
          error: null,
        }),
      },
    };

    await expect(authenticateRequest(request, config, verifier)).resolves.toEqual(
      {
        userId,
        accessTokenClaims: claims(),
      },
    );
    expect(verifier.auth.getClaims).toHaveBeenCalledWith("signed.jwt.token");
  });

  it("normalizes verifier rejection without exposing provider details", async () => {
    const verifier = {
      auth: {
        getClaims: vi.fn().mockResolvedValue({
          data: null,
          error: new Error("token and upstream detail"),
        }),
      },
    };

    const error = await authenticateRequest(request, config, verifier).catch(
      (reason: unknown) => reason,
    );
    expect(error).toMatchObject({ code: "AUTH_INVALID_TOKEN", status: 401 });
    expect(toAuthErrorBody(error as AuthenticationError)).toEqual({
      error: {
        code: "AUTH_INVALID_TOKEN",
        message: "Authentication token is invalid.",
      },
    });
  });

  it("maps an unavailable verifier to a provider error", async () => {
    const verifier = {
      auth: {
        getClaims: vi.fn().mockRejectedValue(new Error("network failed")),
      },
    };

    await expect(authenticateRequest(request, config, verifier)).rejects.toMatchObject(
      { code: "AUTH_PROVIDER_ERROR", status: 503 },
    );
  });
});
