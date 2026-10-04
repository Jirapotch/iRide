import { describe, expect, it, vi } from "vitest";

const from = vi.fn();

vi.mock("@iride/database/admin", () => ({
  createAdminDatabaseClient: () => ({ from }),
}));
vi.mock("@iride/database/server", () => ({
  createServerDatabaseClient: () => ({ from }),
}));

import { createMediaRepository } from "./media-repository";

function query(data: unknown) {
  const result = Promise.resolve({ data, error: null });
  return Object.assign(result, {
    select: () => result,
    eq: () => result,
    is: () => result,
    in: () => result,
    contains: () => result,
    or: () => result,
    not: () => result,
    limit: () => result,
    maybeSingle: () => result,
  });
}

describe("media production repository", () => {
  it.each(["sender", "recipient", null])(
    "keeps document images exclusive to locked garage downloads for %s",
    async (viewer) => {
      from.mockClear();
      from.mockImplementation(() =>
        query({
          id: "document",
          owner_id: "sender",
          purpose: "vehicle_document",
          status: "ready",
          deleted_at: null,
          storage_provider: "supabase",
        }),
      );
      const repository = createMediaRepository({
        url: "https://example.test",
        publishableKey: "public",
        serviceRoleKey: "service",
      });
      expect(
        await repository.findDeliverableVariant("document", "preview", viewer),
      ).toBeNull();
      expect(from).toHaveBeenCalledTimes(1);
      expect(from).not.toHaveBeenCalledWith("media_variants");
    },
  );
  it("authorizes transferred photos against their current owner despite a previous-uploader object key", async () => {
    from.mockImplementation((table: string) => {
      if (table === "media")
        return query({
          id: "photo",
          owner_id: "recipient",
          purpose: "vehicle",
          status: "ready",
          deleted_at: null,
          storage_provider: "supabase",
        });
      if (table === "account_access")
        return query({ status: "active", transition_id: null });
      if (table === "media_variants")
        return query({
          object_key: "users/previous-owner/vehicle/photo/preview.webp",
        });
      return query([]);
    });
    const repository = createMediaRepository({
      url: "https://example.test",
      publishableKey: "public",
      serviceRoleKey: "service",
    });
    expect(
      await repository.findDeliverableVariant(
        "photo",
        "preview",
        "previous-owner",
      ),
    ).toBeNull();
    expect(
      await repository.findDeliverableVariant("photo", "preview", "recipient"),
    ).toEqual({
      objectKey: "users/previous-owner/vehicle/photo/preview.webp",
      storageProvider: "supabase",
      serverOnly: true,
    });
  });
  it.each(["r2", "supabase"])(
    "retains %s provider when loading an owned upload and variant",
    async (storageProvider) => {
      from.mockImplementation((table: string) => {
        if (table === "media")
          return query({
            id: "m1",
            owner_id: "u1",
            purpose: "avatar",
            status: "ready",
            deleted_at: null,
            original_object_key: null,
            mime_type: "image/png",
            bytes: 10,
            storage_provider: storageProvider,
          });
        if (table === "account_access")
          return query({ status: "active", transition_id: null });
        if (table === "media_variants")
          return query({ object_key: "preview.webp" });
        return query([]);
      });
      const repository = createMediaRepository({
        url: "https://example.test",
        publishableKey: "public",
        serviceRoleKey: "service",
      });
      expect(await repository.findOwnedUpload("u1", "m1")).toMatchObject({
        objectKey: null,
        storageProvider,
      });
      expect(
        await repository.findDeliverableVariant("m1", "preview", "u1"),
      ).toEqual({ objectKey: "preview.webp", storageProvider });
      expect(
        await repository.findDeliverableVariant("m1", "preview", null),
      ).toBeNull();
    },
  );
  it("never delivers a ready variant whose owner is suspended", async () => {
    from.mockImplementation((table: string) => {
      if (table === "media")
        return query({
          id: "20000000-0000-4000-8000-000000000001",
          owner_id: "10000000-0000-4000-8000-000000000001",
          status: "ready",
          deleted_at: null,
        });
      if (table === "account_access") return query({ status: "suspended" });
      if (table === "profiles")
        return query([{ id: "10000000-0000-4000-8000-000000000001" }]);
      if (table === "media_variants")
        return query({ object_key: "users/suspended/preview.webp" });
      return query([]);
    });
    const repository = createMediaRepository({
      url: "https://example.test",
      publishableKey: "public",
      serviceRoleKey: "service",
    });

    const variant = await repository.findDeliverableVariant(
      "20000000-0000-4000-8000-000000000001",
      "preview",
      null,
    );

    expect(variant).toBeNull();
    expect(from).toHaveBeenCalledWith("account_access");
  });
});
