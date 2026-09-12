import { describe, expect, it, vi } from "vitest";

import {
  handleMediaReauthorize,
  handleMediaComplete,
  handleMediaUpload,
  handleMediaVariant,
  type MediaDependencies,
} from "./media";

const userId = "10000000-0000-4000-8000-000000000001";
const mediaId = "20000000-0000-4000-8000-000000000001";
const key = `users/${userId}/avatar/${mediaId}/original`;

function setup(): MediaDependencies {
  return {
    authenticate: vi.fn().mockResolvedValue({ userId, accessTokenClaims: {} }),
    newId: () => mediaId,
    repository: {
      getAccountAccess: vi
        .fn()
        .mockResolvedValue({ status: "active", transitionId: null }),
      createUpload: vi.fn().mockResolvedValue(undefined),
      findOwnedUpload: vi.fn().mockResolvedValue({
        id: mediaId,
        ownerId: userId,
        purpose: "avatar",
        status: "uploading",
        objectKey: key,
        mimeType: "image/webp",
        bytes: 1024,
      }),
      markProcessingAndEnqueue: vi.fn().mockResolvedValue(undefined),
      findDeliverableVariant: vi.fn().mockResolvedValue({
        objectKey: `users/${userId}/avatar/${mediaId}/preview.webp`,
      }),
    },
    storage: {
      signUpload: vi.fn().mockResolvedValue({
        bucketId: "media",
        objectPath: key,
        uploadToken: "signed-token",
        expiresAt: "2026-09-13T01:00:00.000Z",
      }),
      head: vi
        .fn()
        .mockResolvedValue({ bytes: 1024, contentType: "image/webp" }),
      signDownload: vi.fn().mockResolvedValue("https://download.test/signed"),
    },
  };
}

describe("media API handlers", () => {
  it("returns the same row after an ambiguous initial response without duplicating media", async () => {
    const deps = setup();
    const requestedId = "20000000-0000-4000-8000-000000000099";
    const objectKey = `users/${userId}/avatar/${requestedId}/original`;
    const rows = new Map<string, unknown>();
    vi.mocked(deps.repository.createUpload).mockImplementation(
      async (input) => {
        if (rows.has(input.id)) throw { code: "23505" };
        rows.set(input.id, { ...input, status: "uploading" });
      },
    );
    vi.mocked(deps.repository.findOwnedUpload).mockImplementation(
      async (owner, id) => {
        const row = rows.get(id) as Awaited<
          ReturnType<typeof deps.repository.findOwnedUpload>
        >;
        return row?.ownerId === owner ? row : null;
      },
    );
    vi.mocked(deps.storage.signUpload).mockImplementation(async (path) => ({
      bucketId: "media",
      objectPath: path,
      uploadToken: "token",
      expiresAt: "2099-01-01",
    }));
    const request = () =>
      new Request("https://api.test/media/uploads", {
        method: "POST",
        headers: {
          authorization: "Bearer jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          uploadId: requestedId,
          purpose: "avatar",
          filename: "avatar.webp",
          mimeType: "image/webp",
          bytes: 1024,
        }),
      });
    expect((await handleMediaUpload(request(), deps)).status).toBe(201);
    const retry = await handleMediaUpload(request(), deps);
    expect(retry.status).toBe(201);
    expect(await retry.json()).toMatchObject({
      data: { mediaId: requestedId, objectPath: objectKey },
    });
    expect(rows.size).toBe(1);
  });

  it.each([
    "owner",
    "bytes",
    "purpose",
    "status",
    "provider",
    "filename",
    "mime",
    "key",
  ])(
    "rejects an idempotency identity with conflicting %s",
    async (conflict) => {
      const deps = setup();
      vi.mocked(deps.repository.createUpload).mockRejectedValue({
        code: "23505",
      });
      vi.mocked(deps.repository.findOwnedUpload).mockResolvedValue(
        conflict === "owner"
          ? null
          : {
              id: mediaId,
              ownerId: userId,
              purpose: conflict === "purpose" ? "cover" : "avatar",
              status: conflict === "status" ? "ready" : "uploading",
              objectKey: conflict === "key" ? "different-key" : key,
              filename:
                conflict === "filename" ? "different.webp" : "avatar.webp",
              mimeType: conflict === "mime" ? "image/png" : "image/webp",
              bytes: conflict === "bytes" ? 2048 : 1024,
              storageProvider: conflict === "provider" ? "r2" : "supabase",
            },
      );
      const request = new Request("https://api.test/media/uploads", {
        method: "POST",
        headers: {
          authorization: "Bearer jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          uploadId: mediaId,
          purpose: "avatar",
          filename: "avatar.webp",
          mimeType: "image/webp",
          bytes: 1024,
        }),
      });
      const response = await handleMediaUpload(request, deps);
      expect(response.status).toBe(409);
      expect(await response.text()).not.toContain("signed-token");
    },
  );
  it("does not disclose a renewed token if media became ready while signing", async () => {
    const deps = setup();
    const media = {
      id: mediaId,
      ownerId: userId,
      purpose: "avatar" as const,
      status: "uploading" as const,
      objectKey: key,
      mimeType: "image/webp",
      bytes: 1024,
      storageProvider: "supabase" as const,
    };
    vi.mocked(deps.repository.findOwnedUpload)
      .mockResolvedValueOnce(media)
      .mockResolvedValueOnce({ ...media, status: "ready" });
    const response = await handleMediaReauthorize(
      new Request("https://api.test/media/renew", {
        method: "POST",
        headers: { authorization: "Bearer signed.jwt" },
      }),
      mediaId,
      deps,
    );
    expect(response.status).toBe(409);
    expect(await response.text()).not.toContain("signed-token");
  });
  it("renews authorization for the same owned Supabase upload without creating a row", async () => {
    const deps = setup();
    vi.mocked(deps.repository.findOwnedUpload).mockResolvedValue({
      id: mediaId,
      ownerId: userId,
      purpose: "avatar",
      status: "uploading",
      objectKey: key,
      mimeType: "image/webp",
      bytes: 1024,
      storageProvider: "supabase",
    });
    const response = await handleMediaReauthorize(
      new Request("https://api.test/media/renew", {
        method: "POST",
        headers: { authorization: "Bearer signed.jwt" },
      }),
      mediaId,
      deps,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      data: {
        mediaId,
        bucketId: "media",
        objectPath: key,
        uploadToken: "signed-token",
        expiresAt: "2026-09-13T01:00:00.000Z",
      },
    });
    expect(deps.repository.createUpload).not.toHaveBeenCalled();
    expect(deps.repository.findOwnedUpload).toHaveBeenCalledWith(
      userId,
      mediaId,
    );
  });

  it.each([null, "ready", "processing", "failed", "r2"])(
    "refuses renewal for unavailable/non-uploading media: %s",
    async (state) => {
      const deps = setup();
      vi.mocked(deps.repository.findOwnedUpload).mockResolvedValue(
        state === null
          ? null
          : {
              id: mediaId,
              ownerId: userId,
              purpose: "avatar",
              status: state === "r2" ? "uploading" : (state as "ready"),
              objectKey: key,
              mimeType: "image/webp",
              bytes: 1024,
              storageProvider: state === "r2" ? "r2" : "supabase",
            },
      );
      const response = await handleMediaReauthorize(
        new Request("https://api.test/media/renew", {
          method: "POST",
          headers: { authorization: "Bearer signed.jwt" },
        }),
        mediaId,
        deps,
      );
      expect(response.status).toBe(state === null ? 404 : 409);
      expect(deps.storage.signUpload).not.toHaveBeenCalled();
    },
  );
  it("authorizes a bounded Supabase upload with the exact browser SDK contract", async () => {
    const dependencies = setup();
    const response = await handleMediaUpload(
      new Request("https://api.test/media/uploads", {
        method: "POST",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          filename: "avatar.webp",
          mimeType: "image/webp",
          bytes: 1024,
          purpose: "avatar",
        }),
      }),
      dependencies,
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      data: {
        mediaId,
        bucketId: "media",
        objectPath: key,
        uploadToken: "signed-token",
        expiresAt: "2026-09-13T01:00:00.000Z",
      },
    });
    expect(dependencies.repository.createUpload).toHaveBeenCalledWith(
      expect.objectContaining({
        id: mediaId,
        ownerId: userId,
        objectKey: key,
        storageProvider: "supabase",
      }),
      "signed.jwt",
    );
  });

  it.each(["locked", "suspended"] as const)(
    "does not authorize uploads for %s accounts",
    async (status) => {
      const dependencies = setup() as MediaDependencies & {
        repository: MediaDependencies["repository"] & {
          getAccountAccess: (userId: string) => Promise<unknown>;
        };
      };
      dependencies.repository.getAccountAccess = vi
        .fn()
        .mockResolvedValue({ status, transitionId: null });

      const response = await handleMediaUpload(
        new Request("https://api.test/media/uploads", {
          method: "POST",
          headers: {
            authorization: "Bearer signed.jwt",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            filename: "avatar.webp",
            mimeType: "image/webp",
            bytes: 1024,
            purpose: "avatar",
          }),
        }),
        dependencies,
      );

      expect(response.status).toBe(403);
      expect(dependencies.repository.createUpload).not.toHaveBeenCalled();
    },
  );

  it("does not complete an upload after the owner is suspended", async () => {
    const dependencies = setup() as MediaDependencies & {
      repository: MediaDependencies["repository"] & {
        getAccountAccess: (userId: string) => Promise<unknown>;
      };
    };
    dependencies.repository.getAccountAccess = vi
      .fn()
      .mockResolvedValue({ status: "suspended", transitionId: null });

    const response = await handleMediaComplete(
      new Request(`https://api.test/media/${mediaId}/complete`, {
        method: "POST",
        headers: { authorization: "Bearer signed.jwt" },
      }),
      mediaId,
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(
      dependencies.repository.markProcessingAndEnqueue,
    ).not.toHaveBeenCalled();
  });

  it("does not authorize an upload during a pending restore", async () => {
    const dependencies = setup() as MediaDependencies & {
      repository: MediaDependencies["repository"] & {
        getAccountAccess: (userId: string) => Promise<unknown>;
      };
    };
    dependencies.repository.getAccountAccess = vi.fn().mockResolvedValue({
      status: "active",
      transitionId: "33333333-3333-4333-8333-333333333333",
    });

    const response = await handleMediaUpload(
      new Request("https://api.test/media/uploads", {
        method: "POST",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          filename: "avatar.webp",
          mimeType: "image/webp",
          bytes: 1024,
          purpose: "avatar",
        }),
      }),
      dependencies,
    );

    expect(response.status).toBe(403);
    expect(dependencies.repository.createUpload).not.toHaveBeenCalled();
  });

  it("verifies R2 metadata before atomically enqueueing processing", async () => {
    const dependencies = setup();
    const response = await handleMediaComplete(
      new Request(`https://api.test/media/${mediaId}/complete`, {
        method: "POST",
        headers: { authorization: "Bearer signed.jwt" },
      }),
      mediaId,
      dependencies,
    );
    expect(response.status).toBe(202);
    expect(
      dependencies.repository.markProcessingAndEnqueue,
    ).toHaveBeenCalledWith(
      userId,
      mediaId,
      expect.objectContaining({ version: 1, mediaId, objectKey: key }),
    );
  });

  it("rejects completion when uploaded bytes do not match", async () => {
    const dependencies = setup();
    vi.mocked(dependencies.storage.head).mockResolvedValue({
      bytes: 1000,
      contentType: "image/webp",
    });
    const response = await handleMediaComplete(
      new Request(`https://api.test/media/${mediaId}/complete`, {
        method: "POST",
        headers: { authorization: "Bearer signed.jwt" },
      }),
      mediaId,
      dependencies,
    );
    expect(response.status).toBe(400);
    expect(
      dependencies.repository.markProcessingAndEnqueue,
    ).not.toHaveBeenCalled();
  });

  it("redirects an authorized variant to a short-lived signed URL", async () => {
    const dependencies = setup();
    const response = await handleMediaVariant(
      new Request(`https://api.test/media/${mediaId}/variants/preview`),
      mediaId,
      "preview",
      dependencies,
    );
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://download.test/signed",
    );
  });

  it.each(["r2", "supabase"] as const)(
    "routes completion and delivery through the row's %s provider",
    async (storageProvider) => {
      const dependencies = setup();
      vi.mocked(dependencies.repository.findOwnedUpload).mockResolvedValue({
        id: mediaId,
        ownerId: userId,
        purpose: "avatar",
        status: "uploading",
        objectKey: key,
        mimeType: "image/webp",
        bytes: 1024,
        storageProvider,
      });
      const response = await handleMediaComplete(
        new Request(`https://api.test/media/${mediaId}/complete`, {
          method: "POST",
          headers: { authorization: "Bearer signed.jwt" },
        }),
        mediaId,
        dependencies,
      );
      expect(response.status).toBe(202);
      expect(dependencies.storage.head).toHaveBeenCalledWith(
        key,
        storageProvider,
      );
      expect(
        dependencies.repository.markProcessingAndEnqueue,
      ).toHaveBeenCalledWith(
        userId,
        mediaId,
        expect.objectContaining({ storageProvider }),
      );
      vi.mocked(
        dependencies.repository.findDeliverableVariant,
      ).mockResolvedValue({ objectKey: key, storageProvider });
      await handleMediaVariant(
        new Request(`https://api.test/media/${mediaId}/variants/preview`),
        mediaId,
        "preview",
        dependencies,
      );
      expect(dependencies.storage.signDownload).toHaveBeenCalledWith(
        key,
        120,
        storageProvider,
      );
    },
  );

  it.each([
    { mimeType: "image/gif", bytes: 1024 },
    { mimeType: "image/webp", bytes: 10 * 1024 * 1024 + 1 },
    { mimeType: "image/webp", bytes: 0 },
  ])(
    "rejects invalid uploads before authorizing storage: %j",
    async (input) => {
      const dependencies = setup();
      const response = await handleMediaUpload(
        new Request("https://api.test/media/uploads", {
          method: "POST",
          headers: {
            authorization: "Bearer signed.jwt",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            filename: "avatar.webp",
            purpose: "avatar",
            ...input,
          }),
        }),
        dependencies,
      );
      expect(response.status).toBe(400);
      expect(dependencies.storage.signUpload).not.toHaveBeenCalled();
    },
  );

  it("never signs a private variant that the repository does not authorize", async () => {
    const dependencies = setup();
    vi.mocked(dependencies.repository.findDeliverableVariant).mockResolvedValue(
      null,
    );
    const response = await handleMediaVariant(
      new Request(`https://api.test/media/${mediaId}/variants/preview`),
      mediaId,
      "preview",
      dependencies,
    );
    expect(response.status).toBe(404);
    expect(dependencies.storage.signDownload).not.toHaveBeenCalled();
  });

  it("fails closed when upload signing is unavailable", async () => {
    const dependencies = setup();
    vi.mocked(dependencies.storage.signUpload).mockRejectedValue(
      new Error("secret upstream details"),
    );
    const response = await handleMediaUpload(
      new Request("https://api.test/media/uploads", {
        method: "POST",
        headers: {
          authorization: "Bearer signed.jwt",
          "content-type": "application/json",
        },
        body: JSON.stringify({
          filename: "avatar.webp",
          purpose: "avatar",
          mimeType: "image/webp",
          bytes: 1024,
        }),
      }),
      dependencies,
    );
    expect(response.status).toBe(503);
    expect(dependencies.repository.createUpload).not.toHaveBeenCalled();
    expect(await response.json()).toEqual({
      error: { code: "MEDIA_UNAVAILABLE", message: "MEDIA_UNAVAILABLE" },
    });
  });
});
