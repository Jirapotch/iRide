/* global process, URL */
import { appendFileSync } from "node:fs";

const githubEnv = process.env.GITHUB_ENV;
const poolerUrl = process.env.MIGRATION_POOLER_URL;
const databasePassword = process.env.SUPABASE_DB_PASSWORD;

if (!githubEnv || !poolerUrl || !databasePassword) {
  throw new Error(
    "GITHUB_ENV, MIGRATION_POOLER_URL, and SUPABASE_DB_PASSWORD are required.",
  );
}

const migrationUrl = new URL(poolerUrl);
migrationUrl.password = databasePassword;

appendFileSync(
  githubEnv,
  `MIGRATION_DATABASE_URL=${migrationUrl.toString()}\n`,
  "utf8",
);
