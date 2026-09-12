import { QUEUE_NAMES } from "@iride/database";
import { describe, expect, it, vi } from "vitest";

import {
  parseMediaCleanupMessage,
  runMediaCleanupBatch,
  type MediaCleanupJobDependencies,
} from "./media-cleanup.job";
import {
  parseMediaProcessingMessage,
  runMediaProcessingBatch,
  type MediaProcessingJobDependencies,
} from "./media-processing.job";

const processingMessage = {
  version: 1 as const,
  jobId: "job-1",
  idempotencyKey: "media:m1:process",
  attempt: 0,
  mediaId: "m1",
  ownerId: "u1",
  purpose: "avatar",
  objectKey: "users/u1/avatar/m1/original",
};

describe("migrated pgmq jobs", () => {
  it("keeps source metadata on delete failure and clears it only after a successful retry", async () => {
    const events: string[] = [];
    let failDelete = true;
    const message = {
      version: 1,
      jobId: "source-1",
      idempotencyKey: "source:m1",
      attempt: 0,
      objects: [
        {
          objectKey: "source.webp",
          storageProvider: "supabase",
          sourceMediaId: "20000000-0000-4000-8000-000000000001",
        },
      ],
    };
    const deps = {
      queue: {
        read: async () => [{ messageId: 1, readCount: 10, message }],
        archive: async () => {
          events.push("archive");
        },
      },
      remove: async () => {
        events.push("delete");
        if (failDelete) throw new Error("offline");
      },
      clearSource: async (mediaId: string, key: string, provider: string) => {
        events.push(`clear:${mediaId}:${key}:${provider}`);
      },
    };
    expect(
      await runMediaCleanupBatch(deps, {
        batchSize: 1,
        shouldContinue: () => true,
      }),
    ).toEqual({ processed: 1, failed: 1, archived: 0 });
    expect(events).toEqual(["delete"]);
    failDelete = false;
    await runMediaCleanupBatch(deps, {
      batchSize: 1,
      shouldContinue: () => true,
    });
    expect(events).toEqual([
      "delete",
      "delete",
      "clear:20000000-0000-4000-8000-000000000001:source.webp:supabase",
      "archive",
    ]);
  });

  it("retries source metadata persistence failures without archiving", async () => {
    const archive = vi.fn();
    const deps = {
      queue: {
        read: async () => [
          {
            messageId: 1,
            readCount: 2,
            message: {
              version: 1,
              jobId: "j",
              idempotencyKey: "s",
              attempt: 0,
              objects: [
                {
                  objectKey: "original",
                  storageProvider: "supabase",
                  sourceMediaId: "20000000-0000-4000-8000-000000000001",
                },
              ],
            },
          },
        ],
        archive,
      },
      remove: async () => {},
      clearSource: async () => {
        throw new Error("db down");
      },
    };
    expect(
      await runMediaCleanupBatch(deps, {
        batchSize: 1,
        shouldContinue: () => true,
      }),
    ).toEqual({ processed: 1, failed: 1, archived: 0 });
    expect(archive).not.toHaveBeenCalled();
  });
  it("defaults legacy processing payloads to R2 and preserves explicit Supabase routing", () => {
    expect(parseMediaProcessingMessage(processingMessage)).toMatchObject({
      storageProvider: "r2",
    });
    expect(
      parseMediaProcessingMessage({
        ...processingMessage,
        storageProvider: "supabase",
      }),
    ).toMatchObject({ storageProvider: "supabase" });
    expect(
      parseMediaProcessingMessage({
        ...processingMessage,
        storageProvider: "unknown",
      }),
    ).toBeNull();
  });

  it("deletes mixed providers and legacy R2 payloads without guessing object ownership", async () => {
    const envelope = {
      version: 1,
      jobId: "j1",
      idempotencyKey: "delete:1",
      attempt: 0,
    };
    const r2 = new Set(["old.webp", "legacy.webp"]),
      supabase = new Set(["new.webp"]);
    const queue = {
      read: vi.fn().mockResolvedValue([
        {
          messageId: 1,
          readCount: 1,
          message: {
            ...envelope,
            objects: [
              { objectKey: "old.webp", storageProvider: "r2" },
              { objectKey: "new.webp", storageProvider: "supabase" },
            ],
          },
        },
        {
          messageId: 2,
          readCount: 1,
          message: { ...envelope, objectKeys: ["legacy.webp"] },
        },
      ]),
      archive: vi.fn().mockResolvedValue(undefined),
    };
    const result = await runMediaCleanupBatch(
      {
        queue,
        remove: async (key, provider) => {
          const target = provider === "supabase" ? supabase : r2;
          if (!target.delete(key)) throw new Error("wrong provider");
        },
      },
      { batchSize: 2, shouldContinue: () => true },
    );
    expect(result).toEqual({ processed: 2, failed: 0, archived: 2 });
    expect([...r2, ...supabase]).toEqual([]);
    expect(
      parseMediaCleanupMessage({
        ...envelope,
        objects: [{ objectKey: "new.webp", storageProvider: "unknown" }],
      }),
    ).toBeNull();
  });
  it("processes and archives a media job with the queue policy bounds", async () => {
    const queue = {
      read: vi
        .fn()
        .mockResolvedValue([
          { messageId: 1, readCount: 1, message: processingMessage },
        ]),
      archive: vi.fn().mockResolvedValue(undefined),
    };
    const dependencies: MediaProcessingJobDependencies = {
      queue,
      process: vi.fn().mockResolvedValue(undefined),
    };

    const result = await runMediaProcessingBatch(dependencies, {
      batchSize: 2,
      shouldContinue: () => true,
    });

    expect(queue.read).toHaveBeenCalledWith(
      QUEUE_NAMES.MEDIA_PROCESSING,
      expect.any(Number),
      2,
    );
    expect(queue.archive).toHaveBeenCalledWith(QUEUE_NAMES.MEDIA_PROCESSING, 1);
    expect(result).toEqual({ processed: 1, failed: 0, archived: 1 });
  });

  it("archives malformed media messages and terminal failures", async () => {
    const queue = {
      read: vi.fn().mockResolvedValue([
        { messageId: 2, readCount: 1, message: null },
        { messageId: 3, readCount: 5, message: processingMessage },
      ]),
      archive: vi.fn().mockResolvedValue(undefined),
    };
    const result = await runMediaProcessingBatch(
      { queue, process: vi.fn().mockRejectedValue(new Error("failed")) },
      { batchSize: 2, shouldContinue: () => true },
    );

    expect(queue.archive).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ processed: 2, failed: 2, archived: 2 });
  });

  it("keeps storage cleanup failures retryable", async () => {
    const cleanupMessage = {
      version: 1 as const,
      jobId: "cleanup-1",
      idempotencyKey: "vehicle:v1",
      attempt: 1,
      objectKeys: ["original.webp"],
    };
    const queue = {
      read: vi
        .fn()
        .mockResolvedValue([
          { messageId: 4, readCount: 5, message: cleanupMessage },
        ]),
      archive: vi.fn().mockResolvedValue(undefined),
    };
    const dependencies: MediaCleanupJobDependencies = {
      queue,
      remove: vi.fn().mockRejectedValue(new Error("R2 unavailable")),
    };

    const result = await runMediaCleanupBatch(dependencies, {
      batchSize: 2,
      shouldContinue: () => true,
    });

    expect(queue.archive).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 1, failed: 1, archived: 0 });
  });

  it("does not start another job after the serverless deadline", async () => {
    const queue = {
      read: vi
        .fn()
        .mockResolvedValue([
          { messageId: 1, readCount: 1, message: processingMessage },
        ]),
      archive: vi.fn(),
    };
    const process = vi.fn();

    const result = await runMediaProcessingBatch(
      { queue, process },
      { batchSize: 2, shouldContinue: () => false },
    );

    expect(process).not.toHaveBeenCalled();
    expect(result).toEqual({ processed: 0, failed: 0, archived: 0 });
  });
});
