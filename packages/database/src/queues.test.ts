import { describe, expect, it } from "vitest";

import { QUEUE_NAMES, QUEUE_POLICIES } from "./queues";

describe("queue contracts", () => {
  it("pins the durable media queue and worker safety bounds", () => {
    expect(QUEUE_NAMES.MEDIA_PROCESSING).toBe("media_processing");
    expect(QUEUE_NAMES.MEDIA_CLEANUP).toBe("media_cleanup");
    expect(QUEUE_POLICIES.MEDIA_PROCESSING).toEqual({
      archiveTerminalMessages: true,
      maxAttempts: 5,
      maxBatchSize: 10,
      visibilityTimeoutSeconds: 300,
    });
    expect(QUEUE_POLICIES.MEDIA_CLEANUP).toEqual({
      archiveTerminalMessages: true,
      maxAttempts: 5,
      maxBatchSize: 10,
      visibilityTimeoutSeconds: 300,
    });
  });
});
