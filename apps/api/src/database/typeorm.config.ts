import type { DataSourceOptions } from "typeorm";

import { BaselineCurrentSchema20260906000000 } from "./migrations/20260906000000-baseline-current-schema";
import { ScheduleJobDrain20260906001000 } from "./migrations/20260906001000-schedule-job-drain";

type PostgresOptions = Extract<DataSourceOptions, { type: "postgres" }>;

const commonOptions = {
  type: "postgres" as const,
  synchronize: false,
  migrationsRun: false,
  logging: false,
};

export function createRuntimeDataSourceOptions(input: {
  readonly databaseUrl: string;
}): PostgresOptions {
  return {
    ...commonOptions,
    url: input.databaseUrl,
    entities: [],
    migrations: [],
    extra: { max: 5 },
    ssl: sslOptions(input.databaseUrl),
  };
}

export function createMigrationDataSourceOptions(input: {
  readonly migrationDatabaseUrl: string;
}): PostgresOptions {
  return {
    ...commonOptions,
    url: input.migrationDatabaseUrl,
    entities: [],
    migrations: [
      BaselineCurrentSchema20260906000000,
      ScheduleJobDrain20260906001000,
    ],
    extra: { max: 1 },
    ssl: sslOptions(input.migrationDatabaseUrl),
  };
}

function sslOptions(url: string): false | { rejectUnauthorized: false } {
  const hostname = new URL(url).hostname;
  return hostname === "localhost" || hostname === "127.0.0.1"
    ? false
    : { rejectUnauthorized: false };
}
