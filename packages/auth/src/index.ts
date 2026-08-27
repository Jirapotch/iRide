import {
  createClient,
  type JwtPayload,
  type SupabaseClient,
} from "@supabase/supabase-js";

export const AUTH_ERROR_CODES = [
  "AUTH_REQUIRED",
  "AUTH_INVALID_TOKEN",
  "AUTH_PROVIDER_ERROR",
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];
export type SupabaseAccessTokenClaims = JwtPayload;

export interface AuthContext {
  readonly userId: string;
  readonly accessTokenClaims: SupabaseAccessTokenClaims;
}

export interface AuthErrorBody {
  readonly error: {
    readonly code: AuthErrorCode;
    readonly message: string;
  };
}

export interface AuthenticateRequestConfig {
  readonly supabaseUrl: string;
  readonly publishableKey: string;
  readonly audience?: string;
  readonly now?: () => number;
}

interface ClaimsVerifier {
  readonly auth: Pick<SupabaseClient["auth"], "getClaims">;
}

export class AuthenticationError extends Error {
  readonly code: AuthErrorCode;
  readonly status: 401 | 503;

  constructor(code: AuthErrorCode, options?: ErrorOptions) {
    super(messageForAuthCode(code), options);
    this.name = "AuthenticationError";
    this.code = code;
    this.status = code === "AUTH_PROVIDER_ERROR" ? 503 : 401;
  }
}

export function parseBearerToken(
  authorizationHeader: string | null | undefined,
): string {
  if (!authorizationHeader) {
    throw new AuthenticationError("AUTH_REQUIRED");
  }

  const match = /^Bearer ([^\s]+)$/i.exec(authorizationHeader.trim());
  if (!match?.[1]) {
    throw new AuthenticationError("AUTH_INVALID_TOKEN");
  }

  return match[1];
}

export function validateAccessTokenClaims(
  claims: SupabaseAccessTokenClaims,
  config: Pick<AuthenticateRequestConfig, "supabaseUrl" | "audience" | "now">,
): AuthContext {
  const expectedIssuer = `${normalizeSupabaseUrl(config.supabaseUrl)}/auth/v1`;
  const expectedAudience = config.audience ?? "authenticated";
  const now = Math.floor((config.now?.() ?? Date.now()) / 1000);
  const audience = Array.isArray(claims.aud) ? claims.aud : [claims.aud];

  if (
    claims.iss !== expectedIssuer ||
    !audience.includes(expectedAudience) ||
    !isUuid(claims.sub) ||
    !Number.isFinite(claims.exp) ||
    claims.exp <= now
  ) {
    throw new AuthenticationError("AUTH_INVALID_TOKEN");
  }

  return { userId: claims.sub, accessTokenClaims: claims };
}

export async function authenticateRequest(
  request: Pick<Request, "headers">,
  config: AuthenticateRequestConfig,
  verifier: ClaimsVerifier = createClaimsVerifier(config),
): Promise<AuthContext> {
  const token = parseBearerToken(request.headers.get("authorization"));

  let result: Awaited<ReturnType<ClaimsVerifier["auth"]["getClaims"]>>;
  try {
    result = await verifier.auth.getClaims(token);
  } catch (error) {
    throw new AuthenticationError("AUTH_PROVIDER_ERROR", { cause: error });
  }

  if (result.error || !result.data?.claims) {
    throw new AuthenticationError("AUTH_INVALID_TOKEN", {
      ...(result.error ? { cause: result.error } : {}),
    });
  }

  return validateAccessTokenClaims(result.data.claims, config);
}

export function toAuthErrorBody(error: AuthenticationError): AuthErrorBody {
  return {
    error: {
      code: error.code,
      message: error.message,
    },
  };
}

function createClaimsVerifier(
  config: AuthenticateRequestConfig,
): ClaimsVerifier {
  const url = normalizeSupabaseUrl(config.supabaseUrl);
  const publishableKey = config.publishableKey.trim();

  if (!publishableKey) {
    throw new AuthenticationError("AUTH_PROVIDER_ERROR");
  }

  return createClient(url, publishableKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
}

function normalizeSupabaseUrl(value: string): string {
  const normalized = value.trim().replace(/\/+$/, "");
  try {
    return new URL(normalized).toString().replace(/\/+$/, "");
  } catch (error) {
    throw new AuthenticationError("AUTH_PROVIDER_ERROR", { cause: error });
  }
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function messageForAuthCode(code: AuthErrorCode): string {
  switch (code) {
    case "AUTH_REQUIRED":
      return "Authentication is required.";
    case "AUTH_INVALID_TOKEN":
      return "Authentication token is invalid.";
    case "AUTH_PROVIDER_ERROR":
      return "Authentication service is unavailable.";
  }
}

export interface AuthBoundary {
  readonly provider: "supabase-auth";
}
