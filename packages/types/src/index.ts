export const serviceNames = ["web", "api", "worker"] as const;

export type ServiceName = (typeof serviceNames)[number];

export interface HealthResponse {
  status: "ok";
  service: ServiceName;
  version: string;
}

export function createHealthResponse(
  service: ServiceName,
  version = "0.1.0",
): HealthResponse {
  return { status: "ok", service, version };
}

export const profileVisibilities = ["public", "followers", "private"] as const;

export type ProfileVisibility = (typeof profileVisibilities)[number];

export interface PublicProfileDto {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
  readonly bio: string | null;
  readonly avatarMediaId: string | null;
  readonly coverMediaId: string | null;
  readonly locationName: string | null;
  readonly visibility: ProfileVisibility;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface OwnProfileDto {
  readonly id: string;
  readonly username: string | null;
  readonly displayName: string | null;
  readonly bio: string | null;
  readonly avatarMediaId: string | null;
  readonly coverMediaId: string | null;
  readonly locationName: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly visibility: ProfileVisibility;
  readonly isComplete: boolean;
  readonly usernameChangeAvailableAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface UpdateProfileInput {
  readonly username?: string;
  readonly displayName?: string;
  readonly bio?: string | null;
  readonly locationName?: string | null;
  readonly latitude?: number | null;
  readonly longitude?: number | null;
  readonly visibility?: ProfileVisibility;
}

export const profileErrorCodes = [
  "PROFILE_NOT_FOUND",
  "PROFILE_INCOMPLETE",
  "PROFILE_VALIDATION_FAILED",
  "USERNAME_TAKEN",
  "USERNAME_RESERVED",
  "USERNAME_COOLDOWN",
] as const;

export type ProfileErrorCode = (typeof profileErrorCodes)[number];
