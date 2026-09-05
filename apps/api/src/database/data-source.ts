import "reflect-metadata";

import { DataSource } from "typeorm";

import { createMigrationDataSourceOptions } from "./typeorm.config";

const migrationDatabaseUrl = process.env.MIGRATION_DATABASE_URL;

if (!migrationDatabaseUrl) {
  throw new Error("MIGRATION_DATABASE_URL is required for TypeORM migrations.");
}

const migrationDataSource = new DataSource(
  createMigrationDataSourceOptions({ migrationDatabaseUrl }),
);

export default migrationDataSource;
