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
  "PROFILE_UPDATE_FAILED",
  "USERNAME_TAKEN",
  "USERNAME_RESERVED",
  "USERNAME_COOLDOWN",
] as const;

export type ProfileErrorCode = (typeof profileErrorCodes)[number];

export const vehicleKinds = ["car", "motorcycle", "bicycle"] as const;
export type VehicleKind = (typeof vehicleKinds)[number];

export const eventKinds = ["meeting", "event", "trip"] as const;
export type EventKind = (typeof eventKinds)[number];

export interface ContentAuthorDto {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
}

export interface PostDto {
  readonly id: string;
  readonly body: string;
  readonly author: ContentAuthorDto;
  readonly canEdit: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePostInput {
  readonly body: string;
}

export type UpdatePostInput = CreatePostInput;

export interface EventDto {
  readonly id: string;
  readonly kind: EventKind;
  readonly title: string;
  readonly description: string | null;
  readonly locationLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly destinationLabel: string | null;
  readonly destinationLatitude: number | null;
  readonly destinationLongitude: number | null;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly timezone: string;
  readonly vehicleKinds: readonly VehicleKind[];
  readonly organizer: ContentAuthorDto;
  readonly canEdit: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateEventInput {
  readonly kind: EventKind;
  readonly title: string;
  readonly description: string | null;
  readonly locationLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly destinationLabel?: string | null;
  readonly destinationLatitude?: number | null;
  readonly destinationLongitude?: number | null;
  readonly startsAt: string;
  readonly endsAt?: string | null;
  readonly timezone: string;
  readonly vehicleKinds: readonly VehicleKind[];
}

export type UpdateEventInput = Partial<CreateEventInput>;

export interface PhotographerSpotDto {
  readonly id: string;
  readonly title: string;
  readonly description: string | null;
  readonly locationLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
  readonly photographer: ContentAuthorDto;
  readonly canEdit: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePhotographerSpotInput {
  readonly title: string;
  readonly description: string | null;
  readonly locationLabel: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly startsAt: string;
  readonly endsAt: string;
  readonly timezone: string;
}

export type UpdatePhotographerSpotInput =
  Partial<CreatePhotographerSpotInput>;

export type ExploreFeatureKind = EventKind | "photographerSpot";

export interface ExploreFeatureDto {
  readonly id: string;
  readonly kind: ExploreFeatureKind;
  readonly title: string;
  readonly subtitle: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly startsAt: string;
  readonly endsAt: string | null;
  readonly author: ContentAuthorDto;
  readonly canEdit: boolean;
}

export type SearchResultKind =
  | "profile"
  | "post"
  | "event"
  | "photographerSpot";

export interface SearchResultDto {
  readonly id: string;
  readonly kind: SearchResultKind;
  readonly title: string;
  readonly subtitle: string;
  readonly username: string | null;
}
