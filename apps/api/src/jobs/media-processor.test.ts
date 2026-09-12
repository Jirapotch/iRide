import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";

import {
  processMediaJob,
  type MediaProcessingDependencies,
  type MediaProcessingJob,
} from "./media-processor";

const job: MediaProcessingJob = {
  version: 1,
  jobId: "job-1",
  idempotencyKey: "media:m1:process",
  attempt: 0,
  mediaId: "m1",
  ownerId: "u1",
  purpose: "avatar",
  objectKey: "users/u1/avatar/m1/original",
};

describe("migrated media processor", () => {
  it.each(["gif", "pixels"])(
    "rejects %s outside the source policy before persisting variants",
    async (kind) => {
      const input =
        kind === "gif"
          ? await sharp({
              create: { width: 5, height: 5, channels: 3, background: "blue" },
            })
              .gif()
              .toBuffer()
          : await sharp({
              create: {
                width: 6400,
                height: 6400,
                channels: 3,
                background: "blue",
              },
            })
              .png()
              .toBuffer();
      const put = vi.fn();
      await expect(
        processMediaJob(job, {
          storage: { get: async () => input, put },
          repository: { markReady: vi.fn(), markFailed: vi.fn() },
        }),
      ).rejects.toThrow("MEDIA_DECODE_FAILED");
      expect(put).not.toHaveBeenCalled();
    },
  );

  it("does not mark ready after a partial variant write failure and can retry the same keys", async () => {
    const input = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "blue" },
    })
      .png()
      .toBuffer();
    const saved = new Map<string, Uint8Array>();
    let fail = true;
    const markReady = vi.fn();
    const deps = {
      storage: {
        get: async () => input,
        put: async (key: string, bytes: Uint8Array) => {
          if (fail && key.endsWith("preview.webp"))
            throw new Error("store offline");
          saved.set(key, bytes);
        },
      },
      repository: { markReady, markFailed: vi.fn() },
    };
    await expect(processMediaJob(job, deps)).rejects.toThrow(
      "MEDIA_PROCESSING_FAILED",
    );
    expect(markReady).not.toHaveBeenCalled();
    fail = false;
    await processMediaJob(job, deps);
    expect(saved.size).toBe(2);
    expect(markReady).toHaveBeenCalledOnce();
  });
  it.each([
    {
      purpose: "avatar" as const,
      sizes: [
        [256, 256],
        [512, 512],
      ],
    },
    {
      purpose: "cover" as const,
      sizes: [
        [600, 200],
        [1600, 534],
      ],
    },
    {
      purpose: "vehicle" as const,
      sizes: [
        [480, 320],
        [1280, 640],
      ],
    },
  ])(
    "encodes $purpose variants as WebP quality 80 with bounded dimensions",
    async ({ purpose, sizes }) => {
      const input = await sharp({
        create: {
          width: 2400,
          height: 1200,
          channels: 3,
          background: "#128c44",
        },
      })
        .png()
        .toBuffer();
      const outputs: Uint8Array[] = [];
      const markReady = vi.fn();
      await processMediaJob(
        { ...job, purpose },
        {
          storage: {
            get: async () => input,
            put: async (_key, data, mime) => {
              expect(mime).toBe("image/webp");
              outputs.push(data);
            },
          },
          repository: { markReady, markFailed: vi.fn() },
        },
      );
      for (const [index, bytes] of outputs.entries()) {
        expect(await sharp(bytes).metadata()).toMatchObject({
          format: "webp",
          width: sizes[index]![0],
          height: sizes[index]![1],
        });
        const expected = await sharp(input)
          .rotate()
          .resize(sizes[index]![0], sizes[index]![1])
          .webp({ quality: 80 })
          .toBuffer();
        expect(Buffer.from(bytes)).toEqual(expected);
      }
      expect(markReady).toHaveBeenCalledOnce();
    },
  );

  it("rejects an oversized source even when the image decoder accepts trailing bytes", async () => {
    const image = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "red" },
    })
      .png()
      .toBuffer();
    const input = Buffer.concat([image, Buffer.alloc(10 * 1024 * 1024)]);
    const put = vi.fn();
    await expect(
      processMediaJob(job, {
        storage: { get: async () => input, put },
        repository: { markReady: vi.fn(), markFailed: vi.fn() },
      }),
    ).rejects.toThrow("MEDIA_UPLOAD_INVALID");
    expect(put).not.toHaveBeenCalled();
  });
  it.each(["r2", "supabase"] as const)(
    "keeps processing source and variants in %s",
    async (storageProvider) => {
      const original = await sharp({
        create: { width: 20, height: 20, channels: 3, background: "#168cff" },
      })
        .png()
        .toBuffer();
      const output = new Map<string, Uint8Array>();
      await processMediaJob(
        { ...job, storageProvider },
        {
          storage: {
            get: async (_key, provider) => {
              if (provider !== storageProvider)
                throw new Error("wrong source provider");
              return original;
            },
            put: async (key, bytes, _mime, provider) => {
              if (provider !== storageProvider)
                throw new Error("wrong variant provider");
              output.set(key, bytes);
            },
          },
          repository: { markReady: async () => {}, markFailed: async () => {} },
        },
      );
      expect([...output.keys()]).toEqual([
        "users/u1/avatar/m1/thumbnail.webp",
        "users/u1/avatar/m1/preview.webp",
      ]);
      expect(
        (await sharp(output.get("users/u1/avatar/m1/preview.webp")).metadata())
          .format,
      ).toBe("webp");
    },
  );
  it("writes deterministic WebP variants", async () => {
    const original = await sharp({
      create: { width: 800, height: 600, channels: 3, background: "#168cff" },
    })
      .jpeg()
      .toBuffer();
    const dependencies: MediaProcessingDependencies = {
      storage: {
        get: vi.fn().mockResolvedValue(original),
        put: vi.fn().mockResolvedValue(undefined),
      },
      repository: {
        markReady: vi.fn().mockResolvedValue(undefined),
        markFailed: vi.fn(),
      },
    };

    await processMediaJob(job, dependencies);

    expect(dependencies.storage.put).toHaveBeenCalledTimes(2);
    expect(dependencies.repository.markReady).toHaveBeenCalledWith(
      "m1",
      expect.objectContaining({ width: 800, height: 600 }),
    );
  });

  it("records a stable failure code for corrupt input", async () => {
    const dependencies: MediaProcessingDependencies = {
      storage: {
        get: vi.fn().mockResolvedValue(Buffer.from("not-an-image")),
        put: vi.fn(),
      },
      repository: {
        markReady: vi.fn(),
        markFailed: vi.fn().mockResolvedValue(undefined),
      },
    };

    await expect(processMediaJob(job, dependencies)).rejects.toThrow(
      "MEDIA_DECODE_FAILED",
    );
    expect(dependencies.repository.markFailed).toHaveBeenCalledWith(
      "m1",
      "MEDIA_DECODE_FAILED",
    );
  });
});
