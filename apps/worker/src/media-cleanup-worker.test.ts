import { describe, expect, it, vi } from "vitest";

import {
  runMediaCleanupBatch,
  type MediaCleanupWorkerDependencies,
} from "./media-cleanup-worker";

const message = {
  version: 1 as const,
  jobId: "cleanup-1",
  idempotencyKey: "vehicle:v1",
  attempt: 1,
  objectKeys: ["original.webp", "preview.webp"],
};

describe("media cleanup worker", () => {
  it("removes every object and archives a successful cleanup job", async () => {
    const dependencies: MediaCleanupWorkerDependencies = {
      queue: {
        read: vi
          .fn()
          .mockResolvedValue([{ messageId: 3, readCount: 1, message }]),
        archive: vi.fn().mockResolvedValue(undefined),
      },
      remove: vi.fn().mockResolvedValue(undefined),
    };
    await runMediaCleanupBatch(dependencies);
    expect(dependencies.remove).toHaveBeenCalledTimes(2);
    expect(dependencies.remove).toHaveBeenNthCalledWith(1, "original.webp");
    expect(dependencies.remove).toHaveBeenNthCalledWith(2, "preview.webp");
    expect(dependencies.queue.archive).toHaveBeenCalledWith(3);
  });

  it("keeps storage failures retryable even after the normal attempt limit", async () => {
    const queue = {
      read: vi
        .fn()
        .mockResolvedValue([{ messageId: 4, readCount: 2, message }]),
      archive: vi.fn().mockResolvedValue(undefined),
    };
    const dependencies: MediaCleanupWorkerDependencies = {
      queue,
      remove: vi.fn().mockRejectedValue(new Error("R2 unavailable")),
    };
    await runMediaCleanupBatch(dependencies);
    expect(queue.archive).not.toHaveBeenCalled();
    queue.read.mockResolvedValue([{ messageId: 4, readCount: 5, message }]);
    await runMediaCleanupBatch(dependencies);
    expect(queue.archive).not.toHaveBeenCalled();
  });
});
