import { createClient } from "@supabase/supabase-js";
import { afterEach, expect, it, vi } from "vitest";
import { uploadAuthorizedMedia } from "./media-upload";

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
