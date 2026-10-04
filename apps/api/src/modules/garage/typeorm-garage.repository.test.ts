import type { EntityManager } from "typeorm";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TypeOrmGarageRepository } from "./typeorm-garage.repository";
const { imageGet } = vi.hoisted(() => ({ imageGet: vi.fn() }));
vi.mock("@iride/storage", () => ({
  createSupabaseStorage: () => ({ get: imageGet }),
}));
afterEach(() => {
  vi.unstubAllEnvs();
  imageGet.mockReset();
});
const user = "10000000-0000-4000-8000-000000000070";
const vehicle = "20000000-0000-4000-8000-000000000070";
function setup(response: (sql: string, params: unknown[]) => unknown) {
  const query = vi.fn(async (sql: string, params: unknown[] = []) =>
    response(sql, params),
  );
  const database = {
    transaction: vi.fn(
      async (work: (manager: EntityManager) => Promise<unknown>) =>
        work({ query } as unknown as EntityManager),
    ),
  };
  return { query, repository: new TypeOrmGarageRepository(database as never) };
}
describe("TypeORM owner garage repository", () => {
  it("attaches processed media under authenticated role with a safe WebP filename", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : sql.startsWith("select * from public.vehicles")
          ? [{ id: vehicle, owner_id: user, archived_at: null }]
          : sql.includes("attach_garage_image_document")
            ? [{ id: "doc" }]
            : sql.startsWith("select * from public.vehicle_documents")
              ? [
                  {
                    id: "doc",
                    vehicle_id: vehicle,
                    owner_id: user,
                    filename: "receipt.webp",
                    mime_type: "image/webp",
                    bytes: 90,
                    media_id: "image",
                    object_key: null,
                    record_id: null,
                    created_at: "2026-10-05T00:00:00Z",
                  },
                ]
              : [],
    );
    await expect(
      repository.run(user, {
        kind: "attachDocument",
        vehicleId: vehicle,
        input: { mediaId: "image", recordId: null, filename: "../receipt.png" },
      }),
    ).resolves.toMatchObject({
      id: "doc",
      filename: "receipt.webp",
      mimeType: "image/webp",
    });
    expect(query).toHaveBeenCalledWith("select set_config('role', $1, true)", [
      "authenticated",
    ]);
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("attach_garage_image_document"),
      [vehicle, "image", null, "receipt.webp"],
    );
  });
  it("downloads the locked preview after original source cleanup without issuing a URL", async () => {
    vi.stubEnv("SUPABASE_URL", "https://example.test");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service");
    imageGet.mockResolvedValue(new Uint8Array([7, 8]));
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : sql.startsWith("select vehicle_id")
          ? [{ vehicle_id: vehicle }]
          : sql.startsWith("select * from public.vehicle_documents")
            ? [
                {
                  id: "doc",
                  vehicle_id: vehicle,
                  owner_id: user,
                  filename: "receipt.webp",
                  mime_type: "image/webp",
                  bytes: 90,
                  media_id: "image",
                  object_key: null,
                },
              ]
            : sql.includes("join public.media m")
              ? [
                  {
                    object_key: "users/former-owner/document/preview.webp",
                    mime_type: "image/webp",
                    bytes: 90,
                    storage_provider: "supabase",
                  },
                ]
              : [],
    );
    await expect(
      repository.run(user, { kind: "downloadDocument", documentId: "doc" }),
    ).resolves.toEqual({
      filename: "receipt.webp",
      mimeType: "image/webp",
      bytes: new Uint8Array([7, 8]),
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("for update of m"),
      ["image", user],
    );
    expect(imageGet).toHaveBeenCalledWith(
      "users/former-owner/document/preview.webp",
    );
  });
  it("atomically detaches deleted image media and queues variant cleanup", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : sql.startsWith("select vehicle_id")
          ? [{ vehicle_id: vehicle }]
          : sql.startsWith("select * from public.vehicle_documents")
            ? [
                {
                  id: "doc",
                  vehicle_id: vehicle,
                  owner_id: user,
                  media_id: "image",
                  object_key: null,
                },
              ]
            : sql.startsWith("select owner_id,archived_at")
              ? [{ owner_id: user, archived_at: null }]
              : sql.startsWith("select id,owner_id,storage_provider")
                ? [
                    {
                      id: "image",
                      owner_id: user,
                      storage_provider: "supabase",
                    },
                  ]
                : sql.startsWith("select original_object_key")
                  ? [
                      { object_key: "preview.webp" },
                      { object_key: "thumbnail.webp" },
                    ]
                  : [],
    );
    await expect(
      repository.run(user, { kind: "deleteDocument", documentId: "doc" }),
    ).resolves.toEqual({ id: "doc" });
    const statements = query.mock.calls.map(([sql]) => sql);
    const detach = statements.findIndex((sql) =>
      sql.includes("deleted_at=now()"),
    );
    const remove = statements.findIndex((sql) =>
      sql.startsWith("delete from public.media"),
    );
    const enqueue = statements.findIndex((sql) => sql.includes("enqueue_job"));
    expect(detach).toBeLessThan(remove);
    expect(remove).toBeLessThan(enqueue);
    const payload = JSON.parse(query.mock.calls[enqueue]![1]![0] as string);
    expect(payload.objects).toEqual([
      { objectKey: "preview.webp", storageProvider: "supabase" },
      { objectKey: "thumbnail.webp", storageProvider: "supabase" },
    ]);
    expect(imageGet).not.toHaveBeenCalled();
  });
  it("marks garage vehicles read-only for locked accounts", async () => {
    const { repository } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "locked", transition_id: null }]
        : sql.startsWith("select v.*")
          ? [
              {
                id: vehicle,
                owner_id: user,
                kind: "car",
                brand: "Toyota",
                model: "Yaris",
                year: null,
                nickname: null,
                description: null,
                visibility: "public",
                archived_at: null,
                mileage_km: null,
                next_service_km: null,
                next_service_date: null,
                username: "sender",
                display_name: "Sender",
                created_at: "2026-10-04T00:00:00Z",
                updated_at: "2026-10-04T00:00:00Z",
              },
            ]
          : [],
    );
    await expect(
      repository.run(user, { kind: "garage" }),
    ).resolves.toMatchObject([{ canEdit: false }]);
  });
  it("blocks document deletion in the actor's archived vehicle before storage removal", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : sql.startsWith("select vehicle_id")
          ? [{ vehicle_id: vehicle }]
          : sql.startsWith("select * from public.vehicle_documents")
            ? [
                {
                  id: "doc",
                  vehicle_id: vehicle,
                  owner_id: user,
                  object_key: "key",
                },
              ]
            : sql.startsWith("select owner_id,archived_at")
              ? [{ owner_id: user, archived_at: "2026-10-04T00:00:00Z" }]
              : [],
    );
    await expect(
      repository.run(user, { kind: "deleteDocument", documentId: "doc" }),
    ).rejects.toMatchObject({ code: "GARAGE_ARCHIVED", status: 409 });
    expect(
      query.mock.calls.some(([sql]) =>
        sql.includes("update public.vehicle_documents"),
      ),
    ).toBe(false);
  });
  it("never reveals a vehicle not owned by the authenticated actor", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : [],
    );
    await expect(
      repository.run(user, { kind: "vehicle", vehicleId: vehicle }),
    ).rejects.toMatchObject({ code: "GARAGE_NOT_FOUND", status: 404 });
    expect(query).toHaveBeenCalledWith("select set_config('role', $1, true)", [
      "authenticated",
    ]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("owner_id=$2"), [
      vehicle,
      user,
    ]);
  });
  it.each(["locked", "suspended"])(
    "blocks %s accounts before writes",
    async (status) => {
      const { repository, query } = setup((sql) =>
        sql.includes("account_access") ? [{ status, transition_id: null }] : [],
      );
      await expect(
        repository.run(user, {
          kind: "archive",
          vehicleId: vehicle,
          archived: true,
        }),
      ).rejects.toMatchObject({ code: "GARAGE_FORBIDDEN" });
      expect(
        query.mock.calls.some(([sql]) =>
          sql.includes("update public.vehicles"),
        ),
      ).toBe(false);
    },
  );
  it("freezes record mutations while ownership is pending", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : sql.includes("from public.vehicles")
          ? [{ id: vehicle, owner_id: user, archived_at: null }]
          : sql.includes("vehicle_transfers")
            ? [{ id: "pending" }]
            : [],
    );
    await expect(
      repository.run(user, {
        kind: "createRecord",
        vehicleId: vehicle,
        input: {
          kind: "service",
          title: "Oil",
          occurredOn: "2026-10-04",
          mileageKm: null,
          description: null,
          workshopName: null,
        },
      }),
    ).rejects.toMatchObject({ code: "GARAGE_TRANSFER_PENDING", status: 409 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("for update"), [
      vehicle,
      user,
    ]);
    expect(query.mock.calls.some(([sql]) => sql.includes("insert into"))).toBe(
      false,
    );
  });
  it("locks the vehicle and rechecks document ownership before downloading", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : sql.startsWith("select vehicle_id")
          ? [{ vehicle_id: vehicle }]
          : [],
    );
    await expect(
      repository.run(user, { kind: "downloadDocument", documentId: "doc" }),
    ).rejects.toMatchObject({ code: "GARAGE_NOT_FOUND" });
    const calls = query.mock.calls.map(([sql]) => sql);
    expect(
      calls.findIndex((sql) => sql.includes("from public.vehicles")),
    ).toBeLessThan(
      calls.findIndex(
        (sql) =>
          sql.includes("from public.vehicle_documents") &&
          sql.includes("for update"),
      ),
    );
    expect(query).toHaveBeenCalledWith(expect.stringContaining("owner_id=$2"), [
      "doc",
      user,
    ]);
  });
  it("allows recipient decisions only through the atomic database function", async () => {
    const { repository, query } = setup((sql) =>
      sql.includes("account_access")
        ? [{ status: "active", transition_id: null }]
        : [],
    );
    await repository.run(user, {
      kind: "decideTransfer",
      transferId: "transfer",
      decision: "accept",
    });
    expect(query).toHaveBeenCalledWith(
      "select public.decide_vehicle_transfer($1,$2)",
      ["transfer", "accept"],
    );
    expect(query.mock.calls.some(([sql]) => sql.startsWith("update"))).toBe(
      false,
    );
  });
});
