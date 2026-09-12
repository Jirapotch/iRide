import { afterEach, describe, expect, it, vi } from "vitest";
import * as storage from "./index";

const key = "users/u1/avatar/m1/original";
const token = (exp: number) =>
  `header.${Buffer.from(JSON.stringify({ exp })).toString("base64url")}.signature`;
afterEach(() => vi.unstubAllGlobals());
function setup(handler: (url: string, init: RequestInit) => Response) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit) =>
      handler(String(url), init),
    ),
  );
  return storage.createSupabaseStorage({
    url: "https://storage.test",
    serviceRoleKey: "server-secret",
  });
}

describe("private Supabase storage", () => {
  it("exports the Supabase adapter", () =>
    expect(storage).toHaveProperty("createSupabaseStorage"));
  it("returns the token's actual expiry and a browser upload path", async () => {
    const uploadToken = token(2_000_000_000);
    const client = setup((url, init) => {
      expect(url).toBe(
        `https://storage.test/storage/v1/object/upload/sign/media/${key}`,
      );
      expect(init.method).toBe("POST");
      return Response.json({
        url: `/object/upload/sign/media/${key}?token=${uploadToken}`,
      });
    });
    expect(await client.signUpload(key, "image/webp", 1024)).toEqual({
      bucketId: "media",
      objectPath: key,
      uploadToken,
      expiresAt: "2033-05-18T03:33:20.000Z",
    });
  });
  it.each([token(1), "malformed-token", token(NaN)])(
    "rejects expired or malformed upload authorization",
    async (uploadToken) => {
      const client = setup(() =>
        Response.json({
          url: `/object/upload/sign/media/${key}?token=${uploadToken}`,
        }),
      );
      await expect(client.signUpload(key, "image/png", 1024)).rejects.toThrow(
        "STORAGE_UPLOAD_TOKEN_INVALID",
      );
    },
  );
  it.each([
    ["image/gif", 1],
    ["image/png", 0],
    ["image/png", 10 * 1024 * 1024 + 1],
  ] as const)(
    "rejects invalid MIME/bytes (%s, %s) before signing",
    async (mime, bytes) => {
      const client = setup(() => {
        throw new Error("must not reach storage");
      });
      await expect(client.signUpload(key, mime, bytes)).rejects.toThrow(
        "STORAGE_UPLOAD_INVALID",
      );
    },
  );
  it("reads bytes and metadata through authenticated private endpoints", async () => {
    const client = setup((url, init) => {
      expect(new Headers(init.headers).get("authorization")).toBe(
        "Bearer server-secret",
      );
      if (url.includes("/object/info/"))
        return Response.json({
          name: key,
          id: "id",
          bucket_id: "media",
          version: "1",
          size: 3,
          content_type: "image/png",
          cache_control: "no-cache",
          etag: "tag",
          last_modified: "2026-09-12T00:00:00Z",
          created_at: "2026-09-12T00:00:00Z",
        });
      expect(url).toBe(`https://storage.test/storage/v1/object/media/${key}`);
      return new Response(new Uint8Array([1, 2, 3]), {
        headers: { "content-type": "image/png" },
      });
    });
    expect(await client.head(key)).toEqual({
      bytes: 3,
      contentType: "image/png",
    });
    expect(await client.get(key)).toEqual(Buffer.from([1, 2, 3]));
  });
  it("signs private downloads with the requested short TTL", async () => {
    const client = setup((url, init) => {
      expect(url).toContain(`/object/sign/media/${key}`);
      expect(JSON.parse(String(init.body))).toEqual({ expiresIn: 120 });
      return Response.json({
        signedURL: `/object/sign/media/${key}?token=download`,
      });
    });
    expect(await client.signDownload(key, 120)).toBe(
      `https://storage.test/storage/v1/object/sign/media/${key}?token=download`,
    );
    await expect(client.signDownload(key, 0)).rejects.toThrow(
      "STORAGE_DOWNLOAD_EXPIRY_INVALID",
    );
  });
  it("rejects incomplete object metadata instead of treating it as a verified upload", async () => {
    const client = setup(() =>
      Response.json({ name: key, id: "id", bucket_id: "media" }),
    );
    await expect(client.head(key)).rejects.toThrow(
      "STORAGE_OBJECT_METADATA_INVALID",
    );
  });
  it("uploads and removes private worker objects", async () => {
    const client = setup((url, init) => {
      if (init.method === "DELETE") {
        expect(JSON.parse(String(init.body))).toEqual({ prefixes: [key] });
        return Response.json([]);
      }
      expect(url).toContain(`/object/media/${key}`);
      expect(new Headers(init.headers).get("x-upsert")).toBe("true");
      return Response.json({ Id: "id", Key: `media/${key}` });
    });
    await client.put(key, new Uint8Array([1, 2, 3]), "image/webp");
    await client.remove(key);
  });
  it("propagates storage failures instead of returning empty objects", async () => {
    const client = setup(() =>
      Response.json(
        { statusCode: "403", message: "denied", error: "Unauthorized" },
        { status: 403 },
      ),
    );
    await expect(client.head(key)).rejects.toThrow();
    await expect(client.get(key)).rejects.toThrow();
    await expect(client.remove(key)).rejects.toThrow();
    await expect(
      client.put(key, new Uint8Array([1]), "image/webp"),
    ).rejects.toThrow();
    await expect(client.signDownload(key)).rejects.toThrow();
    await expect(client.signUpload(key, "image/webp", 1)).rejects.toThrow();
  });
});
