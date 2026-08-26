import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createR2MediaStorage,
  createTransitionalMediaStorage,
  loadR2Config,
  mediaCacheControl,
  mediaTtlSeconds,
  parseMediaPath,
  toR2Path,
} from "@/lib/media-storage";

const env = {
  CLOUDFLARE_ACCOUNT_ID: "account-id",
  R2_ACCESS_KEY_ID: "access-key",
  R2_SECRET_ACCESS_KEY: "secret-key",
  R2_BUCKET_AVATARS: "iride-avatars",
  R2_BUCKET_VEHICLE_MEDIA: "iride-vehicle-media",
  R2_BUCKET_POST_MEDIA: "iride-post-media",
};

describe("R2 media configuration", () => {
  it("derives the endpoint and maps logical buckets", () => {
    expect(loadR2Config(env)).toEqual({
      endpoint: "https://account-id.r2.cloudflarestorage.com",
      accessKeyId: "access-key",
      secretAccessKey: "secret-key",
      buckets: {
        avatars: "iride-avatars",
        "vehicle-media": "iride-vehicle-media",
        "post-media": "iride-post-media",
      },
    });
  });

  it("reports every missing server-only variable without exposing values", () => {
    expect(() => loadR2Config({ CLOUDFLARE_ACCOUNT_ID: "account-id" })).toThrow(
      "Missing R2 environment variables: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_AVATARS, R2_BUCKET_VEHICLE_MEDIA, R2_BUCKET_POST_MEDIA",
    );
  });
});

describe("media path providers", () => {
  it("marks new paths as R2 and parses transitional paths", () => {
    expect(toR2Path("user/photo.webp")).toBe("r2:user/photo.webp");
    expect(parseMediaPath("r2:user/photo.webp")).toEqual({ provider: "r2", key: "user/photo.webp" });
    expect(parseMediaPath("user/legacy.webp")).toEqual({ provider: "supabase", key: "user/legacy.webp" });
  });

  it("rejects empty or malformed R2 paths", () => {
    expect(() => toR2Path("")).toThrow("R2 object key is required");
    expect(() => parseMediaPath("r2:")).toThrow("R2 media path is missing an object key");
  });
});

describe("R2 media operations", () => {
  it("uploads WebP with the correct bucket and cache policy", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = createR2MediaStorage(loadR2Config(env), { send, sign: vi.fn() });
    const body = new Uint8Array([1, 2, 3]);

    await storage.upload("avatars", "user/avatar.webp", body, "image/webp");

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toEqual({
      Bucket: "iride-avatars",
      Key: "user/avatar.webp",
      Body: body,
      ContentType: "image/webp",
      CacheControl: mediaCacheControl("avatars"),
    });
  });

  it("deletes with an idempotent S3 operation", async () => {
    const send = vi.fn().mockResolvedValue({});
    const storage = createR2MediaStorage(loadR2Config(env), { send, sign: vi.fn() });

    await expect(storage.remove("post-media", "user/photo.webp")).resolves.toBeUndefined();

    const command = send.mock.calls[0][0];
    expect(command).toBeInstanceOf(DeleteObjectCommand);
    expect(command.input).toEqual({ Bucket: "iride-post-media", Key: "user/photo.webp" });
  });

  it("deduplicates signed GET requests and uses the bucket TTL", async () => {
    const send = vi.fn();
    const sign = vi.fn(async (_command: GetObjectCommand, expiresIn: number) => `https://signed.example/${expiresIn}`);
    const storage = createR2MediaStorage(loadR2Config(env), { send, sign });

    const urls = await storage.signedUrls("post-media", ["one.webp", "one.webp", "two.webp"]);

    expect(sign).toHaveBeenCalledTimes(2);
    expect(sign.mock.calls[0][0]).toBeInstanceOf(GetObjectCommand);
    expect(sign.mock.calls[0][0].input).toEqual({ Bucket: "iride-post-media", Key: "one.webp" });
    expect(sign.mock.calls[0][1]).toBe(mediaTtlSeconds("post-media"));
    expect(urls).toEqual(new Map([
      ["one.webp", "https://signed.example/600"],
      ["two.webp", "https://signed.example/600"],
    ]));
  });

  it("uses seven-day URLs for avatars and vehicles", () => {
    expect(mediaTtlSeconds("avatars")).toBe(604_800);
    expect(mediaTtlSeconds("vehicle-media")).toBe(604_800);
    expect(mediaTtlSeconds("post-media")).toBe(600);
  });
});

describe("transitional media routing", () => {
  it("reads R2 and legacy paths from their matching providers", async () => {
    const r2 = {
      remove: vi.fn(),
      signedUrls: vi.fn(async () => new Map([["new.webp", "https://r2.example/new"]])),
    };
    const legacy = {
      remove: vi.fn(),
      urls: vi.fn(async () => new Map([["old.webp", "https://supabase.example/old"]])),
    };
    const storage = createTransitionalMediaStorage(r2, legacy);

    const urls = await storage.urls("avatars", ["r2:new.webp", "old.webp", "r2:new.webp"]);

    expect(r2.signedUrls).toHaveBeenCalledWith("avatars", ["new.webp"]);
    expect(legacy.urls).toHaveBeenCalledWith("avatars", ["old.webp"]);
    expect(urls).toEqual(new Map([
      ["r2:new.webp", "https://r2.example/new"],
      ["old.webp", "https://supabase.example/old"],
    ]));
  });

  it("deletes from the provider encoded in the stored path", async () => {
    const r2 = { remove: vi.fn(), signedUrls: vi.fn() };
    const legacy = { remove: vi.fn(), urls: vi.fn() };
    const storage = createTransitionalMediaStorage(r2, legacy);

    await storage.remove("vehicle-media", "r2:new.webp");
    await storage.remove("vehicle-media", "old.webp");

    expect(r2.remove).toHaveBeenCalledWith("vehicle-media", "new.webp");
    expect(legacy.remove).toHaveBeenCalledWith("vehicle-media", "old.webp");
  });
});
