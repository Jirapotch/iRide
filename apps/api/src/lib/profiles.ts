import {
  authenticateRequest,
  AuthenticationError,
  parseBearerToken,
  toAuthErrorBody,
  type AuthContext,
} from "@iride/auth";
import { createAdminDatabaseClient } from "@iride/database/admin";
import { createServerDatabaseClient } from "@iride/database/server";
import type { Tables, TablesUpdate } from "@iride/database/types";
import type {
  OwnProfileDto,
  ProfileErrorCode,
  PublicProfileDto,
  UpdateProfileInput,
} from "@iride/types";
import {
  normalizeUsername,
  updateProfileSchema,
  usernameSchema,
} from "@iride/validation";

import { createCorsDecision } from "./cors";

type ProfileRow = Tables<"profiles">;

export interface ProfileRepository {
  readonly getById: (userId: string) => Promise<ProfileRow | null>;
  readonly getByUsername: (username: string) => Promise<ProfileRow | null>;
  readonly updateOwner: (
    userId: string,
    accessToken: string,
    input: UpdateProfileInput,
  ) => Promise<void>;
}

export interface ProfileDependencies {
  readonly authenticate: (
    request: Pick<Request, "headers">,
  ) => Promise<AuthContext>;
  readonly repository: ProfileRepository;
  readonly allowedOrigins?: string;
}

export class ProfileRequestError extends Error {
  constructor(
    readonly code: ProfileErrorCode,
    readonly status: 400 | 404 | 409 | 503,
    options?: ErrorOptions,
  ) {
    super(messageForProfileCode(code), options);
    this.name = "ProfileRequestError";
  }
}

export async function handleGetOwnProfile(
  request: Request,
  dependencies: ProfileDependencies = productionDependencies(),
): Promise<Response> {
  return withProfileRequest(
    request,
    dependencies,
    "GET, PATCH, OPTIONS",
    async (context) => {
      const profile = await dependencies.repository.getById(context.userId);
      if (!profile) throw new ProfileRequestError("PROFILE_NOT_FOUND", 404);
      return ownProfileDto(profile);
    },
  );
}

export async function handlePatchOwnProfile(
  request: Request,
  dependencies: ProfileDependencies = productionDependencies(),
): Promise<Response> {
  return withProfileRequest(
    request,
    dependencies,
    "GET, PATCH, OPTIONS",
    async (context) => {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        throw new ProfileRequestError("PROFILE_VALIDATION_FAILED", 400);
      }

      const parsed = updateProfileSchema.safeParse(body);
      if (!parsed.success) {
        const reserved = parsed.error.issues.some(
          (issue) => issue.message === "username_reserved",
        );
        throw new ProfileRequestError(
          reserved ? "USERNAME_RESERVED" : "PROFILE_VALIDATION_FAILED",
          reserved ? 409 : 400,
        );
      }

      const accessToken = parseBearerToken(
        request.headers.get("authorization"),
      );
      const input = Object.fromEntries(
        Object.entries(parsed.data).filter(([, value]) => value !== undefined),
      ) as UpdateProfileInput;
      try {
        await dependencies.repository.updateOwner(
          context.userId,
          accessToken,
          input,
        );
      } catch (error) {
        throw normalizeProfileWriteError(error);
      }

      const profile = await dependencies.repository.getById(context.userId);
      if (!profile) throw new ProfileRequestError("PROFILE_NOT_FOUND", 404);
      return ownProfileDto(profile);
    },
  );
}

export async function handleGetPublicProfile(
  request: Request,
  usernameValue: string,
  dependencies: ProfileDependencies = productionDependencies(),
): Promise<Response> {
  const cors = createCorsDecision(request, dependencies.allowedOrigins);
  if (!cors.allowed) return corsDenied(cors.headers);
  cors.headers.set("Cache-Control", "private, no-store");

  try {
    let viewer: AuthContext | null = null;
    if (request.headers.has("authorization")) {
      viewer = await dependencies.authenticate(request);
    }

    const parsedUsername = usernameSchema.safeParse(usernameValue);
    if (!parsedUsername.success) {
      throw new ProfileRequestError("PROFILE_NOT_FOUND", 404);
    }
    const profile = await dependencies.repository.getByUsername(
      parsedUsername.data,
    );
    if (
      !profile ||
      !profile.username ||
      !profile.display_name ||
      (profile.visibility === "private" && viewer?.userId !== profile.id)
    ) {
      throw new ProfileRequestError("PROFILE_NOT_FOUND", 404);
    }

    return Response.json(
      { data: publicProfileDto(profile) },
      { headers: cors.headers },
    );
  } catch (error) {
    return profileErrorResponse(error, cors.headers);
  }
}

export function handleProfileOptions(
  request: Request,
  allowedOrigins = process.env.CORS_ALLOWED_ORIGINS,
): Response {
  const cors = createCorsDecision(
    request,
    allowedOrigins,
    "GET, PATCH, OPTIONS",
  );
  return new Response(null, {
    status: cors.allowed ? 204 : 403,
    headers: cors.headers,
  });
}

async function withProfileRequest(
  request: Request,
  dependencies: ProfileDependencies,
  methods: string,
  operation: (context: AuthContext) => Promise<OwnProfileDto>,
): Promise<Response> {
  const cors = createCorsDecision(
    request,
    dependencies.allowedOrigins,
    methods,
  );
  if (!cors.allowed) return corsDenied(cors.headers);
  cors.headers.set("Cache-Control", "private, no-store");

  try {
    const context = await dependencies.authenticate(request);
    return Response.json(
      { data: await operation(context) },
      { headers: cors.headers },
    );
  } catch (error) {
    return profileErrorResponse(error, cors.headers);
  }
}

function productionDependencies(): ProfileDependencies {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
    const unavailable = async () => {
      throw new AuthenticationError("AUTH_PROVIDER_ERROR");
    };
    return {
      authenticate: unavailable,
      repository: {
        getById: unavailable,
        getByUsername: unavailable,
        updateOwner: unavailable,
      },
    };
  }

  const admin = createAdminDatabaseClient({ url: supabaseUrl, serviceRoleKey });
  const repository: ProfileRepository = {
    async getById(userId) {
      const { data, error } = await admin
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async getByUsername(username) {
      const { data, error } = await admin
        .from("profiles")
        .select("*")
        .eq("username", normalizeUsername(username))
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    async updateOwner(userId, accessToken, input) {
      const client = createServerDatabaseClient({
        url: supabaseUrl,
        publishableKey,
        accessToken,
      });
      const update = toProfileUpdate(input);
      const { error } = await client
        .from("profiles")
        .update(update)
        .eq("id", userId);
      if (error) throw error;
    },
  };

  return {
    authenticate(request) {
      return authenticateRequest(request, { supabaseUrl, publishableKey });
    },
    repository,
    ...(process.env.CORS_ALLOWED_ORIGINS
      ? { allowedOrigins: process.env.CORS_ALLOWED_ORIGINS }
      : {}),
  };
}

function toProfileUpdate(input: UpdateProfileInput): TablesUpdate<"profiles"> {
  return {
    ...(input.username !== undefined ? { username: input.username } : {}),
    ...(input.displayName !== undefined
      ? { display_name: input.displayName }
      : {}),
    ...(input.bio !== undefined ? { bio: input.bio } : {}),
    ...(input.locationName !== undefined
      ? { location_name: input.locationName }
      : {}),
    ...(input.latitude !== undefined ? { latitude: input.latitude } : {}),
    ...(input.longitude !== undefined ? { longitude: input.longitude } : {}),
    ...(input.visibility !== undefined ? { visibility: input.visibility } : {}),
  };
}

function publicProfileDto(profile: ProfileRow): PublicProfileDto {
  if (!profile.username || !profile.display_name) {
    throw new ProfileRequestError("PROFILE_INCOMPLETE", 409);
  }
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarMediaId: profile.avatar_media_id,
    coverMediaId: profile.cover_media_id,
    locationName: profile.location_name,
    visibility: profile.visibility,
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function ownProfileDto(profile: ProfileRow): OwnProfileDto {
  return {
    id: profile.id,
    username: profile.username,
    displayName: profile.display_name,
    bio: profile.bio,
    avatarMediaId: profile.avatar_media_id,
    coverMediaId: profile.cover_media_id,
    locationName: profile.location_name,
    latitude: profile.latitude,
    longitude: profile.longitude,
    visibility: profile.visibility,
    isComplete: Boolean(profile.username && profile.display_name),
    usernameChangeAvailableAt: usernameChangeAvailableAt(profile),
    createdAt: profile.created_at,
    updatedAt: profile.updated_at,
  };
}

function usernameChangeAvailableAt(profile: ProfileRow): string | null {
  if (!profile.username || !profile.username_changed_at) return null;
  return new Date(
    new Date(profile.username_changed_at).getTime() + 30 * 86_400_000,
  ).toISOString();
}

function normalizeProfileWriteError(error: unknown): ProfileRequestError {
  const candidate = error as { code?: string; message?: string };
  if (candidate.code === "23505")
    return new ProfileRequestError("USERNAME_TAKEN", 409, { cause: error });
  if (candidate.message?.includes("username_reserved"))
    return new ProfileRequestError("USERNAME_RESERVED", 409, { cause: error });
  if (candidate.message?.includes("username_cooldown"))
    return new ProfileRequestError("USERNAME_COOLDOWN", 409, { cause: error });
  return new ProfileRequestError("PROFILE_VALIDATION_FAILED", 400, {
    cause: error,
  });
}

function profileErrorResponse(error: unknown, headers: Headers): Response {
  if (error instanceof AuthenticationError) {
    return Response.json(toAuthErrorBody(error), {
      status: error.status,
      headers,
    });
  }
  const profileError =
    error instanceof ProfileRequestError
      ? error
      : new ProfileRequestError("PROFILE_VALIDATION_FAILED", 503, {
          cause: error,
        });
  return Response.json(
    { error: { code: profileError.code, message: profileError.message } },
    { status: profileError.status, headers },
  );
}

function corsDenied(headers: Headers): Response {
  return Response.json(
    {
      error: { code: "CORS_ORIGIN_DENIED", message: "Origin is not allowed." },
    },
    { status: 403, headers },
  );
}

function messageForProfileCode(code: ProfileErrorCode): string {
  switch (code) {
    case "PROFILE_NOT_FOUND":
      return "Profile was not found.";
    case "PROFILE_INCOMPLETE":
      return "Profile onboarding is incomplete.";
    case "PROFILE_VALIDATION_FAILED":
      return "Profile data is invalid.";
    case "USERNAME_TAKEN":
      return "Username is already in use.";
    case "USERNAME_RESERVED":
      return "Username is reserved.";
    case "USERNAME_COOLDOWN":
      return "Username cannot be changed yet.";
  }
}
