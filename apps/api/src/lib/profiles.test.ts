import type { Tables } from "@iride/database/types";
import { AuthenticationError } from "@iride/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  handleGetOwnProfile,
  handleGetPublicProfile,
  handlePatchOwnProfile,
  type ProfileDependencies,
  type ProfileRepository,
} from "./profiles";

const userId = "11111111-1111-4111-8111-111111111111";
const otherId = "22222222-2222-4222-8222-222222222222";

function profile(
  overrides: Partial<Tables<"profiles">> = {},
): Tables<"profiles"> {
  return {
    avatar_media_id: null,
    bio: "Roads and stories",
    cover_media_id: null,
    created_at: "2026-08-27T00:00:00.000Z",
    display_name: "Road Rider",
    id: userId,
    latitude: 13.7563,
    location_name: "Bangkok",
    longitude: 100.5018,
    updated_at: "2026-08-27T00:00:00.000Z",
    username: "road_rider",
    username_changed_at: "2026-08-27T00:00:00.000Z",
    visibility: "public",
    ...overrides,
  };
}

function setup(row: Tables<"profiles"> | null = profile()) {
  const repository: ProfileRepository = {
    getById: vi.fn().mockResolvedValue(row),
    getByUsername: vi.fn().mockResolvedValue(row),
    updateOwner: vi.fn().mockResolvedValue(undefined),
  };
  const dependencies: ProfileDependencies = {
    authenticate: vi.fn().mockResolvedValue({ userId, accessTokenClaims: {} }),
    repository,
    allowedOrigins: "http://localhost:3000",
  };
  return { dependencies, repository };
}

describe("profile API handlers", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns an owner DTO without auth metadata", async () => {
    const { dependencies } = setup();
    const response = await handleGetOwnProfile(
      new Request("http://localhost:3001/api/v1/profile/me", {
        headers: { authorization: "Bearer signed.jwt" },
      }),
      dependencies,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.data).toMatchObject({
      id: userId,
      isComplete: true,
      latitude: 13.7563,
    });
    expect(JSON.stringify(body)).not.toContain("email");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("requires authentication for the owner endpoint", async () => {
    const { dependencies } = setup();
    const unauthorized = {
      ...dependencies,
      authenticate: vi
        .fn()
        .mockRejectedValue(new AuthenticationError("AUTH_REQUIRED")),
    };
    const response = await handleGetOwnProfile(
      new Request("http://localhost:3001/api/v1/profile/me"),
      unauthorized,
    );
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      error: { code: "AUTH_REQUIRED" },
    });
  });

  it("validates and updates only normalized profile input", async () => {
    const { dependencies, repository } = setup();
    const response = await handlePatchOwnProfile(
      new Request("http://localhost:3001/api/v1/profile/me", {
        method: "PATCH",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          username: " Road_Rider ",
          displayName: " Rider ",
        }),
      }),
      dependencies,
    );

    expect(response.status).toBe(200);
    expect(repository.updateOwner).toHaveBeenCalledWith(userId, "signed.jwt", {
      username: "road_rider",
      displayName: "Rider",
    });
  });

  it.each([
    [{ username: "admin" }, "USERNAME_RESERVED", 409],
    [{ latitude: 13.7 }, "PROFILE_VALIDATION_FAILED", 400],
    [{ email: "private@example.test" }, "PROFILE_VALIDATION_FAILED", 400],
  ] as const)("rejects invalid update %#", async (body, code, status) => {
    const { dependencies, repository } = setup();
    const response = await handlePatchOwnProfile(
      new Request("http://localhost:3001/api/v1/profile/me", {
        method: "PATCH",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      }),
      dependencies,
    );
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ error: { code } });
    expect(repository.updateOwner).not.toHaveBeenCalled();
  });

  it("maps duplicate and cooldown database failures", async () => {
    for (const [error, code] of [
      [{ code: "23505" }, "USERNAME_TAKEN"],
      [{ message: "username_cooldown" }, "USERNAME_COOLDOWN"],
    ] as const) {
      const { dependencies, repository } = setup();
      vi.mocked(repository.updateOwner).mockRejectedValue(error);
      const response = await handlePatchOwnProfile(
        new Request("http://localhost:3001/api/v1/profile/me", {
          method: "PATCH",
          headers: {
            authorization: "Bearer signed.jwt",
            "content-type": "application/json",
          },
          body: JSON.stringify({ username: "next_name" }),
        }),
        dependencies,
      );
      expect(response.status).toBe(409);
      expect(await response.json()).toMatchObject({ error: { code } });
    }
  });

  it("serves public and followers profiles anonymously without coordinates", async () => {
    for (const visibility of ["public", "followers"] as const) {
      const { dependencies } = setup(profile({ visibility }));
      const response = await handleGetPublicProfile(
        new Request("http://localhost:3001/api/v1/users/road_rider"),
        "road_rider",
        dependencies,
      );
      const body = await response.json();
      expect(response.status).toBe(200);
      expect(body.data.visibility).toBe(visibility);
      expect(body.data).not.toHaveProperty("latitude");
      expect(dependencies.authenticate).not.toHaveBeenCalled();
    }
  });

  it("hides private profiles from non-owners and permits the owner", async () => {
    const privateProfile = profile({ visibility: "private" });
    const anonymous = setup(privateProfile);
    const hidden = await handleGetPublicProfile(
      new Request("http://localhost:3001/api/v1/users/road_rider"),
      "road_rider",
      anonymous.dependencies,
    );
    expect(hidden.status).toBe(404);

    const owner = setup(privateProfile);
    const visible = await handleGetPublicProfile(
      new Request("http://localhost:3001/api/v1/users/road_rider", {
        headers: { authorization: "Bearer signed.jwt" },
      }),
      "road_rider",
      owner.dependencies,
    );
    expect(visible.status).toBe(200);

    const other = setup(privateProfile);
    const otherDependencies = {
      ...other.dependencies,
      authenticate: vi.fn().mockResolvedValue({
        userId: otherId,
        accessTokenClaims: {},
      }),
    };
    const denied = await handleGetPublicProfile(
      new Request("http://localhost:3001/api/v1/users/road_rider", {
        headers: { authorization: "Bearer signed.jwt" },
      }),
      "road_rider",
      otherDependencies,
    );
    expect(denied.status).toBe(404);
  });

  it("rejects invalid optional bearer tokens and denied CORS origins", async () => {
    const invalid = setup();
    const invalidDependencies = {
      ...invalid.dependencies,
      authenticate: vi
        .fn()
        .mockRejectedValue(new AuthenticationError("AUTH_INVALID_TOKEN")),
    };
    const invalidResponse = await handleGetPublicProfile(
      new Request("http://localhost:3001/api/v1/users/road_rider", {
        headers: { authorization: "Bearer invalid" },
      }),
      "road_rider",
      invalidDependencies,
    );
    expect(invalidResponse.status).toBe(401);

    const denied = setup();
    const deniedResponse = await handleGetOwnProfile(
      new Request("http://localhost:3001/api/v1/profile/me", {
        headers: { origin: "https://evil.example" },
      }),
      denied.dependencies,
    );
    expect(deniedResponse.status).toBe(403);
    expect(denied.dependencies.authenticate).not.toHaveBeenCalled();
  });
});
