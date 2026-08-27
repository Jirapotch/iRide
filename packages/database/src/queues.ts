import type { Json } from "./types";

export const QUEUE_NAMES = {
  MEDIA_PROCESSING: "media_processing",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface QueuePolicy {
  readonly archiveTerminalMessages: true;
  readonly maxAttempts: number;
  readonly maxBatchSize: number;
  readonly visibilityTimeoutSeconds: number;
}

export const QUEUE_POLICIES = {
  MEDIA_PROCESSING: {
    archiveTerminalMessages: true,
    maxAttempts: 5,
    maxBatchSize: 10,
    visibilityTimeoutSeconds: 300,
  },
} as const satisfies Record<keyof typeof QUEUE_NAMES, QueuePolicy>;

export interface JobEnvelope<TPayload extends Json = Json> {
  readonly version: number;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly payload: TPayload;
}
