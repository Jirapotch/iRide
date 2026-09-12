import { afterEach, describe, expect, it, vi } from "vitest";
import { handleMediaUpload, type MediaDependencies } from "./media";
import { createMediaRepository } from "./media-repository";

const ownerId = "10000000-0000-4000-8000-000000000001";
const mediaId = "20000000-0000-4000-8000-000000000001";
const objectPath = `users/${ownerId}/avatar/${mediaId}/original`;

afterEach(() => vi.unstubAllGlobals());

function setup(failureCode = "23505", conflictingBytes = false) {
  let row: Record<string, unknown> | undefined;
  let inserts = 0;
  vi.stubGlobal("fetch", async (input: string, init: RequestInit) => {
    const url = new URL(input);
    if (url.pathname === "/rest/v1/account_access") {
      return Response.json({ status: "active", transition_id: null });
    }
    if (url.pathname === "/rest/v1/media" && init.method === "POST") {
      expect(new Headers(init.headers).get("authorization")).toBe(
        "Bearer owner-token",
      );
      inserts++;
      if (row)
        return Response.json(
          {
            code: failureCode,
            message: "private constraint/database detail",
            details: "private row data",
            hint: null,
          },
          { status: 409 },
        );
      row = JSON.parse(init.body as string) as Record<string, unknown>;
      return new Response(null, { status: 201 });
    }
    if (url.pathname === "/rest/v1/media" && init.method === "GET") {
      expect(url.searchParams.get("owner_id")).toBe(`eq.${ownerId}`);
      expect(url.searchParams.get("id")).toBe(`eq.${mediaId}`);
      return Response.json({
        ...row,
        bytes: conflictingBytes ? 2048 : 1024,
        deleted_at: null,
      });
    }
    throw new Error(
      `Unexpected database request: ${init.method} ${url.pathname}`,
    );
  });
  const dependencies: MediaDependencies = {
    authenticate: async () => ({
      userId: ownerId,
      accessTokenClaims: {
        iss: "https://database.test/auth/v1",
        sub: ownerId,
        aud: "authenticated",
        exp: 4070908800,
        iat: 1789228800,
        role: "authenticated",
        aal: "aal1",
        session_id: "30000000-0000-4000-8000-000000000001",
      },
    }),
    newId: () => {
      throw new Error("retry identity must come from the request");
    },
    repository: createMediaRepository({
      url: "https://database.test",
      publishableKey: "public",
      serviceRoleKey: "service",
    }),
    storage: {
      signUpload: async () => ({
        bucketId: "media",
        objectPath,
        uploadToken: "upload-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
      }),
      head: async () => ({ bytes: 1024, contentType: "image/webp" }),
      signDownload: async () => "unused",
    },
  };
  const request = () =>
    new Request("https://api.test/media/uploads", {
      method: "POST",
      headers: {
        authorization: "Bearer owner-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        uploadId: mediaId,
        filename: "avatar.webp",
        purpose: "avatar",
        mimeType: "image/webp",
        bytes: 1024,
      }),
    });
  return { dependencies, request, inserts: () => inserts, row: () => row };
}

describe("upload retry across the real repository and Supabase client", () => {
  it("recovers a lost initial response after PostgREST reports the retained ID already exists", async () => {
    const test = setup();
    expect(
      (await handleMediaUpload(test.request(), test.dependencies)).status,
    ).toBe(201);
    // Simulate the browser never receiving the first response and resending its retained UUID.
    const retry = await handleMediaUpload(test.request(), test.dependencies);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toEqual({
      data: {
        mediaId,
        bucketId: "media",
        objectPath,
        uploadToken: "upload-token",
        expiresAt: "2099-01-01T00:00:00.000Z",
      },
    });
    expect(test.inserts()).toBe(2);
    expect(test.row()).toMatchObject({
      id: mediaId,
      owner_id: ownerId,
      original_object_key: objectPath,
    });
  });

  it("keeps metadata conflict checks after normalizing the database duplicate", async () => {
    const test = setup("23505", true);
    await handleMediaUpload(test.request(), test.dependencies);
    const retry = await handleMediaUpload(test.request(), test.dependencies);
    expect(retry.status).toBe(409);
    expect(await retry.json()).toEqual({
      error: {
        code: "MEDIA_UPLOAD_CONFLICT",
        message: "MEDIA_UPLOAD_CONFLICT",
      },
    });
  });

  it("does not treat other database failures as duplicates or expose private details", async () => {
    const test = setup("42501");
    await handleMediaUpload(test.request(), test.dependencies);
    const retry = await handleMediaUpload(test.request(), test.dependencies);
    expect(retry.status).toBe(503);
    expect(await retry.json()).toEqual({
      error: { code: "MEDIA_UNAVAILABLE", message: "MEDIA_UNAVAILABLE" },
    });
  });
});
