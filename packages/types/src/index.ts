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

export const accountRoles = ["user", "admin"] as const;
export type AccountRole = (typeof accountRoles)[number];

export const accountStatuses = ["locked", "active", "suspended"] as const;
export type AccountStatus = (typeof accountStatuses)[number];

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
  readonly role: AccountRole;
  readonly status: AccountStatus;
  readonly canWrite: boolean;
  readonly canManage: boolean;
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
  readonly avatarMediaId?: string | null;
  readonly coverMediaId?: string | null;
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

export const communityCategories = [
  "car",
  "motorcycle",
  "bicycle",
  "groups",
] as const;
export type CommunityCategory = (typeof communityCategories)[number];

export interface ContentAuthorDto {
  readonly id: string;
  readonly username: string;
  readonly displayName: string;
}

export interface PostDto {
  readonly id: string;
  readonly body: string;
  readonly communityCategory: CommunityCategory;
  readonly author: ContentAuthorDto;
  readonly canEdit: boolean;
  readonly commentCount: number;
  readonly markerTags: readonly PostMarkerTagDto[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePostInput {
  readonly body: string;
  readonly communityCategory: CommunityCategory;
  readonly markerTags?: readonly MarkerTagInput[];
}

export type UpdatePostInput = CreatePostInput;

export type MarkerTagKind = "event";

export interface MarkerTagInput {
  readonly kind: MarkerTagKind;
  readonly id: string;
}

export interface PostMarkerTagDto extends MarkerTagInput {
  readonly title: string | null;
  readonly markerKind: ExploreFeatureKind | null;
  readonly available: boolean;
}

export interface CommentDto {
  readonly id: string;
  readonly postId: string;
  readonly body: string | null;
  readonly author: ContentAuthorDto;
  readonly parentId: string | null;
  readonly replyTo: ContentAuthorDto | null;
  readonly deleted: boolean;
  readonly canEdit: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCommentInput {
  readonly body: string;
  readonly parentId: string | null;
}

export interface UpdateCommentInput {
  readonly body: string;
}

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

export type ExploreFeatureKind = EventKind;

export const vehicleVisibilities = ["public", "private"] as const;
export type VehicleVisibility = (typeof vehicleVisibilities)[number];

export interface VehicleDto {
  readonly id: string;
  readonly owner: ContentAuthorDto;
  readonly kind: VehicleKind;
  readonly brand: string;
  readonly model: string;
  readonly year: number | null;
  readonly nickname: string | null;
  readonly description: string | null;
  readonly visibility: VehicleVisibility;
  readonly mediaIds: readonly string[];
  readonly canEdit: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateVehicleInput {
  readonly kind: VehicleKind;
  readonly brand: string;
  readonly model: string;
  readonly year: number | null;
  readonly nickname: string | null;
  readonly description: string | null;
  readonly visibility: VehicleVisibility;
  readonly mediaIds: readonly string[];
}

export type UpdateVehicleInput = Partial<CreateVehicleInput>;

export const mediaPurposes = ["avatar", "cover", "vehicle"] as const;
export type MediaPurpose = (typeof mediaPurposes)[number];
export const mediaStatuses = ["uploading", "processing", "ready", "failed", "deleted"] as const;
export type MediaStatus = (typeof mediaStatuses)[number];
export type MediaVariantKind = "thumbnail" | "preview";

export interface MediaAssetDto {
  readonly id: string;
  readonly purpose: MediaPurpose;
  readonly status: MediaStatus;
  readonly filename: string;
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly bytes: number;
  readonly variants: readonly MediaVariantKind[];
  readonly createdAt: string;
}

export interface MediaUploadRequest {
  readonly filename: string;
  readonly mimeType: "image/jpeg" | "image/png" | "image/webp";
  readonly bytes: number;
  readonly purpose: MediaPurpose;
}

export interface MediaUploadAuthorizationDto {
  readonly mediaId: string;
  readonly uploadUrl: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly expiresAt: string;
}

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
  | "event";

export interface SearchResultDto {
  readonly id: string;
  readonly kind: SearchResultKind;
  readonly title: string;
  readonly subtitle: string;
  readonly username: string | null;
  readonly communityCategory?: CommunityCategory;
}
