import "server-only";

import type {
  OwnProfileDto,
  ProfileErrorCode,
  PublicProfileDto,
  UpdateProfileInput,
} from "@iride/types";

export class ProfileApiError extends Error {
  constructor(
    readonly code:
      | ProfileErrorCode
      | "AUTH_REQUIRED"
      | "AUTH_INVALID_TOKEN"
      | "AUTH_PROVIDER_ERROR",
    readonly status: number,
  ) {
    super(code);
    this.name = "ProfileApiError";
  }
}

export async function getOwnProfile(
  accessToken: string,
): Promise<OwnProfileDto> {
  const response = await profileFetch("/api/v1/profile/me", accessToken);
  return readData<OwnProfileDto>(response);
}

export async function updateOwnProfile(
  accessToken: string,
  input: UpdateProfileInput,
): Promise<OwnProfileDto> {
  const response = await profileFetch("/api/v1/profile/me", accessToken, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return readData<OwnProfileDto>(response);
}

export async function getPublicProfile(
  username: string,
  accessToken?: string,
): Promise<PublicProfileDto | null> {
  const response = await profileFetch(
    `/api/v1/users/${encodeURIComponent(username)}`,
    accessToken,
  );
  if (response.status === 404) return null;
  return readData<PublicProfileDto>(response);
}

async function profileFetch(
  pathname: string,
  accessToken?: string,
  init: RequestInit = {},
): Promise<Response> {
  const apiUrl =
    process.env.NEXT_PUBLIC_API_URL?.trim() ?? "http://localhost:3001";
  return fetch(new URL(pathname, apiUrl), {
    ...init,
    cache: "no-store",
    headers: {
      ...init.headers,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
  });
}

async function readData<T>(response: Response): Promise<T> {
  const body: unknown = await response.json().catch(() => null);
  if (response.ok && isRecord(body) && "data" in body) return body.data as T;

  const code =
    isRecord(body) &&
    isRecord(body.error) &&
    typeof body.error.code === "string"
      ? body.error.code
      : "AUTH_PROVIDER_ERROR";
  throw new ProfileApiError(code as ProfileApiError["code"], response.status);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
