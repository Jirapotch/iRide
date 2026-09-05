import type { WorkerEnv } from "@iride/config/worker";
import { QUEUE_NAMES, QUEUE_POLICIES, type Json } from "@iride/database";
import { createAdminDatabaseClient } from "@iride/database/admin";
import { createR2Storage } from "@iride/storage";

import { createPgmqRepository, type PgmqRepository } from "../queues/pgmq.repository";
import type { JobBatchResult } from "./job-result";
import { processMediaJob, type MediaProcessingJob } from "./media-processor";

export interface MediaProcessingJobDependencies {
  readonly queue: PgmqRepository;
  readonly process: (message: MediaProcessingJob) => Promise<void>;
}

export async function runMediaProcessingBatch(
  dependencies: MediaProcessingJobDependencies,
  options: { readonly batchSize: number; readonly shouldContinue: () => boolean },
): Promise<JobBatchResult> {
  const jobs = await dependencies.queue.read(
    QUEUE_NAMES.MEDIA_PROCESSING,
    QUEUE_POLICIES.MEDIA_PROCESSING.visibilityTimeoutSeconds,
    options.batchSize,
  );
  let processed = 0;
  let failed = 0;
  let archived = 0;

  for (const job of jobs) {
    if (!options.shouldContinue()) break;
    processed += 1;
    const message = parseMediaProcessingMessage(job.message);
    if (!message) {
      failed += 1;
      await dependencies.queue.archive(QUEUE_NAMES.MEDIA_PROCESSING, job.messageId);
      archived += 1;
      continue;
    }
    try {
      await dependencies.process(message);
      await dependencies.queue.archive(QUEUE_NAMES.MEDIA_PROCESSING, job.messageId);
      archived += 1;
    } catch {
      failed += 1;
      if (job.readCount >= QUEUE_POLICIES.MEDIA_PROCESSING.maxAttempts) {
        await dependencies.queue.archive(QUEUE_NAMES.MEDIA_PROCESSING, job.messageId);
        archived += 1;
      }
    }
  }
  return { processed, failed, archived };
}

export function createMediaProcessingJobDependencies(
  env: WorkerEnv,
): MediaProcessingJobDependencies {
  const queue = createPgmqRepository({
    supabaseUrl: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const admin = createAdminDatabaseClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  const storage = createR2Storage({
    accountId: env.CLOUDFLARE_ACCOUNT_ID,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    bucket: env.R2_BUCKET,
  });

  return {
    queue,
    process: async (message) => {
      await admin
        .from("media")
        .update({ status: "processing", failure_reason: null })
        .eq("id", message.mediaId)
        .eq("owner_id", message.ownerId)
        .in("status", ["processing", "failed"]);
      await processMediaJob(message, {
        storage,
        repository: {
          async markReady(mediaId, value) {
            const { error } = await admin.rpc("finish_media_processing", {
              target_media_id: mediaId,
              source_width: value.width,
              source_height: value.height,
              variants: value.variants.map((item) => ({
                kind: item.kind,
                object_key: item.objectKey,
                bytes: item.bytes,
                width: item.width,
                height: item.height,
              })) as unknown as Json,
            });
            if (error) throw error;
          },
          async markFailed(mediaId, reason) {
            const { error } = await admin
              .from("media")
              .update({ status: "failed", failure_reason: reason })
              .eq("id", mediaId)
              .eq("status", "processing");
            if (error) throw error;
          },
        },
      });
    },
  };
}

export function parseMediaProcessingMessage(value: Json): MediaProcessingJob | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
  const item = value as Record<string, Json | undefined>;
  const purposes = ["avatar", "cover", "vehicle"] as const;
  if (
    item.version !== 1 ||
    typeof item.jobId !== "string" ||
    typeof item.idempotencyKey !== "string" ||
    typeof item.attempt !== "number" ||
    typeof item.mediaId !== "string" ||
    typeof item.ownerId !== "string" ||
    typeof item.objectKey !== "string" ||
    !purposes.includes(item.purpose as never)
  ) {
    return null;
  }
  return {
    version: 1,
    jobId: item.jobId,
    idempotencyKey: item.idempotencyKey,
    attempt: item.attempt,
    mediaId: item.mediaId,
    ownerId: item.ownerId,
    purpose: item.purpose as MediaProcessingJob["purpose"],
    objectKey: item.objectKey,
  };
}
