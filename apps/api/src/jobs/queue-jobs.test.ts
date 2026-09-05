import { QUEUE_NAMES } from "@iride/database";
import { describe, expect, it, vi } from "vitest";

import { runMediaCleanupBatch, type MediaCleanupJobDependencies } from "./media-cleanup.job";
import { runMediaProcessingBatch, type MediaProcessingJobDependencies } from "./media-processing.job";

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
  it("processes and archives a media job with the queue policy bounds", async () => {
    const queue = {
      read: vi.fn().mockResolvedValue([{ messageId: 1, readCount: 1, message: processingMessage }]),
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

    expect(queue.read).toHaveBeenCalledWith(QUEUE_NAMES.MEDIA_PROCESSING, expect.any(Number), 2);
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
      read: vi.fn().mockResolvedValue([{ messageId: 4, readCount: 5, message: cleanupMessage }]),
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
      read: vi.fn().mockResolvedValue([{ messageId: 1, readCount: 1, message: processingMessage }]),
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
