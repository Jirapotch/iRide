import { createClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import {
  createMediaUploadAttempt,
  prepareMediaImage,
  uploadAuthorizedMedia,
} from "./media-upload";

const authorization = {
  mediaId: "m1",
  bucketId: "media",
  objectPath: "users/u1/avatar/m1/original",
  uploadToken: "signed-upload-token",
  expiresAt: "2033-05-18T03:33:20.000Z",
};
afterEach(() => vi.unstubAllGlobals());

it("uploads the authorized blob through the Supabase token endpoint", async () => {
  let uploaded: Blob | undefined;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: unknown, init: RequestInit) => {
      expect(String(url)).toBe(
        "https://storage.test/storage/v1/object/upload/sign/media/users/u1/avatar/m1/original?token=signed-upload-token",
      );
      expect(init.method).toBe("PUT");
      uploaded = (init.body as FormData).get("") as Blob;
      return Response.json({ Key: "media/users/u1/avatar/m1/original" });
    }),
  );
  const client = createClient("https://storage.test", "publishable", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await uploadAuthorizedMedia(
    authorization,
    new Blob(["image-bytes"], { type: "image/webp" }),
    client,
  );
  expect(await uploaded?.text()).toBe("image-bytes");
  expect(uploaded?.type).toBe("image/webp");
});

it.each(["2020-01-01T00:00:00.000Z", "invalid-date"])(
  "rejects stale authorization before sending bytes: %s",
  async (expiresAt) => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const client = createClient("https://storage.test", "publishable", {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await expect(
      uploadAuthorizedMedia(
        { ...authorization, expiresAt },
        new Blob(["bytes"]),
        client,
      ),
    ).rejects.toThrow("MEDIA_UPLOAD_EXPIRED");
    expect(fetch).not.toHaveBeenCalled();
  },
);

it("surfaces a rejected signed upload so completion cannot proceed", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      Response.json(
        {
          statusCode: "403",
          message: "Expired signature",
          error: "Unauthorized",
        },
        { status: 403 },
      ),
    ),
  );
  const client = createClient("https://storage.test", "publishable", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await expect(
    uploadAuthorizedMedia(authorization, new Blob(["bytes"]), client),
  ).rejects.toThrow("MEDIA_UPLOAD_FAILED");
});

it("binds private document image uploads to the vehicle and reuses processed media on attachment retry", async () => {
  const authorize = vi.fn().mockResolvedValue(authorization);
  const upload = vi.fn().mockResolvedValue(undefined);
  const complete = vi
    .fn()
    .mockResolvedValue({ mediaId: "m1", status: "ready" });
  const attempt = createMediaUploadAttempt(
    new Blob(["processed"], { type: "image/webp" }),
    "vehicle_document",
    { authorize, upload, complete, reauthorize: vi.fn(), wait: vi.fn() },
    { vehicleId: "vehicle-1" },
  );
  expect(await attempt.run(() => undefined)).toBe("m1");
  expect(authorize).toHaveBeenCalledWith(
    expect.objectContaining({
      purpose: "vehicle_document",
      vehicleId: "vehicle-1",
      mimeType: "image/webp",
    }),
  );
  expect(await attempt.run(() => undefined)).toBe("m1");
  expect(authorize).toHaveBeenCalledTimes(1);
  expect(upload).toHaveBeenCalledTimes(1);
});

it("prepares portrait document images as aspect-preserving WebP with bounded longest side", async () => {
  const drawImage = vi.fn();
  const close = vi.fn();
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({ drawImage }),
    toBlob: (callback: (blob: Blob) => void) =>
      callback(new Blob(["webp"], { type: "image/webp" })),
  };
  vi.stubGlobal("document", { createElement: () => canvas });
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn().mockResolvedValue({ width: 1200, height: 3600, close }),
  );
  expect(
    (
      await prepareMediaImage(
        new File(["image"], "receipt.jpg", { type: "image/jpeg" }),
        { purpose: "vehicle_document" },
      )
    ).type,
  ).toBe("image/webp");
  expect(canvas.width).toBe(683);
  expect(canvas.height).toBe(2048);
  expect(drawImage).toHaveBeenCalledWith(
    expect.anything(),
    0,
    0,
    1200,
    3600,
    0,
    0,
    683,
    2048,
  );
  expect(close).toHaveBeenCalledOnce();
});
