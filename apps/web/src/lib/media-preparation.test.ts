import { afterEach, describe, expect, it, vi } from "vitest";
import { prepareMediaImage, createMediaUploadAttempt } from "./media-upload";

afterEach(() => vi.unstubAllGlobals());

describe("browser media preparation", () => {
  it.each([
    ["avatar", 4000, 3000, 1024, 1024, 1],
    ["cover", 4000, 3000, 1800, 600, 3],
    ["vehicle", 3000, 4000, 1536, 2048, undefined],
    ["vehicle", 400, 200, 400, 200, undefined],
  ] as const)(
    "prepares %s %sx%s without keeping a full-size original",
    async (purpose, width, height, outWidth, outHeight, cropRatio) => {
      const close = vi.fn();
      const decode = vi.fn().mockResolvedValue({ width, height, close });
      const drawImage = vi.fn();
      const canvas = {
        width: 0,
        height: 0,
        getContext: () => ({ drawImage }),
        toBlob: (cb: (b: Blob) => void, mime: string, quality: number) => {
          expect(quality).toBe(0.82);
          cb(new Blob(["compressed"], { type: mime }));
        },
      };
      vi.stubGlobal("createImageBitmap", decode);
      vi.stubGlobal("document", { createElement: () => canvas });
      const file = new File(["image"], "photo.jpg", { type: "image/jpeg" });
      const result = await prepareMediaImage(file, {
        purpose,
        cropRatio,
        x: 100,
        y: 0,
      });
      expect(result.type).toBe("image/webp");
      expect(canvas).toMatchObject({ width: outWidth, height: outHeight });
      expect(decode).toHaveBeenCalledWith(file, {
        imageOrientation: "from-image",
      });
      expect(close).toHaveBeenCalledOnce();
      expect(drawImage.mock.calls[0]?.slice(-4)).toEqual([
        0,
        0,
        outWidth,
        outHeight,
      ]);
    },
  );

  it("rejects a browser that silently falls back to PNG and releases its bitmap", async () => {
    const close = vi.fn();
    vi.stubGlobal("createImageBitmap", async () => ({
      width: 20,
      height: 20,
      close,
    }));
    vi.stubGlobal("document", {
      createElement: () => ({
        getContext: () => ({ drawImage() {} }),
        toBlob: (cb: (blob: Blob) => void) =>
          cb(new Blob(["png"], { type: "image/png" })),
      }),
    });
    await expect(
      prepareMediaImage(new File(["img"], "x.png", { type: "image/png" }), {
        purpose: "vehicle",
      }),
    ).rejects.toThrow("MEDIA_WEBP_UNSUPPORTED");
    expect(close).toHaveBeenCalledOnce();
  });
});

describe("resumable upload", () => {
  it("reuses its request identity when the initial authorization response is lost", async () => {
    const identities: unknown[] = [];
    let first = true;
    const attempt = createMediaUploadAttempt(
      new Blob(["image"], { type: "image/webp" }),
      "avatar",
      {
        authorize: async (input) => {
          identities.push(input.uploadId);
          if (first) {
            first = false;
            throw new Error("response lost");
          }
          return {
            mediaId: input.uploadId!,
            bucketId: "media",
            objectPath: "same",
            uploadToken: "token",
            expiresAt: "2099-01-01",
          };
        },
        reauthorize: async () => {
          throw new Error("not used");
        },
        upload: async () => {},
        complete: async (id) => ({ mediaId: id, status: "ready" }),
        wait: async () => {},
      },
    );
    await expect(attempt.run(() => {})).rejects.toThrow("response lost");
    const id = await attempt.run(() => {});
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(identities).toEqual([id, id]);
  });
  it("renews an expired upload on retry without creating a second media row", async () => {
    let rows = 0,
      puts = 0,
      renewals = 0;
    const phases: string[] = [];
    const authorization = {
      mediaId: "m1",
      bucketId: "media",
      objectPath: "same-source",
      uploadToken: "old",
      expiresAt: "2020-01-01T00:00:00.000Z",
    };
    const attempt = createMediaUploadAttempt(
      new Blob(["webp"], { type: "image/webp" }),
      "avatar",
      {
        authorize: async () => {
          rows++;
          return authorization;
        },
        reauthorize: async (id) => {
          expect(id).toBe("m1");
          renewals++;
          return {
            ...authorization,
            uploadToken: "renewed",
            expiresAt: "2099-01-01T00:00:00.000Z",
          };
        },
        upload: async (auth) => {
          puts++;
          if (auth.uploadToken === "old") throw new Error("expired");
        },
        complete: async () => {
          if (puts < 2) throw new Error("missing source");
          return { mediaId: "m1", status: "ready" };
        },
        wait: async () => {},
      },
    );
    await expect(attempt.run((phase) => phases.push(phase))).rejects.toThrow(
      "expired",
    );
    expect(await attempt.run((phase) => phases.push(phase))).toBe("m1");
    expect({ rows, puts, renewals }).toEqual({ rows: 1, puts: 2, renewals: 1 });
    expect(phases).toEqual([
      "uploading",
      "processing",
      "uploading",
      "processing",
    ]);
  });

  it("recovers a lost upload response by checking completion before uploading again", async () => {
    let uploaded = false,
      puts = 0;
    const attempt = createMediaUploadAttempt(new Blob(["x"]), "vehicle", {
      authorize: async () => ({
        mediaId: "m2",
        bucketId: "media",
        objectPath: "o",
        uploadToken: "t",
        expiresAt: "2099-01-01",
      }),
      reauthorize: async () => {
        throw new Error("must not renew ready media");
      },
      upload: async () => {
        puts++;
        uploaded = true;
        throw new Error("response lost");
      },
      complete: async () => ({
        mediaId: "m2",
        status: uploaded ? "ready" : "uploading",
      }),
      wait: async () => {},
    });
    await expect(attempt.run(() => {})).rejects.toThrow("response lost");
    expect(await attempt.run(() => {})).toBe("m2");
    expect(puts).toBe(1);
  });
});
