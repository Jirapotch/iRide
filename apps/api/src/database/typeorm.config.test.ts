import { describe, expect, it, vi } from "vitest";

import { createMigrationDataSourceOptions, createRuntimeDataSourceOptions } from "./typeorm.config";
import { ScheduleJobDrain20260906001000 } from "./migrations/20260906001000-schedule-job-drain";

describe("TypeORM configuration", () => {
  it("uses the pooled URL at runtime and never synchronizes schema", () => {
    const options = createRuntimeDataSourceOptions({
      databaseUrl: "postgresql://runtime.example/iride",
    });

    expect(options.url).toBe("postgresql://runtime.example/iride");
    expect(options.synchronize).toBe(false);
    expect(options.migrationsRun).toBe(false);
    expect(options.extra).toMatchObject({ max: 5 });
  });

  it("uses the direct URL only for migrations", () => {
    const options = createMigrationDataSourceOptions({
      migrationDatabaseUrl: "postgresql://direct.example/iride",
    });

    expect(options.url).toBe("postgresql://direct.example/iride");
    expect(options.synchronize).toBe(false);
    expect(options.migrations).toHaveLength(2);
  });

  it("schedules the protected drain endpoint every minute via Vault", async () => {
    const query = vi.fn().mockResolvedValue(undefined);
    await new ScheduleJobDrain20260906001000().up({ query } as never);
    const sql = String(query.mock.calls[0]?.[0]);

    expect(sql).toContain("'* * * * *'");
    expect(sql).toContain("iride_job_drain_url");
    expect(sql).toContain("iride_worker_cron_secret");
    expect(sql).not.toContain("https://iride-ecru.vercel.app");
  });
});
