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
    or: () => result,
    limit: () => result,
    maybeSingle: () => result,
  });
}

describe("media production repository", () => {
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
