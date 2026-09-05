import type { WorkerEnv } from "@iride/config/worker";
import { QUEUE_NAMES, QUEUE_POLICIES, type Json } from "@iride/database";
import { createR2Storage } from "@iride/storage";

import { createPgmqRepository, type PgmqRepository } from "../queues/pgmq.repository";
import type { JobBatchResult } from "./job-result";

export interface MediaCleanupJob {
  readonly version: 1;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly objectKeys: readonly string[];
}

export interface MediaCleanupJobDependencies {
  readonly queue: PgmqRepository;
  readonly remove: (key: string) => Promise<void>;
}

export async function runMediaCleanupBatch(
  dependencies: MediaCleanupJobDependencies,
  options: { readonly batchSize: number; readonly shouldContinue: () => boolean },
): Promise<JobBatchResult> {
  const jobs = await dependencies.queue.read(
    QUEUE_NAMES.MEDIA_CLEANUP,
    QUEUE_POLICIES.MEDIA_CLEANUP.visibilityTimeoutSeconds,
    options.batchSize,
  );
  let processed = 0;
  let failed = 0;
  let archived = 0;

  for (const job of jobs) {
    if (!options.shouldContinue()) break;
    processed += 1;
    const message = parseMediaCleanupMessage(job.message);
    if (!message) {
      failed += 1;
      await dependencies.queue.archive(QUEUE_NAMES.MEDIA_CLEANUP, job.messageId);
      archived += 1;
      continue;
    }
    try {
      for (const key of message.objectKeys) await dependencies.remove(key);
      await dependencies.queue.archive(QUEUE_NAMES.MEDIA_CLEANUP, job.messageId);
      archived += 1;
    } catch {
      failed += 1;
      // Cleanup remains retryable at every read count to avoid orphaning R2 objects.
    }
  }
  return { processed, failed, archived };
}

export function createMediaCleanupJobDependencies(
  env: WorkerEnv,
): MediaCleanupJobDependencies {
  const storage = createR2Storage({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  });
  return {
    queue: createPgmqRepository({
      supabaseUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    }),
    remove: (key) => storage.remove(key),
  };
}

export function parseMediaCleanupMessage(value: Json): MediaCleanupJob | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, Json | undefined>;
  if (
    item.version !== 1 ||
    typeof item.jobId !== "string" ||
    typeof item.idempotencyKey !== "string" ||
    typeof item.attempt !== "number" ||
    !Array.isArray(item.objectKeys) ||
    item.objectKeys.some((key) => typeof key !== "string")
  ) {
    return null;
  }
  return {
    version: 1,
    jobId: item.jobId,
    idempotencyKey: item.idempotencyKey,
    attempt: item.attempt,
    objectKeys: item.objectKeys as string[],
  };
}
