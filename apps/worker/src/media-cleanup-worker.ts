import { createAdminDatabaseClient } from "@iride/database/admin";
import { QUEUE_NAMES, QUEUE_POLICIES, type Json } from "@iride/database";
import { createR2Storage } from "@iride/storage";
import type { WorkerEnv } from "@iride/config/worker";

export interface MediaCleanupJob {
  readonly version: 1;
  readonly jobId: string;
  readonly idempotencyKey: string;
  readonly attempt: number;
  readonly objectKeys: readonly string[];
}
interface QueueMessage {
  readonly messageId: number;
  readonly readCount: number;
  readonly message: MediaCleanupJob | null;
}
export interface MediaCleanupWorkerDependencies {
  readonly queue: {
    read: () => Promise<readonly QueueMessage[]>;
    archive: (id: number) => Promise<void>;
  };
  readonly remove: (key: string) => Promise<void>;
}

export async function runMediaCleanupBatch(
  dependencies: MediaCleanupWorkerDependencies,
) {
  const jobs = await dependencies.queue.read();
  for (const job of jobs) {
    if (!job.message) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "media_cleanup_job_invalid",
          messageId: job.messageId,
        }),
      );
      await dependencies.queue.archive(job.messageId);
      continue;
    }
    try {
      for (const key of job.message.objectKeys) await dependencies.remove(key);
      await dependencies.queue.archive(job.messageId);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "media_cleanup_job_failed",
          jobId: job.message.jobId,
          readCount: job.readCount,
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
      // Storage cleanup must remain retryable: metadata has already been
      // removed, so archiving a failed job would orphan the R2 objects.
    }
  }
  return jobs.length;
}

export function createMediaCleanupWorkerDependencies(
  env: WorkerEnv,
): MediaCleanupWorkerDependencies {
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
    queue: {
      async read() {
        const { data, error } = await admin.rpc("read_jobs", {
          queue_name: QUEUE_NAMES.MEDIA_CLEANUP,
          visibility_timeout_seconds:
            QUEUE_POLICIES.MEDIA_CLEANUP.visibilityTimeoutSeconds,
          batch_size: 2,
        });
        if (error) throw error;
        return (data ?? []).map((row) => ({
          messageId: row.msg_id,
          readCount: row.read_ct,
          message: parseMessage(row.message),
        }));
      },
      async archive(id) {
        const { error } = await admin.rpc("archive_job", {
          queue_name: QUEUE_NAMES.MEDIA_CLEANUP,
          message_id: id,
        });
        if (error) throw error;
      },
    },
    remove: (key) => storage.remove(key),
  };
}

function parseMessage(value: Json): MediaCleanupJob | null {
  if (typeof value !== "object" || value === null || Array.isArray(value))
    return null;
  const item = value as Record<string, Json | undefined>;
  if (
    item.version !== 1 ||
    typeof item.jobId !== "string" ||
    typeof item.idempotencyKey !== "string" ||
    typeof item.attempt !== "number" ||
    !Array.isArray(item.objectKeys) ||
    item.objectKeys.some((key) => typeof key !== "string")
  )
    return null;
  return {
    version: 1,
    jobId: item.jobId,
    idempotencyKey: item.idempotencyKey,
    attempt: item.attempt,
    objectKeys: item.objectKeys as string[],
  };
}

export function startMediaCleanupWorker(
  dependencies: MediaCleanupWorkerDependencies,
) {
  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  const tick = async () => {
    if (stopped) return;
    try {
      await runMediaCleanupBatch(dependencies);
    } catch (error) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "media_cleanup_worker_poll_failed",
          message: error instanceof Error ? error.message : "unknown",
        }),
      );
    } finally {
      if (!stopped) timer = setTimeout(tick, 2000);
    }
  };
  void tick();
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
