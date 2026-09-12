import type { WorkerEnv } from "@iride/config/worker";
import { QUEUE_NAMES, QUEUE_POLICIES, type Json } from "@iride/database";
import { createMediaStorage, type StorageProvider } from "@iride/storage";
import { createAdminDatabaseClient } from "@iride/database/admin";

import {
  createPgmqRepository,
  type PgmqRepository,
} from "../queues/pgmq.repository";
import type { JobBatchResult } from "./job-result";

export interface MediaCleanupJob {
  readonly version: 1;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly objects: readonly {
    objectKey: string;
    storageProvider: StorageProvider;
    sourceMediaId?: string;
  }[];
}

export interface MediaCleanupJobDependencies {
  readonly queue: PgmqRepository;
  readonly remove: (key: string, provider: StorageProvider) => Promise<void>;
  readonly clearSource?: (
    mediaId: string,
    key: string,
    provider: StorageProvider,
  ) => Promise<void>;
}

export async function runMediaCleanupBatch(
  dependencies: MediaCleanupJobDependencies,
  options: {
    readonly batchSize: number;
    readonly shouldContinue: () => boolean;
  },
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
      await dependencies.queue.archive(
        QUEUE_NAMES.MEDIA_CLEANUP,
        job.messageId,
      );
      archived += 1;
      continue;
    }
    try {
      for (const object of message.objects) {
        await dependencies.remove(object.objectKey, object.storageProvider);
        if (object.sourceMediaId) {
          if (!dependencies.clearSource)
            throw new Error("MEDIA_SOURCE_CLEANUP_UNAVAILABLE");
          await dependencies.clearSource(
            object.sourceMediaId,
            object.objectKey,
            object.storageProvider,
          );
        }
      }
      await dependencies.queue.archive(
        QUEUE_NAMES.MEDIA_CLEANUP,
        job.messageId,
      );
      archived += 1;
    } catch {
      failed += 1;
      // Cleanup remains retryable at every read count to avoid orphaning objects.
    }
  }
  return { processed, failed, archived };
}

export function createMediaCleanupJobDependencies(
  env: WorkerEnv,
): MediaCleanupJobDependencies {
  const storage = createMediaStorage({
    r2: {
      accountId: env.CLOUDFLARE_ACCOUNT_ID,
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      bucket: env.R2_BUCKET,
    },
    supabase: {
      url: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    },
  });
  const admin = createAdminDatabaseClient({
    url: env.SUPABASE_URL,
    serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  });
  return {
    queue: createPgmqRepository({
      supabaseUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
    }),
    remove: (key, provider) => storage.remove(key, provider),
    async clearSource(mediaId, key, provider) {
      const { error } = await admin
        .from("media")
        .update({
          original_object_key: null,
          original_cleaned_at: new Date().toISOString(),
        })
        .eq("id", mediaId)
        .eq("original_object_key", key)
        .eq("storage_provider", provider)
        .eq("status", "ready");
      if (error) throw error;
    },
  };
}

export function parseMediaCleanupMessage(value: Json): MediaCleanupJob | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const item = value as Record<string, Json | undefined>;
  if (
    item.version !== 1 ||
    typeof item.jobId !== "string" ||
    typeof item.idempotencyKey !== "string" ||
    typeof item.attempt !== "number"
  ) {
    return null;
  }
  let objects: MediaCleanupJob["objects"];
  if (item.objects !== undefined) {
    if (!Array.isArray(item.objects)) return null;
    const parsed: {
      objectKey: string;
      storageProvider: StorageProvider;
      sourceMediaId?: string;
    }[] = [];
    for (const value of item.objects) {
      if (
        typeof value !== "object" ||
        value === null ||
        Array.isArray(value) ||
        typeof value.objectKey !== "string" ||
        (value.storageProvider !== "r2" &&
          value.storageProvider !== "supabase") ||
        (value.sourceMediaId !== undefined &&
          (typeof value.sourceMediaId !== "string" ||
            !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
              value.sourceMediaId,
            )))
      )
        return null;
      parsed.push({
        objectKey: value.objectKey,
        storageProvider: value.storageProvider,
        ...(typeof value.sourceMediaId === "string"
          ? { sourceMediaId: value.sourceMediaId }
          : {}),
      });
    }
    objects = parsed;
  } else {
    if (
      !Array.isArray(item.objectKeys) ||
      item.objectKeys.some((key) => typeof key !== "string")
    )
      return null;
    objects = (item.objectKeys as string[]).map((objectKey) => ({
      objectKey,
      storageProvider: "r2",
    }));
  }
  return {
    version: 1,
    jobId: item.jobId,
    idempotencyKey: item.idempotencyKey,
    attempt: item.attempt,
    objects,
  };
}
