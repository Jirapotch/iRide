import type { Json } from "@iride/database";
import { createAdminDatabaseClient } from "@iride/database/admin";
import type { QueueName } from "@iride/database";

export interface PgmqMessage {
  readonly messageId: number;
  readonly readCount: number;
  readonly message: Json;
}

export interface PgmqRepository {
  read(queueName: QueueName, visibilityTimeoutSeconds: number, batchSize: number): Promise<readonly PgmqMessage[]>;
  archive(queueName: QueueName, messageId: number): Promise<void>;
}

export function createPgmqRepository(input: {
  readonly supabaseUrl: string;
  readonly serviceRoleKey: string;
}): PgmqRepository {
  const admin = createAdminDatabaseClient({
    url: input.supabaseUrl,
    serviceRoleKey: input.serviceRoleKey,
  });

  return {
    async read(queueName, visibilityTimeoutSeconds, batchSize) {
      const { data, error } = await admin.rpc("read_jobs", {
        queue_name: queueName,
        visibility_timeout_seconds: visibilityTimeoutSeconds,
        batch_size: Math.min(2, Math.max(1, batchSize)),
      });
      if (error) throw error;
      return (data ?? []).map((row) => ({
        messageId: row.msg_id,
        readCount: row.read_ct,
        message: row.message,
      }));
    },
    async archive(queueName, messageId) {
      const { error } = await admin.rpc("archive_job", {
        queue_name: queueName,
        message_id: messageId,
      });
      if (error) throw error;
    },
  };
}
