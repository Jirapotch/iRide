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
